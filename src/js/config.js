/**
 * ORVIX Ground Control Software — Configuration
 *
 * Purpose: Central location for all application constants,
 *          thresholds, packet field mappings, and UI settings.
 *          All magic numbers and configurable values live here.
 *
 * Dependencies: None (loaded first)
 *
 * @module config
 */
"use strict";

const CONFIG = Object.freeze({

  // ===== Serial Communication =====
  SERIAL: {
    BAUD_RATE: 115200,
    DATA_BITS: 8,
    STOP_BITS: 1,
    PARITY: "none",
    FLOW_CONTROL: "none",
    BUFFER_SIZE: 256,
  },

  // ===== Telemetry =====
  TELEMETRY: {
    PACKET_DELIMITER: ",",
    EXPECTED_FIELD_COUNT: 14,
    MAX_PACKET_HISTORY: 10000,
    REFRESH_RATE_HZ: 10,
    LINE_DELIMITER: "\n",
  },

  // ===== Packet Field Indices =====
  // Order: packetId, timestamp, batteryVoltage, altitude, pressure,
  //        temperature, gpsLat, gpsLon, roll, pitch, yaw,
  //        descentRate, separationStatus, parachuteStatus
  PACKET_FIELDS: {
    PACKET_ID: 0,
    TIMESTAMP: 1,
    BATTERY_VOLTAGE: 2,
    ALTITUDE: 3,
    PRESSURE: 4,
    TEMPERATURE: 5,
    GPS_LAT: 6,
    GPS_LON: 7,
    ROLL: 8,
    PITCH: 9,
    YAW: 10,
    DESCENT_RATE: 11,
    SEPARATION_STATUS: 12,
    PARACHUTE_STATUS: 13,
  },

  // ===== Graphs =====
  GRAPH: {
    MAX_POINTS: 60,
    UPDATE_INTERVAL_MS: 100,
    ANIMATION_DURATION_MS: 100,
    COLORS: {
      altitude: "#2979FF",
      pressure: "#AF52DE",
      temperature: "#FF9500",
      descentRate: "#FF3B30",
      batteryVoltage: "#00E676",
    },
  },

  // ===== GPS Map =====
  MAP: {
    DEFAULT_LAT: 0,
    DEFAULT_LON: 0,
    DEFAULT_ZOOM: 13,
    MAX_GPS_HISTORY: 500,
    TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    TILE_ATTRIBUTION:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    TRAJECTORY_COLOR: "#2979FF",
    TRAJECTORY_WEIGHT: 3,
    TRAJECTORY_OPACITY: 0.8,
    MAX_GROUND_SPEED_MS: 100,
  },

  // ===== Error Code System =====
  ERROR: {
    DIGIT_COUNT: 4,
    // Digit indices
    DESCENT_RATE: 0,
    GPS_AVAILABILITY: 1,
    PAYLOAD_SEPARATION: 2,
    EMERGENCY_PARACHUTE: 3,
    // Thresholds
    DESCENT_RATE_MIN: 8.0,
    DESCENT_RATE_MAX: 10.0,
    // Separation confirmation timeout
    SEPARATION_TIMEOUT_MS: 5000,
  },

  // ===== Validation Ranges =====
  VALIDATION: {
    ALTITUDE_MIN: -500,
    ALTITUDE_MAX: 50000,
    PRESSURE_MIN: 0,
    PRESSURE_MAX: 1100,
    TEMPERATURE_MIN: -100,
    TEMPERATURE_MAX: 100,
    BATTERY_MIN: 0,
    BATTERY_MAX: 30,
    GPS_LAT_MIN: -90,
    GPS_LAT_MAX: 90,
    GPS_LON_MIN: -180,
    GPS_LON_MAX: 180,
    ROLL_MIN: -360,
    ROLL_MAX: 360,
    PITCH_MIN: -90,
    PITCH_MAX: 90,
    YAW_MIN: 0,
    YAW_MAX: 360,
    DESCENT_RATE_MIN: -100,
    DESCENT_RATE_MAX: 100,
  },

  // ===== Mission Phases =====
  MISSION_PHASES: {
    PRE_FLIGHT: "PRE_FLIGHT",
    ASCENT: "ASCENT",
    DESCENT: "DESCENT",
    LANDED: "LANDED",
  },

  // ===== Command Bytes =====
  COMMANDS: {
    MANUAL_SEPARATION: "CMD:SEP\n",
    EMERGENCY_PARACHUTE: "CMD:CHUTE\n",
    REDUNDANT_ACTIVATION: "CMD:REDUN\n",
    SYNC_TIME: "CMD:SYNC:",
    RESET_PACKETS: "CMD:RESET\n",
  },

  // ===== Command Status =====
  COMMAND_STATUS: {
    STANDBY: "STANDBY",
    PENDING: "PENDING",
    SENT: "SENT",
    ACKNOWLEDGED: "ACKNOWLEDGED",
    FAILED: "FAILED",
  },

  // ===== UI Timing =====
  UI: {
    UPDATE_INTERVAL_MS: 100,
    FOOTER_CLOCK_INTERVAL_MS: 1000,
    PACKET_RATE_WINDOW_MS: 1000,
    STATUS_MESSAGE_DURATION_MS: 3000,
    DEBOUNCE_MS: 250,
  },

  // ===== Export =====
  EXPORT: {
    CSV_SEPARATOR: ",",
    CSV_HEADERS: [
      "timestamp",
      "packet_id",
      "battery_voltage",
      "altitude",
      "pressure",
      "temperature",
      "gps_lat",
      "gps_lon",
      "roll",
      "pitch",
      "yaw",
      "descent_rate",
      "separation_status",
      "parachute_status",
      "error_code",
    ],
    FILENAME_PREFIX_CSV: "mission_data_",
    FILENAME_PREFIX_GRAPH: "mission_graphs_",
  },

  // ===== Telemetry Simulator =====
  SIMULATOR: {
    ENABLED: false,
    PACKET_INTERVAL: 100,     // ms between packets (10 Hz)
    LAUNCH_LAT: 26.9124,      // Default launch latitude (Jaipur)
    LAUNCH_LON: 75.7873,      // Default launch longitude
    MAX_ALTITUDE: 3000,       // Apogee altitude in meters
    ASCENT_RATE: 40,          // m/s during ascent
    DESCENT_RATE_NORMAL: 9,   // m/s during descent
    BATTERY_START: 4.2,       // Starting voltage
    BATTERY_END: 3.7,         // Ending voltage
    TEMPERATURE_BASE: 25,     // °C at sea level
    PRESSURE_BASE: 1013.25,   // hPa at sea level
  },
});
