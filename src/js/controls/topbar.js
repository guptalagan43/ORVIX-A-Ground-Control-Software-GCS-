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
    ExportManager.exportTelemetryCSV();
  }

  /**
   * Export Graph — capture graph canvases as a combined PNG.
   */
  function handleExportGraph() {
    ExportManager.exportGraphsPNG();
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
