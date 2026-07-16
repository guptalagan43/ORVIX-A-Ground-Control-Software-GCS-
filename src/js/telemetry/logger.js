/**
 * ORVIX Ground Control Software — Telemetry Logger
 *
 * Purpose: High-level telemetry logging API. Wraps state methods
 *          with additional statistics (packet rate, session info)
 *          and provides convenient accessors for the export module.
 *
 * Dependencies: config.js, state.js
 *
 * @module telemetry/logger
 */
"use strict";

const TelemetryLogger = (function () {
  /** @type {number|null} Interval ID for packet-rate calculation */
  let _rateIntervalId = null;

  // ── Public API ────────────────────────────────────────────────

  /**
   * Start the packet-rate calculation timer.
   * Runs every second to sample packetsThisSecond into packetRate.
   */
  function startRateCounter() {
    if (_rateIntervalId !== null) return;

    _rateIntervalId = setInterval(function () {
      const pps = OrvixState.get("packetsThisSecond") || 0;
      OrvixState.setState({
        packetRate: pps,
        packetsThisSecond: 0,
      });
    }, CONFIG.UI.PACKET_RATE_WINDOW_MS);
  }

  /**
   * Stop the packet-rate calculation timer.
   */
  function stopRateCounter() {
    if (_rateIntervalId !== null) {
      clearInterval(_rateIntervalId);
      _rateIntervalId = null;
    }
    OrvixState.setState({ packetRate: 0, packetsThisSecond: 0 });
  }

  /**
   * Log a packet into the system. Delegates to OrvixState but
   * also starts the rate counter if not already running.
   *
   * @param {Object} packet - Parsed telemetry packet
   */
  function logPacket(packet) {
    if (!packet) return;

    // Start rate counter on first packet
    if (_rateIntervalId === null) {
      startRateCounter();
    }

    OrvixState.addTelemetryPacket(packet);
  }

  /**
   * Return a copy of the full telemetry history.
   *
   * @returns {Object[]}
   */
  function getTelemetryHistory() {
    return (OrvixState.get("telemetryHistory") || []).slice();
  }

  /**
   * Clear all logged telemetry and reset counters.
   */
  function clearTelemetryHistory() {
    stopRateCounter();
    OrvixState.resetTelemetry();
    TelemetryParser.resetParseFailures();
    console.log("[Logger] Telemetry history cleared.");
  }

  /**
   * Return the total number of packets received.
   *
   * @returns {number}
   */
  function getPacketCount() {
    return OrvixState.get("packetCount") || 0;
  }

  /**
   * Return current packet rate (packets per second).
   *
   * @returns {number}
   */
  function getPacketRate() {
    return OrvixState.get("packetRate") || 0;
  }

  /**
   * Return the most recent telemetry packet.
   *
   * @returns {Object|null}
   */
  function getCurrentPacket() {
    return OrvixState.get("currentPacket") || null;
  }

  /**
   * Build a session summary object for display/export.
   *
   * @returns {Object} Summary of current telemetry session
   */
  function getSessionSummary() {
    const history = OrvixState.get("telemetryHistory") || [];
    const start = OrvixState.get("missionStartTime");

    return {
      packetCount: history.length,
      packetRate: OrvixState.get("packetRate") || 0,
      parseFailures: TelemetryParser.getParseFailureCount(),
      duration: start ? Date.now() - start : 0,
      missionPhase: OrvixState.get("missionPhase"),
      errorCodes: (OrvixState.get("errorCodes") || [0, 0, 0, 0]).join(""),
      gpsPoints: (OrvixState.get("gpsHistory") || []).length,
      totalDistance: OrvixState.get("totalDistance") || 0,
    };
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    startRateCounter: startRateCounter,
    stopRateCounter: stopRateCounter,
    logPacket: logPacket,
    getTelemetryHistory: getTelemetryHistory,
    clearTelemetryHistory: clearTelemetryHistory,
    getPacketCount: getPacketCount,
    getPacketRate: getPacketRate,
    getCurrentPacket: getCurrentPacket,
    getSessionSummary: getSessionSummary,
  };
})();
