/**
 * ORVIX Ground Control Software — Top Control Bar
 *
 * Purpose: Wires up the 6 top-bar buttons to their respective
 *          handlers and manages UI state transitions (enabled/
 *          disabled, status label, connection dot).
 *
 * Buttons:
 *  1. Start Telemetry   → connectToSerial()
 *  2. Stop Telemetry    → disconnectFromSerial()
 *  3. Export CSV         → download telemetry history
 *  4. Export Graph       → snapshot graphs as PNG
 *  5. Sync PC Time      → send timestamp to MCU
 *  6. Reset Packets      → clear history with confirmation
 *
 * Dependencies: state.js, telemetry/receiver.js, telemetry/logger.js
 *
 * @module controls/topbar
 */
"use strict";

const TopBar = (function () {
  // ── DOM Element Cache ─────────────────────────────────────────

  let _els = {};

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialise the top bar: cache elements, attach listeners,
   * set initial button states.
   */
  function initialize() {
    _cacheElements();
    _attachListeners();
    _updateButtonStates(false);

    // Show serial support warning if needed
    if (!TelemetryReceiver.isSerialSupported()) {
      _setStatus("NO SERIAL API", "error");
      if (_els.btnStart) _els.btnStart.disabled = true;
    }

    console.log("[TopBar] Initialized.");
  }

  // ── Button Handlers ───────────────────────────────────────────

  /**
   * Start Telemetry — connect to serial and begin streaming.
   */
  async function handleStartTelemetry() {
    _setStatus("CONNECTING…", "connecting");
    _els.btnStart.disabled = true;

    const success = await TelemetryReceiver.connectToSerial();

    if (success) {
      _updateButtonStates(true);
      _setStatus("CONNECTED", "online");
      TelemetryLogger.startRateCounter();
      OrvixState.logCommand("START_TELEMETRY", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, "Telemetry stream started");
    } else {
      _updateButtonStates(false);
      _setStatus("DISCONNECTED", "offline");
    }
  }

  /**
   * Stop Telemetry — disconnect serial and stop streaming.
   */
  async function handleStopTelemetry() {
    _setStatus("DISCONNECTING…", "connecting");
    _els.btnStop.disabled = true;

    await TelemetryReceiver.disconnectFromSerial();

    _updateButtonStates(false);
    _setStatus("DISCONNECTED", "offline");
    TelemetryLogger.stopRateCounter();
    OrvixState.logCommand("STOP_TELEMETRY", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, "Telemetry stream stopped");
  }

  /**
   * Export CSV — download telemetry history as a CSV file.
   */
  function handleExportCSV() {
    const history = TelemetryLogger.getTelemetryHistory();
    if (history.length === 0) {
      alert("No telemetry data to export.");
      return;
    }

    const headers = CONFIG.EXPORT.CSV_HEADERS;
    const sep = CONFIG.EXPORT.CSV_SEPARATOR;

    // Build CSV rows
    const rows = [headers.join(sep)];
    for (let i = 0; i < history.length; i++) {
      const p = history[i];
      const errorCode = (OrvixState.get("errorCodes") || [0, 0, 0, 0]).join("");
      rows.push(
        [
          p.timestamp,
          p.packetId,
          p.batteryVoltage,
          p.altitude,
          p.pressure,
          p.temperature,
          p.gpsLat,
          p.gpsLon,
          p.roll,
          p.pitch,
          p.yaw,
          p.descentRate,
          p.separationStatus,
          p.parachuteStatus,
          errorCode,
        ].join(sep)
      );
    }

    const csv = rows.join("\n");
    const filename =
      CONFIG.EXPORT.FILENAME_PREFIX_CSV + _formatDateForFilename() + ".csv";

    _downloadBlob(csv, filename, "text/csv;charset=utf-8;");
    OrvixState.logCommand("EXPORT_CSV", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, filename);
    console.log("[TopBar] Exported CSV:", filename, "(" + history.length + " rows)");
  }

  /**
   * Export Graph — capture graph canvases as a combined PNG.
   * Placeholder implementation — full logic added in Phase 3
   * when Chart.js instances are available.
   */
  function handleExportGraph() {
    const canvasIds = [
      "chart-altitude",
      "chart-pressure",
      "chart-temperature",
      "chart-descent-rate",
      "chart-battery",
    ];

    // Collect all chart canvases
    const canvases = [];
    for (let i = 0; i < canvasIds.length; i++) {
      const canvas = document.getElementById(canvasIds[i]);
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        canvases.push(canvas);
      }
    }

    if (canvases.length === 0) {
      alert("No graph data to export. Start telemetry first.");
      return;
    }

    // Stack all canvases vertically into a single composite image
    const padding = 16;
    const totalWidth = Math.max.apply(
      null,
      canvases.map(function (c) { return c.width; })
    );
    const totalHeight = canvases.reduce(function (sum, c) {
      return sum + c.height + padding;
    }, 0);

    const composite = document.createElement("canvas");
    composite.width = totalWidth;
    composite.height = totalHeight;
    const ctx = composite.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    let y = 0;
    for (let i = 0; i < canvases.length; i++) {
      ctx.drawImage(canvases[i], 0, y);
      y += canvases[i].height + padding;
    }

    composite.toBlob(function (blob) {
      if (!blob) return;
      const filename =
        CONFIG.EXPORT.FILENAME_PREFIX_GRAPH + _formatDateForFilename() + ".png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      OrvixState.logCommand("EXPORT_GRAPH", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, filename);
      console.log("[TopBar] Exported graphs:", filename);
    }, "image/png");
  }

  /**
   * Sync PC Time — send current PC timestamp to the microcontroller.
   */
  async function handleSyncTime() {
    const now = new Date();
    const ts = now.toISOString();
    const cmd = CONFIG.COMMANDS.SYNC_TIME + ts + "\n";

    const success = await TelemetryReceiver.writeSerialCommand(cmd);
    if (success) {
      OrvixState.logCommand("SYNC_TIME", CONFIG.COMMAND_STATUS.SENT, "Synced: " + ts);
      console.log("[TopBar] PC time synced:", ts);
    } else {
      OrvixState.logCommand("SYNC_TIME", CONFIG.COMMAND_STATUS.FAILED, "Not connected");
    }
  }

  /**
   * Reset Packets — clear all telemetry with confirmation.
   */
  function handleResetPackets() {
    const count = TelemetryLogger.getPacketCount();
    const confirmed = confirm(
      "Reset all telemetry data?\n\n" +
        "This will clear " +
        count +
        " packets, graph data, and GPS history.\n" +
        "This action cannot be undone."
    );

    if (!confirmed) return;

    TelemetryLogger.clearTelemetryHistory();
    OrvixState.logCommand("RESET_PACKETS", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, "Cleared " + count + " packets");
    console.log("[TopBar] Packets reset. Cleared", count, "packets.");
  }

  // ── Private helpers ───────────────────────────────────────────

  /**
   * Cache all top-bar DOM elements for efficient access.
   */
  function _cacheElements() {
    _els = {
      btnStart: document.getElementById("btn-start-telemetry"),
      btnStop: document.getElementById("btn-stop-telemetry"),
      btnExportCSV: document.getElementById("btn-export-csv"),
      btnExportGraph: document.getElementById("btn-export-graph"),
      btnSyncTime: document.getElementById("btn-sync-time"),
      btnResetPackets: document.getElementById("btn-reset-packets"),
      statusDot: document.getElementById("connection-status-dot"),
      statusText: document.getElementById("connection-status-text"),
    };
  }

  /**
   * Attach click event listeners to all buttons.
   */
  function _attachListeners() {
    if (_els.btnStart)      _els.btnStart.addEventListener("click", handleStartTelemetry);
    if (_els.btnStop)       _els.btnStop.addEventListener("click", handleStopTelemetry);
    if (_els.btnExportCSV)  _els.btnExportCSV.addEventListener("click", handleExportCSV);
    if (_els.btnExportGraph) _els.btnExportGraph.addEventListener("click", handleExportGraph);
    if (_els.btnSyncTime)   _els.btnSyncTime.addEventListener("click", handleSyncTime);
    if (_els.btnResetPackets) _els.btnResetPackets.addEventListener("click", handleResetPackets);
  }

  /**
   * Enable/disable buttons based on connection state.
   *
   * @param {boolean} connected - Whether serial port is connected
   */
  function _updateButtonStates(connected) {
    if (_els.btnStart) _els.btnStart.disabled = connected;
    if (_els.btnStop)  _els.btnStop.disabled = !connected;
  }

  /**
   * Update the connection status indicator and label.
   *
   * @param {string} text   - Status text (e.g. "CONNECTED")
   * @param {string} status - CSS modifier: "online", "offline", "connecting", "error"
   */
  function _setStatus(text, status) {
    if (_els.statusText) {
      _els.statusText.textContent = text;
    }

    if (_els.statusDot) {
      // Remove all status classes
      _els.statusDot.className = "status-indicator";
      // Add the matching class
      _els.statusDot.classList.add("status-indicator--" + status);
    }
  }

  /**
   * Format current date/time for use in filenames.
   * Format: YYYYMMDD_HHMMSS
   *
   * @returns {string}
   */
  function _formatDateForFilename() {
    const d = new Date();
    const pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "_" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  /**
   * Trigger a file download from a string blob.
   *
   * @param {string} content  - File content
   * @param {string} filename - Download filename
   * @param {string} mimeType - MIME type string
   */
  function _downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initialize: initialize,
    handleStartTelemetry: handleStartTelemetry,
    handleStopTelemetry: handleStopTelemetry,
    handleExportCSV: handleExportCSV,
    handleExportGraph: handleExportGraph,
    handleSyncTime: handleSyncTime,
    handleResetPackets: handleResetPackets,
  };
})();
