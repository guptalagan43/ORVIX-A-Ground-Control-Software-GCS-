/**
 * ORVIX Ground Control Software — Error Code Monitor
 *
 * Purpose: Computes and displays the 4-digit fault code based on
 *          live telemetry data. Monitors descent rate, GPS, separation,
 *          and parachute status.
 *
 * Digit Positions & Meanings:
 *   [0] Descent Rate: 0 = Safe (8-10 m/s), 1 = Unsafe (<8 or >10 m/s)
 *   [1] GPS Availability: 0 = Valid coordinates, 1 = Invalid or (0,0)
 *   [2] Payload Separation: 0 = Nominal, 1 = Failed (Command sent but timeout exceeded)
 *   [3] Emergency Parachute: 0 = Closed/Standby, 1 = Deployed
 *
 * Dependencies: config.js, state.js, utils/dom.js, utils/formatters.js
 *
 * @module monitoring/error-code
 */
"use strict";

const ErrorCodeMonitor = (function () {

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initializes error monitoring.
   * Connects DOM elements and subscribes to state.
   */
  function initializeErrorMonitoring() {
    console.log("[ErrorCode] Monitoring system initialized.");
    // Display initial nominal state
    _updateDOM([0, 0, 0, 0]);
  }

  /**
   * Calculate error codes based on a telemetry packet.
   * Returns array of 4 digits [0 or 1].
   *
   * @param {Object} packet - Current telemetry packet
   * @returns {number[]} Array of 4 digits
   */
  function calculateErrorCodes(packet) {
    const codes = [0, 0, 0, 0];
    if (!packet) return codes;

    // Digit 1: Descent Rate
    if (
      packet.descentRate < CONFIG.ERROR.DESCENT_RATE_MIN ||
      packet.descentRate > CONFIG.ERROR.DESCENT_RATE_MAX
    ) {
      codes[CONFIG.ERROR.DESCENT_RATE] = 1;
    }

    // Digit 2: GPS Availability
    if (
      packet.gpsLat === 0 && packet.gpsLon === 0 ||
      packet.gpsLat === null || packet.gpsLon === null ||
      isNaN(packet.gpsLat) || isNaN(packet.gpsLon)
    ) {
      codes[CONFIG.ERROR.GPS_AVAILABILITY] = 1;
    }

    // Digit 3: Payload Separation
    const sepTime = OrvixState.get("separationCommandTime");
    const sepConfirmed = OrvixState.get("separationConfirmed");
    if (sepTime && !sepConfirmed) {
      if (Date.now() - sepTime > CONFIG.ERROR.SEPARATION_TIMEOUT_MS) {
        codes[CONFIG.ERROR.PAYLOAD_SEPARATION] = 1;
      }
    }
    // Also respect separation field in packet if it signals separation fault or active separation logic
    if (packet.separationStatus === 1) {
      // Depending on MCU format, 1 could mean separation triggered/completed or error.
      // In ORVIX PRD §4.5: "Digit 3: Payload Separation (0 = Nom, 1 = Fail)"
      // So if packet field explicitly reports 1, it's a failure.
      codes[CONFIG.ERROR.PAYLOAD_SEPARATION] = 1;
    }

    // Digit 4: Emergency Parachute
    if (OrvixState.get("parachuteDeployed") || packet.parachuteStatus === 1) {
      codes[CONFIG.ERROR.EMERGENCY_PARACHUTE] = 1;
    }

    return codes;
  }

  /**
   * Update the visual display in the DOM.
   * Applied CSS classes: `.fault` for red alerts and pulse animations.
   *
   * @param {number[]} codes - Array of 4 digits
   */
  function updateErrorDisplay(codes) {
    if (!Array.isArray(codes) || codes.length !== CONFIG.ERROR.DIGIT_COUNT) {
      return;
    }
    _updateDOM(codes);
  }

  /**
   * Check for a transitions from 0 -> 1 and raise logs/alerts.
   *
   * @param {number[]} prevCodes - Previous error codes
   * @param {number[]} newCodes - New error codes
   */
  function checkErrorTransition(prevCodes, newCodes) {
    if (!prevCodes || !newCodes) return;
    const newFaults = [];

    const NAMES = ["DESCENT_RATE", "GPS_AVAILABILITY", "PAYLOAD_SEPARATION", "EMERGENCY_PARACHUTE"];
    const LABELS = ["Descent Rate Danger", "GPS Signal Lost", "Payload Separation Fail", "Emergency Parachute Deployed"];

    for (let i = 0; i < CONFIG.ERROR.DIGIT_COUNT; i++) {
      if (prevCodes[i] === 0 && newCodes[i] === 1) {
        newFaults.push({
          index: i,
          name: NAMES[i],
          label: LABELS[i]
        });
      }
    }

    if (newFaults.length > 0) {
      _handleErrorAlert(newFaults);
    }
  }

  /**
   * Convert an array of codes [0, 1, 0, 0] to its human-readable summary.
   *
   * @param {number[]} codes
   * @returns {string} Summary string
   */
  function getErrorSummary(codes) {
    return Formatters.formatErrorSummary(codes);
  }

  // ── Private Helpers ───────────────────────────────────────────

  /**
   * Directly updates DOM elements with error digits and status classes.
   *
   * @param {number[]} codes
   */
  function _updateDOM(codes) {
    for (let i = 0; i < CONFIG.ERROR.DIGIT_COUNT; i++) {
      const digitId = "error-digit-" + (i + 1);
      const el = DOM.byId(digitId);
      if (el) {
        el.textContent = codes[i];
        if (codes[i] === 1) {
          el.classList.add("fault");
          el.setAttribute("aria-label", _getAriaLabel(i) + " status: Fault Detected");
        } else {
          el.classList.remove("fault");
          el.setAttribute("aria-label", _getAriaLabel(i) + " status: Normal");
        }
      }
    }

    // Update main status badge
    const badge = DOM.byId("error-status-badge");
    if (badge) {
      const hasError = codes.some(function (d) { return d === 1; });
      if (hasError) {
        badge.textContent = "FAULT";
        badge.style.color = "var(--color-danger)";
        badge.style.borderColor = "var(--color-danger)";
      } else {
        badge.textContent = "NOMINAL";
        badge.style.color = "var(--color-success)";
        badge.style.borderColor = "var(--color-success)";
      }
    }
  }

  /**
   * Return screen-reader-friendly names for error positions.
   *
   * @param {number} index
   * @returns {string}
   */
  function _getAriaLabel(index) {
    switch (index) {
      case CONFIG.ERROR.DESCENT_RATE:
        return "Descent rate";
      case CONFIG.ERROR.GPS_AVAILABILITY:
        return "GPS availability";
      case CONFIG.ERROR.PAYLOAD_SEPARATION:
        return "Payload separation";
      case CONFIG.ERROR.EMERGENCY_PARACHUTE:
        return "Emergency parachute";
      default:
        return "Sensor";
    }
  }

  /**
   * Handles alarms and logging for new faults.
   *
   * @param {Object[]} newFaults
   */
  function _handleErrorAlert(newFaults) {
    for (let i = 0; i < newFaults.length; i++) {
      const fault = newFaults[i];
      const ts = new Date().toISOString();
      console.warn("[ErrorCode Monitor " + ts + "] FAULT DETECTED: " + fault.label);

      // Log command/system alert in history
      OrvixState.logCommand("SYSTEM_ALERT", CONFIG.COMMAND_STATUS.FAILED, fault.label);
    }
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeErrorMonitoring: initializeErrorMonitoring,
    calculateErrorCodes: calculateErrorCodes,
    updateErrorDisplay: updateErrorDisplay,
    checkErrorTransition: checkErrorTransition,
    getErrorSummary: getErrorSummary,
  };
})();
