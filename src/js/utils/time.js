/**
 * ORVIX Ground Control Software — Time Utilities
 *
 * Purpose: Timestamp formatting, elapsed-time calculations,
 *          mission timer helpers, and filename-safe date strings.
 *
 * Dependencies: None
 *
 * @module utils/time
 */
"use strict";

const TimeUtils = (function () {

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Zero-pad a number to at least 2 digits.
   * @param {number} n
   * @returns {string}
   */
  function _pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /**
   * Zero-pad a number to exactly 3 digits (for milliseconds).
   * @param {number} n
   * @returns {string}
   */
  function _pad3(n) {
    if (n < 10) return "00" + n;
    if (n < 100) return "0" + n;
    return String(n);
  }

  // ── Current Time ──────────────────────────────────────────────

  /**
   * Return the current time as an ISO 8601 string.
   * @returns {string}  e.g. "2026-07-16T08:30:15.123Z"
   */
  function getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Return the current Date object.
   * @returns {Date}
   */
  function getPCDate() {
    return new Date();
  }

  /**
   * Return the current UTC time as HH:MM:SS.
   * @returns {string}  e.g. "08:30:15"
   */
  function getCurrentTimeString() {
    var d = new Date();
    return _pad(d.getUTCHours()) + ":" + _pad(d.getUTCMinutes()) + ":" + _pad(d.getUTCSeconds());
  }

  /**
   * Return seconds elapsed since midnight (local time).
   * Useful as a numeric X-axis value for charts.
   * @returns {number}
   */
  function getSecondsSinceMidnight() {
    var d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  // ── Formatting ────────────────────────────────────────────────

  /**
   * Format a Date or timestamp for use in filenames.
   * @param {Date|string|number} [date] - Defaults to now
   * @returns {string}  e.g. "20260716_083015"
   */
  function formatForFilename(date) {
    var d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return (
      d.getFullYear() +
      _pad(d.getMonth() + 1) +
      _pad(d.getDate()) +
      "_" +
      _pad(d.getHours()) +
      _pad(d.getMinutes()) +
      _pad(d.getSeconds())
    );
  }

  /**
   * Format a timestamp as HH:MM:SS (local time).
   * @param {Date|string|number} [date] - Defaults to now
   * @returns {string}  e.g. "08:30:15"
   */
  function formatTime(date) {
    var d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return "--:--:--";
    return _pad(d.getHours()) + ":" + _pad(d.getMinutes()) + ":" + _pad(d.getSeconds());
  }

  /**
   * Format a timestamp as HH:MM:SS.mmm (with milliseconds).
   * @param {Date|string|number} [date]
   * @returns {string}  e.g. "08:30:15.123"
   */
  function formatTimeMs(date) {
    var d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return "--:--:--.---";
    return (
      _pad(d.getHours()) +
      ":" +
      _pad(d.getMinutes()) +
      ":" +
      _pad(d.getSeconds()) +
      "." +
      _pad3(d.getMilliseconds())
    );
  }

  /**
   * Format a short chart label from a timestamp (MM:SS only).
   * @param {string} isoString
   * @returns {string}  e.g. "08:30"
   */
  function formatChartLabel(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.substring(0, 5);
    return _pad(d.getHours()) + ":" + _pad(d.getMinutes()) + ":" + _pad(d.getSeconds());
  }

  // ── Parsing ───────────────────────────────────────────────────

  /**
   * Parse an ISO 8601 string to a Date object.
   * Returns null if the string is invalid.
   * @param {string} isoString
   * @returns {Date|null}
   */
  function parseTimestamp(isoString) {
    if (typeof isoString !== "string" || isoString.trim() === "") return null;
    var d = new Date(isoString);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Elapsed / Mission Timer ───────────────────────────────────

  /**
   * Format elapsed milliseconds as HH:MM:SS.
   * @param {number} ms - Elapsed milliseconds
   * @returns {string}  e.g. "01:23:45"
   */
  function formatElapsed(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "00:00:00";
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    return _pad(h) + ":" + _pad(m) + ":" + _pad(s);
  }

  /**
   * Format elapsed milliseconds as a mission T+ display string.
   * @param {number} ms
   * @returns {string}  e.g. "Mission T+ 01:23:45"
   */
  function formatMissionTimer(ms) {
    return "Mission T+ " + formatElapsed(ms);
  }

  /**
   * Return a human-readable "time ago" string.
   * @param {number|string|Date} timestamp - Past time
   * @returns {string}  e.g. "3 seconds ago" or "just now"
   */
  function getRelativeTime(timestamp) {
    var past = new Date(timestamp);
    if (isNaN(past.getTime())) return "unknown";
    var diff = Math.floor((Date.now() - past.getTime()) / 1000);

    if (diff < 5)  return "just now";
    if (diff < 60) return diff + " seconds ago";
    var mins = Math.floor(diff / 60);
    if (mins < 60) return mins + " minute" + (mins > 1 ? "s" : "") + " ago";
    var hrs = Math.floor(mins / 60);
    return hrs + " hour" + (hrs > 1 ? "s" : "") + " ago";
  }

  /**
   * Calculate the time difference between two timestamps in seconds.
   * @param {string|Date} start
   * @param {string|Date} [end] - Defaults to now
   * @returns {number}
   */
  function secondsBetween(start, end) {
    var s = new Date(start);
    var e = end ? new Date(end) : new Date();
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.abs(e - s) / 1000;
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    getCurrentTimestamp: getCurrentTimestamp,
    getPCDate: getPCDate,
    getCurrentTimeString: getCurrentTimeString,
    getSecondsSinceMidnight: getSecondsSinceMidnight,
    formatForFilename: formatForFilename,
    formatTime: formatTime,
    formatTimeMs: formatTimeMs,
    formatChartLabel: formatChartLabel,
    parseTimestamp: parseTimestamp,
    formatElapsed: formatElapsed,
    formatMissionTimer: formatMissionTimer,
    getRelativeTime: getRelativeTime,
    secondsBetween: secondsBetween,
  };
})();
