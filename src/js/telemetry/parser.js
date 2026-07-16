/**
 * ORVIX Ground Control Software — Telemetry Packet Parser
 *
 * Purpose: Validates incoming comma-separated telemetry strings
 *          and extracts structured field data. Returns a parsed
 *          packet object or null on failure.
 *
 * Packet Format (14 fields, comma-separated):
 *  0  packetId          (integer)
 *  1  timestamp          (ISO 8601 string or HH:MM:SS.sss)
 *  2  batteryVoltage     (float, volts)
 *  3  altitude           (float, meters)
 *  4  pressure           (float, hPa)
 *  5  temperature        (float, °C)
 *  6  gpsLat             (float, decimal degrees)
 *  7  gpsLon             (float, decimal degrees)
 *  8  roll               (float, degrees)
 *  9  pitch              (float, degrees)
 * 10  yaw                (float, degrees)
 * 11  descentRate        (float, m/s)
 * 12  separationStatus   (0 or 1)
 * 13  parachuteStatus    (0 or 1)
 *
 * Dependencies: config.js
 *
 * @module telemetry/parser
 */
"use strict";

const TelemetryParser = (function () {
  /** @type {number} Running count of parse failures for diagnostics */
  let _parseFailures = 0;

  // ── Public API ────────────────────────────────────────────────

  /**
   * Parse a raw telemetry string into a structured packet object.
   *
   * @param {string} rawString - Raw comma-separated telemetry line
   * @returns {Object|null} Parsed packet object, or null on failure
   */
  function parsePacket(rawString) {
    if (typeof rawString !== "string" || rawString.trim().length === 0) {
      _parseFailures++;
      return null;
    }

    const trimmed = rawString.trim();
    const fields = trimmed.split(CONFIG.TELEMETRY.PACKET_DELIMITER);

    // Field count validation
    if (fields.length < CONFIG.TELEMETRY.EXPECTED_FIELD_COUNT) {
      _parseFailures++;
      console.warn(
        "[Parser] Expected " +
          CONFIG.TELEMETRY.EXPECTED_FIELD_COUNT +
          " fields, got " +
          fields.length +
          ": " +
          trimmed.substring(0, 80)
      );
      return null;
    }

    // Parse individual fields
    const packet = parsePacketFields(fields);

    if (!packet) {
      _parseFailures++;
      return null;
    }

    // Validate parsed packet
    if (!validatePacket(packet)) {
      _parseFailures++;
      return null;
    }

    // Attach metadata
    packet._raw = trimmed;
    packet._receivedAt = Date.now();

    return packet;
  }

  /**
   * Map an array of string fields to a structured packet object.
   * Handles missing or invalid values by substituting safe defaults.
   *
   * @param {string[]} fields - Array of raw field strings
   * @returns {Object|null} Structured packet, or null if critical fields fail
   */
  function parsePacketFields(fields) {
    const F = CONFIG.PACKET_FIELDS;

    try {
      const packet = {
        packetId: _parseInt(fields[F.PACKET_ID], 0),
        timestamp: _parseTimestamp(fields[F.TIMESTAMP]),
        batteryVoltage: _parseFloat(fields[F.BATTERY_VOLTAGE], 0),
        altitude: _parseFloat(fields[F.ALTITUDE], 0),
        pressure: _parseFloat(fields[F.PRESSURE], 0),
        temperature: _parseFloat(fields[F.TEMPERATURE], 0),
        gpsLat: _parseFloat(fields[F.GPS_LAT], 0),
        gpsLon: _parseFloat(fields[F.GPS_LON], 0),
        roll: _parseFloat(fields[F.ROLL], 0),
        pitch: _parseFloat(fields[F.PITCH], 0),
        yaw: _parseFloat(fields[F.YAW], 0),
        descentRate: _parseFloat(fields[F.DESCENT_RATE], 0),
        separationStatus: _parseInt(fields[F.SEPARATION_STATUS], 0),
        parachuteStatus: _parseInt(fields[F.PARACHUTE_STATUS], 0),
      };

      return packet;
    } catch (err) {
      console.error("[Parser] Field mapping error:", err);
      return null;
    }
  }

  /**
   * Validate a parsed packet against physically reasonable ranges.
   * Logs each specific violation for debugging but returns false
   * only if a critical field is completely unreasonable.
   *
   * @param {Object} packet - Parsed telemetry packet
   * @returns {boolean} true if packet is within acceptable bounds
   */
  function validatePacket(packet) {
    if (!packet || typeof packet !== "object") return false;

    const V = CONFIG.VALIDATION;
    let valid = true;

    // packetId must be non-negative
    if (packet.packetId < 0 || !Number.isFinite(packet.packetId)) {
      valid = false;
    }

    // Altitude
    if (packet.altitude < V.ALTITUDE_MIN || packet.altitude > V.ALTITUDE_MAX) {
      valid = false;
    }

    // Pressure
    if (packet.pressure < V.PRESSURE_MIN || packet.pressure > V.PRESSURE_MAX) {
      valid = false;
    }

    // Temperature
    if (
      packet.temperature < V.TEMPERATURE_MIN ||
      packet.temperature > V.TEMPERATURE_MAX
    ) {
      valid = false;
    }

    // Battery
    if (
      packet.batteryVoltage < V.BATTERY_MIN ||
      packet.batteryVoltage > V.BATTERY_MAX
    ) {
      valid = false;
    }

    // GPS ranges
    if (
      (packet.gpsLat !== 0 || packet.gpsLon !== 0) &&
      (packet.gpsLat < V.GPS_LAT_MIN ||
        packet.gpsLat > V.GPS_LAT_MAX ||
        packet.gpsLon < V.GPS_LON_MIN ||
        packet.gpsLon > V.GPS_LON_MAX)
    ) {
      valid = false;
    }

    // Descent rate
    if (
      packet.descentRate < V.DESCENT_RATE_MIN ||
      packet.descentRate > V.DESCENT_RATE_MAX
    ) {
      // Note: out-of-range descent rate is a valid packet
      // but triggers error code — don't reject it
    }

    return valid;
  }

  /**
   * Return the total number of parse failures since startup.
   * Useful for diagnostics display.
   *
   * @returns {number}
   */
  function getParseFailureCount() {
    return _parseFailures;
  }

  /**
   * Reset the parse failure counter (e.g. after a packet reset).
   */
  function resetParseFailures() {
    _parseFailures = 0;
  }

  // ── Private helpers ───────────────────────────────────────────

  /**
   * Safely parse a string to a float, returning a default on failure.
   *
   * @param {string} str - String to parse
   * @param {number} defaultVal - Default value if parsing fails
   * @returns {number}
   */
  function _parseFloat(str, defaultVal) {
    if (str === undefined || str === null || str.trim() === "") {
      return defaultVal;
    }
    const val = Number.parseFloat(str);
    return Number.isFinite(val) ? val : defaultVal;
  }

  /**
   * Safely parse a string to an integer, returning a default on failure.
   *
   * @param {string} str - String to parse
   * @param {number} defaultVal - Default value if parsing fails
   * @returns {number}
   */
  function _parseInt(str, defaultVal) {
    if (str === undefined || str === null || str.trim() === "") {
      return defaultVal;
    }
    const val = Number.parseInt(str, 10);
    return Number.isFinite(val) ? val : defaultVal;
  }

  /**
   * Parse a timestamp field. Accepts ISO 8601 or HH:MM:SS formats.
   * Returns current ISO string if the field cannot be parsed.
   *
   * @param {string} str - Timestamp string
   * @returns {string} ISO 8601 timestamp
   */
  function _parseTimestamp(str) {
    if (typeof str !== "string" || str.trim().length === 0) {
      return new Date().toISOString();
    }

    const trimmed = str.trim();

    // Try ISO 8601 first
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    // Try HH:MM:SS.sss format — attach today's date
    const timeMatch = trimmed.match(
      /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/
    );
    if (timeMatch) {
      const now = new Date();
      now.setHours(
        parseInt(timeMatch[1], 10),
        parseInt(timeMatch[2], 10),
        parseInt(timeMatch[3], 10),
        parseInt(timeMatch[4] || "0", 10)
      );
      return now.toISOString();
    }

    // Fallback: return as-is (will be used as label)
    return trimmed;
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    parsePacket: parsePacket,
    parsePacketFields: parsePacketFields,
    validatePacket: validatePacket,
    getParseFailureCount: getParseFailureCount,
    resetParseFailures: resetParseFailures,
  };
})();
