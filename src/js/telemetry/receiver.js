/**
 * ORVIX Ground Control Software — Telemetry Receiver
 *
 * Purpose: Manages the Web Serial API connection to the CanSat
 *          microcontroller. Opens/closes serial port, continuously
 *          reads the incoming byte stream, assembles lines, and
 *          passes complete lines to the parser.
 *
 * Error handling follows rules.md §3.1:
 *  - Outer loop continues while port.readable is non-null
 *  - Inner loop reads until done
 *  - BufferOverrunError triggers retry (release + re-acquire reader)
 *  - User cancellation and device disconnection handled gracefully
 *
 * Dependencies: config.js, state.js, telemetry/parser.js
 *
 * @module telemetry/receiver
 */
"use strict";

const TelemetryReceiver = (function () {
  /** @type {boolean} Internal flag to request stop */
  let _stopRequested = false;

  /** @type {ReadableStreamDefaultReader|null} */
  let _reader = null;

  /** @type {WritableStreamDefaultWriter|null} */
  let _writer = null;

  /** @type {string} Line buffer for assembling partial reads */
  let _lineBuffer = "";

  // ── Public API ────────────────────────────────────────────────

  /**
   * Open a serial port and begin reading telemetry.
   * Prompts the user to select a port via the browser dialog.
   *
   * @returns {Promise<boolean>} true on success, false on failure
   */
  async function connectToSerial() {
    // Guard: already connected
    if (OrvixState.get("isConnected")) {
      console.warn("[Receiver] Already connected.");
      return false;
    }

    // Guard: browser support
    if (!("serial" in navigator)) {
      _logError("Web Serial API is not supported in this browser. Use Chrome 89+ or Edge 89+.");
      return false;
    }

    try {
      // Request port from the user
      const port = await navigator.serial.requestPort();

      // Open the port with configured settings
      await port.open({
        baudRate: CONFIG.SERIAL.BAUD_RATE,
        dataBits: CONFIG.SERIAL.DATA_BITS,
        stopBits: CONFIG.SERIAL.STOP_BITS,
        parity: CONFIG.SERIAL.PARITY,
        flowControl: CONFIG.SERIAL.FLOW_CONTROL,
        bufferSize: CONFIG.SERIAL.BUFFER_SIZE,
      });

      _stopRequested = false;
      _lineBuffer = "";

      OrvixState.setState({
        port: port,
        isConnected: true,
        telemetryStreaming: true,
        missionStartTime: OrvixState.get("missionStartTime") || Date.now(),
      });

      console.log("[Receiver] Serial port opened successfully.");

      // Start the asynchronous read loop (fire-and-forget)
      _readLoop(port);

      return true;
    } catch (err) {
      if (err.name === "NotFoundError") {
        // User cancelled the port selection dialog
        console.log("[Receiver] Port selection cancelled by user.");
      } else {
        _logError("Failed to open serial port: " + err.message);
      }
      return false;
    }
  }

  /**
   * Gracefully disconnect from the serial port.
   *
   * @returns {Promise<void>}
   */
  async function disconnectFromSerial() {
    _stopRequested = true;

    const port = OrvixState.get("port");

    try {
      // Release the reader if active
      if (_reader) {
        try {
          await _reader.cancel();
        } catch (e) {
          // Reader may already be released
        }
        _reader = null;
      }

      // Release the writer if active
      if (_writer) {
        try {
          _writer.releaseLock();
        } catch (e) {
          // Writer may already be released
        }
        _writer = null;
      }

      // Close the port
      if (port) {
        try {
          await port.close();
        } catch (e) {
          // Port may already be closed
        }
      }

      console.log("[Receiver] Serial port closed.");
    } catch (err) {
      console.error("[Receiver] Error during disconnect:", err);
    } finally {
      _lineBuffer = "";
      OrvixState.setState({
        port: null,
        reader: null,
        writer: null,
        isConnected: false,
        telemetryStreaming: false,
      });
    }
  }

  /**
   * Send a command string to the microcontroller via serial.
   *
   * @param {string} command - Command string to send
   * @returns {Promise<boolean>} true on success
   */
  async function writeSerialCommand(command) {
    const port = OrvixState.get("port");
    if (!port || !port.writable) {
      _logError("Cannot send command — serial port not connected.");
      return false;
    }

    let writer = null;
    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(command));
      console.log("[Receiver] Command sent:", command.trim());
      return true;
    } catch (err) {
      _logError("Failed to send command: " + err.message);
      return false;
    } finally {
      if (writer) {
        try {
          writer.releaseLock();
        } catch (e) {
          // Lock may already be released
        }
      }
    }
  }

  /**
   * Check whether the browser supports the Web Serial API.
   *
   * @returns {boolean}
   */
  function isSerialSupported() {
    return "serial" in navigator;
  }

  // ── Private helpers ───────────────────────────────────────────

  /**
   * Main read loop. Follows the Web Serial API best-practice
   * two-loop pattern:
   *  - Outer loop: continues while port.readable exists
   *  - Inner loop: reads chunks until done or error
   *
   * @param {SerialPort} port
   */
  async function _readLoop(port) {
    const decoder = new TextDecoder();

    // Outer loop — keeps retrying on non-fatal errors
    while (port.readable && !_stopRequested) {
      _reader = port.readable.getReader();
      OrvixState.setState({ reader: _reader });

      try {
        // Inner loop — reads until the stream signals done
        while (true) {
          const { value, done } = await _reader.read();

          if (done) {
            // Reader has been cancelled or stream ended
            break;
          }

          if (value) {
            _processChunk(decoder.decode(value, { stream: true }));
          }
        }
      } catch (err) {
        if (_stopRequested) {
          // Expected — we triggered the cancel
          break;
        }

        if (err.name === "BufferOverrunError") {
          // Non-fatal: release reader and re-acquire
          console.warn("[Receiver] Buffer overrun — retrying reader.");
        } else if (err.name === "NetworkError" || err.message.includes("device has been lost")) {
          // Device disconnected unexpectedly
          _logError("Serial device disconnected unexpectedly.");
          break;
        } else {
          _logError("Read error: " + err.message);
          break;
        }
      } finally {
        // Always release the reader lock before retrying
        try {
          _reader.releaseLock();
        } catch (e) {
          // May already be released
        }
        _reader = null;
        OrvixState.setState({ reader: null });
      }
    }

    // If we exited due to device loss (not user stop), clean up
    if (!_stopRequested && OrvixState.get("isConnected")) {
      console.warn("[Receiver] Connection lost — cleaning up.");
      OrvixState.setState({
        isConnected: false,
        telemetryStreaming: false,
        port: null,
      });
      try {
        await port.close();
      } catch (e) {
        // Port may already be closed
      }
    }
  }

  /**
   * Process a decoded text chunk. Accumulates characters in
   * _lineBuffer and emits complete lines to the parser.
   *
   * @param {string} chunk - Decoded text from the serial port
   */
  function _processChunk(chunk) {
    _lineBuffer += chunk;

    // Split on newline; last element is the incomplete tail
    const lines = _lineBuffer.split(CONFIG.TELEMETRY.LINE_DELIMITER);
    _lineBuffer = lines.pop(); // Keep the incomplete last segment

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;

      // Parse the line into a packet
      const packet = TelemetryParser.parsePacket(line);

      if (packet) {
        // Valid packet — add to state
        OrvixState.addTelemetryPacket(packet);

        // Add GPS point if valid
        OrvixState.addGpsPoint(packet.gpsLat, packet.gpsLon);

        // Evaluate error codes
        _evaluateErrorCodes(packet);
      } else {
        console.warn("[Receiver] Malformed packet:", line);
      }
    }
  }

  /**
   * Evaluate the 4-digit error code based on a telemetry packet.
   *
   * Digit 1 — Descent rate outside 8–10 m/s
   * Digit 2 — GPS coordinates invalid (0,0 or null)
   * Digit 3 — Separation command sent but not confirmed within timeout
   * Digit 4 — Parachute deployment command was executed
   *
   * @param {Object} packet - Parsed telemetry packet
   */
  function _evaluateErrorCodes(packet) {
    const codes = [0, 0, 0, 0];

    // Digit 1: Descent rate
    if (
      packet.descentRate < CONFIG.ERROR.DESCENT_RATE_MIN ||
      packet.descentRate > CONFIG.ERROR.DESCENT_RATE_MAX
    ) {
      codes[CONFIG.ERROR.DESCENT_RATE] = 1;
    }

    // Digit 2: GPS availability
    if (
      packet.gpsLat === 0 && packet.gpsLon === 0 ||
      packet.gpsLat === null || packet.gpsLon === null ||
      isNaN(packet.gpsLat) || isNaN(packet.gpsLon)
    ) {
      codes[CONFIG.ERROR.GPS_AVAILABILITY] = 1;
    }

    // Digit 3: Separation status
    const sepTime = OrvixState.get("separationCommandTime");
    if (sepTime && !OrvixState.get("separationConfirmed")) {
      if (Date.now() - sepTime > CONFIG.ERROR.SEPARATION_TIMEOUT_MS) {
        codes[CONFIG.ERROR.PAYLOAD_SEPARATION] = 1;
      }
    }
    // Also check from packet field
    if (packet.separationStatus === 1) {
      codes[CONFIG.ERROR.PAYLOAD_SEPARATION] = 1;
    }

    // Digit 4: Parachute deployed
    if (OrvixState.get("parachuteDeployed") || packet.parachuteStatus === 1) {
      codes[CONFIG.ERROR.EMERGENCY_PARACHUTE] = 1;
    }

    OrvixState.updateErrorCodes(codes);
  }

  /**
   * Log an error to the console and (in future) to the UI error log.
   *
   * @param {string} message - Error message
   */
  function _logError(message) {
    const ts = new Date().toISOString();
    console.error("[Receiver " + ts + "] " + message);
  }

  // ── Listen for device disconnection ───────────────────────────

  if ("serial" in navigator) {
    navigator.serial.addEventListener("disconnect", function (event) {
      console.warn("[Receiver] Serial device disconnected event.");
      if (OrvixState.get("isConnected")) {
        OrvixState.setState({
          isConnected: false,
          telemetryStreaming: false,
          port: null,
          reader: null,
        });
      }
    });
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    connectToSerial: connectToSerial,
    disconnectFromSerial: disconnectFromSerial,
    writeSerialCommand: writeSerialCommand,
    isSerialSupported: isSerialSupported,
  };
})();
