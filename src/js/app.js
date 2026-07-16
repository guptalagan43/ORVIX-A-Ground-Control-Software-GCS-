/**
 * ORVIX Ground Control Software — Application Bootstrap
 *
 * Purpose: Main entry point. Initialises all modules, wires up
 *          global event listeners, starts the UI update loops
 *          (footer clock, mission timer, telemetry table refresh),
 *          and registers the state-change listener that keeps
 *          every UI element in sync with live data.
 *
 * Load order (defined in index.html):
 *   config → state → utils/* → telemetry/* → monitoring/* →
 *   visualizations/* → controls/* → export → app
 *
 * Dependencies: Every other module
 *
 * @module app
 */
"use strict";

const OrvixApp = (function () {
  // ── DOM Element Cache ─────────────────────────────────────────

  let _els = {};

  /** @type {number|null} Footer clock interval */
  let _clockIntervalId = null;

  /** @type {number|null} UI update interval */
  let _uiIntervalId = null;

  // ── Initialization ────────────────────────────────────────────

  /**
   * Bootstrap the entire application.
   * Called once when the DOM is ready.
   */
  function initializeApp() {
    console.log(
      "%c ORVIX Ground Control Software v1.0 ",
      "background: #000; color: #00E676; font-size: 14px; font-weight: 700; padding: 4px 8px;"
    );

    _cacheElements();

    // Initialise sub-modules
    TopBar.initialize();
    ChartsManager.initializeCharts();
    ErrorCodeMonitor.initializeErrorMonitoring();

    // Subscribe to state changes for reactive UI updates
    OrvixState.subscribe(_onStateChange);

    // Start footer clock
    _startFooterClock();

    // Start periodic UI refresh
    _startUIUpdateLoop();

    console.log("[App] Initialization complete.");
  }

  // ── State Change Handler ──────────────────────────────────────

  /**
   * Central state-change listener.
   * Called every time OrvixState.setState() is invoked.
   * Routes the delta to the appropriate UI updater.
   *
   * @param {Object} prev - Previous state
   * @param {Object} next - New state
   */
  function _onStateChange(prev, next) {
    // Telemetry reset check
    if (prev.packetCount > 0 && next.packetCount === 0) {
      ChartsManager.clearAllCharts();
    }

    // Telemetry packet updates
    if (prev.currentPacket !== next.currentPacket && next.currentPacket) {
      _updateTelemetryDisplay(next.currentPacket);
      ChartsManager.updateCharts(next.currentPacket);
      
      // Calculate and update error codes in state
      const nextCodes = ErrorCodeMonitor.calculateErrorCodes(next.currentPacket);
      OrvixState.updateErrorCodes(nextCodes);
    }

    // Connection status change
    if (prev.isConnected !== next.isConnected) {
      _updateConnectionUI(next.isConnected);
    }

    // Error codes change
    if (
      prev.errorCodes.join("") !== next.errorCodes.join("")
    ) {
      ErrorCodeMonitor.updateErrorDisplay(next.errorCodes);
      ErrorCodeMonitor.checkErrorTransition(prev.errorCodes, next.errorCodes);
    }

    // Packet count badge
    if (prev.packetCount !== next.packetCount) {
      _updatePacketBadge(next.packetCount);
    }

    // GPS display update
    if (prev.currentGps !== next.currentGps && next.currentGps) {
      _updateGpsDisplay(next.currentGps, next.gpsHistory, next.totalDistance);
    }

    // Command history update
    if (prev.commandHistory.length !== next.commandHistory.length) {
      _updateCommandLog(next.commandHistory);
    }
  }

  // ── Telemetry Display ─────────────────────────────────────────

  /**
   * Update all telemetry table cells with the latest packet data.
   *
   * @param {Object} packet - Current telemetry packet
   */
  function _updateTelemetryDisplay(packet) {
    // Container telemetry
    _setTextById("telemetry-packet-id", packet.packetId);
    _setTextById("telemetry-timestamp", _formatTimestamp(packet.timestamp));
    _setTextById("telemetry-battery", _toFixed(packet.batteryVoltage, 2));
    _setTextById("telemetry-rssi", "---"); // RSSI not in current packet format
    _setTextById("telemetry-descent-rate", _toFixed(packet.descentRate, 2));

    // Payload telemetry
    _setTextById("telemetry-altitude", _toFixed(packet.altitude, 1));
    _setTextById("telemetry-pressure", _toFixed(packet.pressure, 2));
    _setTextById("telemetry-temperature", _toFixed(packet.temperature, 1));
    _setTextById("telemetry-gps-lat", _toFixed(packet.gpsLat, 6));
    _setTextById("telemetry-gps-lon", _toFixed(packet.gpsLon, 6));
    _setTextById("telemetry-roll", _toFixed(packet.roll, 1));
    _setTextById("telemetry-pitch", _toFixed(packet.pitch, 1));
    _setTextById("telemetry-yaw", _toFixed(packet.yaw, 1));
    _setTextById(
      "telemetry-sensor-status",
      packet.separationStatus + "" + packet.parachuteStatus
    );

    // Orientation readouts
    _setTextById("orientation-roll", _toFixed(packet.roll, 1));
    _setTextById("orientation-pitch", _toFixed(packet.pitch, 1));
    _setTextById("orientation-yaw", _toFixed(packet.yaw, 1));
  }

  /**
   * Update the packet count badge.
   *
   * @param {number} count
   */
  function _updatePacketBadge(count) {
    _setTextById("packet-count-badge", count + " pkts");
  }

  // ── GPS Display ───────────────────────────────────────────────

  /**
   * Update GPS coordinate display and stats.
   *
   * @param {Object} gps       - Current GPS point {lat, lon}
   * @param {Object[]} history - GPS point history
   * @param {number} distance  - Total distance in meters
   */
  function _updateGpsDisplay(gps, history, distance) {
    _setTextById("map-lat-display", _toFixed(gps.lat, 6));
    _setTextById("map-lon-display", _toFixed(gps.lon, 6));
    _setTextById("map-distance", _toFixed(distance / 1000, 2));
    _setTextById("map-point-count", history.length);
  }

  // ── Command Log ───────────────────────────────────────────────

  /**
   * Update the command log display with the latest entries.
   *
   * @param {Object[]} history - Array of command entries
   */
  function _updateCommandLog(history) {
    const container = document.getElementById("command-log-entries");
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML = '<p class="command-log__empty">No commands issued</p>';
      return;
    }

    // Show latest 20 entries, newest first
    const recent = history.slice(-20).reverse();
    let html = "";
    for (let i = 0; i < recent.length; i++) {
      const entry = recent[i];
      const ts = _formatTimestamp(entry.timestamp);
      html +=
        '<div class="command-log__entry">' +
        '<span class="text-muted">[' + ts + ']</span> ' +
        '<span>' + entry.command + '</span> — ' +
        '<span class="text-' + _statusColor(entry.status) + '">' +
        entry.status +
        "</span>" +
        (entry.message ? " " + entry.message : "") +
        "</div>";
    }
    container.innerHTML = html;
  }

  // ── Connection UI ─────────────────────────────────────────────

  /**
   * Update general UI elements when connection status changes.
   *
   * @param {boolean} connected
   */
  function _updateConnectionUI(connected) {
    // The topbar module handles its own buttons and status dot.
    // Here we handle body-level changes if needed.
    document.body.classList.toggle("is-connected", connected);
  }

  // ── Footer & Clock ────────────────────────────────────────────

  /**
   * Start the footer clock that updates every second.
   */
  function _startFooterClock() {
    _updateFooterClock(); // Immediate first update
    _clockIntervalId = setInterval(
      _updateFooterClock,
      CONFIG.UI.FOOTER_CLOCK_INTERVAL_MS
    );
  }

  /**
   * Update footer clock, mission timer, packet rate, and memory.
   */
  function _updateFooterClock() {
    // Current time
    const now = new Date();
    _setTextById(
      "footer-clock",
      _padZero(now.getHours()) +
        ":" +
        _padZero(now.getMinutes()) +
        ":" +
        _padZero(now.getSeconds())
    );

    // Mission timer
    const startTime = OrvixState.get("missionStartTime");
    if (startTime && OrvixState.get("telemetryStreaming")) {
      const elapsed = Date.now() - startTime;
      _setTextById("mission-timer", "Mission T+ " + _formatElapsed(elapsed));
    }

    // Packet rate
    _setTextById("footer-packet-rate", (OrvixState.get("packetRate") || 0) + " pkt/s");

    // Approximate memory usage
    const history = OrvixState.get("telemetryHistory") || [];
    const approxMB = ((history.length * 200) / (1024 * 1024)).toFixed(1);
    _setTextById("footer-memory", approxMB + " MB");
  }

  // ── UI Update Loop ────────────────────────────────────────────

  /**
   * Start periodic UI refresh for elements not driven by state changes
   * (e.g. animations, chart redraws in future phases).
   */
  function _startUIUpdateLoop() {
    _uiIntervalId = setInterval(function () {
      // Placeholder for Phase 3+ chart updates
      // Charts, map, and orientation will hook in here
    }, CONFIG.UI.UPDATE_INTERVAL_MS);
  }

  // ── Utility Functions ─────────────────────────────────────────

  /**
   * Set the textContent of an element by its ID. No-op if element
   * is missing (safe during partial rendering).
   *
   * @param {string} id    - Element ID
   * @param {*}      value - Value to display
   */
  function _setTextById(id, value) {
    var el = _els[id];
    if (!el) {
      el = document.getElementById(id);
      if (el) _els[id] = el; // Cache for next time
    }
    if (el) el.textContent = value;
  }

  /**
   * Format a number to fixed decimal places, handling NaN.
   *
   * @param {number} num    - Number to format
   * @param {number} digits - Decimal places
   * @returns {string}
   */
  function _toFixed(num, digits) {
    if (num === null || num === undefined || isNaN(num)) return "---";
    return Number(num).toFixed(digits);
  }

  /**
   * Format a timestamp for display (HH:MM:SS).
   *
   * @param {string} isoString - ISO timestamp
   * @returns {string}
   */
  function _formatTimestamp(isoString) {
    if (!isoString) return "--:--:--";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString.substring(0, 8);
      return (
        _padZero(d.getHours()) +
        ":" +
        _padZero(d.getMinutes()) +
        ":" +
        _padZero(d.getSeconds())
      );
    } catch (e) {
      return "--:--:--";
    }
  }

  /**
   * Format elapsed milliseconds as HH:MM:SS.
   *
   * @param {number} ms - Elapsed milliseconds
   * @returns {string}
   */
  function _formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return _padZero(h) + ":" + _padZero(m) + ":" + _padZero(s);
  }

  /**
   * Pad a number to 2 digits.
   *
   * @param {number} n
   * @returns {string}
   */
  function _padZero(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  /**
   * Map a command status to a CSS color utility class name.
   *
   * @param {string} status
   * @returns {string}
   */
  function _statusColor(status) {
    switch (status) {
      case CONFIG.COMMAND_STATUS.ACKNOWLEDGED:
        return "success";
      case CONFIG.COMMAND_STATUS.SENT:
      case CONFIG.COMMAND_STATUS.PENDING:
        return "info";
      case CONFIG.COMMAND_STATUS.FAILED:
        return "danger";
      default:
        return "muted";
    }
  }

  /**
   * Cache frequently-accessed DOM elements at startup.
   */
  function _cacheElements() {
    // Pre-cache footer elements (accessed every second)
    var ids = [
      "footer-clock",
      "footer-packet-rate",
      "footer-memory",
      "mission-timer",
      "packet-count-badge",
      "error-status-badge",
    ];
    for (var i = 0; i < ids.length; i++) {
      _els[ids[i]] = document.getElementById(ids[i]);
    }
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeApp: initializeApp,
  };
})();

// ── Auto-start on DOM ready ─────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  OrvixApp.initializeApp();
});
