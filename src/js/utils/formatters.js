/**
 * ORVIX Ground Control Software — Value Formatters
 *
 * Purpose: Pure formatting functions for telemetry values.
 *          Ensures consistent decimal places, units, and display
 *          strings across tables, charts, and exports.
 *
 * All functions are pure (no side effects) and handle
 * null/undefined/NaN inputs gracefully.
 *
 * Dependencies: None
 *
 * @module utils/formatters
 */
"use strict";

const Formatters = (function () {

  /** Placeholder returned when a value is unavailable */
  var PLACEHOLDER = "---";

  // ── Numeric ───────────────────────────────────────────────────

  /**
   * Format a number to a fixed number of decimal places.
   * @param {number} num
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatNumber(num, decimals) {
    var d = (decimals === undefined) ? 2 : decimals;
    if (num === null || num === undefined || !Number.isFinite(num)) {
      return PLACEHOLDER;
    }
    return num.toFixed(d);
  }

  /**
   * Format altitude in metres.
   * @param {number} meters
   * @returns {string}  e.g. "1523.4 m"
   */
  function formatAltitude(meters) {
    if (!Number.isFinite(meters)) return PLACEHOLDER;
    return meters.toFixed(1) + " m";
  }

  /**
   * Format atmospheric pressure in hPa.
   * @param {number} hPa
   * @returns {string}  e.g. "845.23 hPa"
   */
  function formatPressure(hPa) {
    if (!Number.isFinite(hPa)) return PLACEHOLDER;
    return hPa.toFixed(2) + " hPa";
  }

  /**
   * Format temperature in degrees Celsius.
   * @param {number} celsius
   * @returns {string}  e.g. "12.5 °C"
   */
  function formatTemperature(celsius) {
    if (!Number.isFinite(celsius)) return PLACEHOLDER;
    return celsius.toFixed(1) + " \u00b0C";
  }

  /**
   * Format voltage in volts.
   * @param {number} volts
   * @returns {string}  e.g. "3.72 V"
   */
  function formatVoltage(volts) {
    if (!Number.isFinite(volts)) return PLACEHOLDER;
    return volts.toFixed(2) + " V";
  }

  /**
   * Format descent (or ascent) rate in metres per second.
   * @param {number} ms - metres per second
   * @returns {string}  e.g. "9.2 m/s"
   */
  function formatDescentRate(ms) {
    if (!Number.isFinite(ms)) return PLACEHOLDER;
    return ms.toFixed(1) + " m/s";
  }

  /**
   * Format signal strength in dBm.
   * @param {number} dbm
   * @returns {string}  e.g. "-72 dBm"
   */
  function formatRSSI(dbm) {
    if (!Number.isFinite(dbm)) return PLACEHOLDER;
    return Math.round(dbm) + " dBm";
  }

  /**
   * Format an angle in degrees.
   * @param {number} deg
   * @param {number} [decimals=1]
   * @returns {string}  e.g. "5.2°"
   */
  function formatAngle(deg, decimals) {
    var d = (decimals === undefined) ? 1 : decimals;
    if (!Number.isFinite(deg)) return PLACEHOLDER;
    return deg.toFixed(d) + "\u00b0";
  }

  /**
   * Format a distance in metres or km.
   * Switches to km at >= 1000 m.
   * @param {number} meters
   * @returns {string}  e.g. "1.52 km" or "850.0 m"
   */
  function formatDistance(meters) {
    if (!Number.isFinite(meters)) return PLACEHOLDER;
    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + " km";
    }
    return meters.toFixed(1) + " m";
  }

  // ── GPS ───────────────────────────────────────────────────────

  /**
   * Format a GPS coordinate pair.
   * @param {number} lat - Decimal degrees latitude
   * @param {number} lon - Decimal degrees longitude
   * @returns {string}  e.g. "28.613456, 77.209876"
   */
  function formatGPS(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return PLACEHOLDER;
    return lat.toFixed(6) + ", " + lon.toFixed(6);
  }

  /**
   * Format latitude with cardinal direction.
   * @param {number} lat
   * @returns {string}  e.g. "28.613456°N"
   */
  function formatLatitude(lat) {
    if (!Number.isFinite(lat)) return PLACEHOLDER;
    var dir = lat >= 0 ? "N" : "S";
    return Math.abs(lat).toFixed(6) + "\u00b0" + dir;
  }

  /**
   * Format longitude with cardinal direction.
   * @param {number} lon
   * @returns {string}  e.g. "77.209876°E"
   */
  function formatLongitude(lon) {
    if (!Number.isFinite(lon)) return PLACEHOLDER;
    var dir = lon >= 0 ? "E" : "W";
    return Math.abs(lon).toFixed(6) + "\u00b0" + dir;
  }

  // ── Error Codes ───────────────────────────────────────────────

  /**
   * Convert a 4-digit error code array to a string.
   * @param {number[]} codes
   * @returns {string}  e.g. "0101"
   */
  function formatErrorCode(codes) {
    if (!Array.isArray(codes) || codes.length !== 4) return "----";
    return codes.join("");
  }

  /**
   * Produce a human-readable summary of active error codes.
   * @param {number[]} codes
   * @returns {string}  e.g. "GPS fault, Parachute deployed"
   */
  function formatErrorSummary(codes) {
    if (!Array.isArray(codes) || codes.length !== 4) return "Unknown";

    var LABELS = [
      "Descent rate fault",
      "GPS unavailable",
      "Separation fault",
      "Parachute deployed",
    ];

    var active = [];
    for (var i = 0; i < 4; i++) {
      if (codes[i] === 1) active.push(LABELS[i]);
    }

    return active.length === 0 ? "Nominal" : active.join(", ");
  }

  // ── Packet Count ──────────────────────────────────────────────

  /**
   * Format a packet count for the badge display.
   * @param {number} count
   * @returns {string}  e.g. "1,045 pkts"
   */
  function formatPacketCount(count) {
    if (!Number.isFinite(count)) return "0 pkts";
    return count.toLocaleString() + " pkts";
  }

  /**
   * Format a packet rate.
   * @param {number} pps - Packets per second
   * @returns {string}  e.g. "10 pkt/s"
   */
  function formatPacketRate(pps) {
    if (!Number.isFinite(pps)) return "0 pkt/s";
    return Math.round(pps) + " pkt/s";
  }

  /**
   * Format a memory size in bytes to a human-readable string.
   * @param {number} bytes
   * @returns {string}  e.g. "1.52 MB"
   */
  function formatMemory(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    formatNumber: formatNumber,
    formatAltitude: formatAltitude,
    formatPressure: formatPressure,
    formatTemperature: formatTemperature,
    formatVoltage: formatVoltage,
    formatDescentRate: formatDescentRate,
    formatRSSI: formatRSSI,
    formatAngle: formatAngle,
    formatDistance: formatDistance,
    formatGPS: formatGPS,
    formatLatitude: formatLatitude,
    formatLongitude: formatLongitude,
    formatErrorCode: formatErrorCode,
    formatErrorSummary: formatErrorSummary,
    formatPacketCount: formatPacketCount,
    formatPacketRate: formatPacketRate,
    formatMemory: formatMemory,
  };
})();
