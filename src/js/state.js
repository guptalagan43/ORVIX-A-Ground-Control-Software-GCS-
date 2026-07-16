/**
 * ORVIX Ground Control Software — State Management
 *
 * Purpose: Single source of truth for all live mission data.
 *          UI modules read from state; only parsers and command
 *          handlers write to state. Prevents charts, tables, and
 *          indicators from drifting out of sync.
 *
 * Dependencies: config.js
 *
 * @module state
 */
"use strict";

const OrvixState = (function () {
  // ── Private state object ──────────────────────────────────────

  /** @type {Object} Internal application state */
  let _state = _createDefaultState();

  /**
   * Build a fresh default state object.
   * @returns {Object} Default state
   */
  function _createDefaultState() {
    return {
      // --- Connection ---
      isConnected: false,
      port: null,
      reader: null,
      writer: null,

      // --- Telemetry ---
      telemetryHistory: [],
      currentPacket: null,
      packetCount: 0,
      packetsThisSecond: 0,
      packetRate: 0,

      // --- Graphs ---
      graphData: {
        labels: [],
        altitude: [],
        pressure: [],
        temperature: [],
        descentRate: [],
        batteryVoltage: [],
      },

      // --- GPS ---
      gpsHistory: [],
      currentGps: null,
      totalDistance: 0,

      // --- Error Codes ---
      errorCodes: [0, 0, 0, 0],
      previousErrorCodes: [0, 0, 0, 0],

      // --- Mission ---
      missionPhase: CONFIG.MISSION_PHASES.PRE_FLIGHT,
      separationConfirmed: false,
      separationCommandTime: null,
      parachuteDeployed: false,

      // --- Commands ---
      commandHistory: [],
      commandStatus: {
        separation: CONFIG.COMMAND_STATUS.STANDBY,
        parachute: CONFIG.COMMAND_STATUS.STANDBY,
        redundant: CONFIG.COMMAND_STATUS.STANDBY,
      },

      // --- Video ---
      videoStreamActive: false,

      // --- UI ---
      telemetryStreaming: false,
      missionStartTime: null,
      lastUpdateTime: null,

      // --- Listeners ---
      _listeners: [],
    };
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Return a shallow copy of the current state.
   * @returns {Object} Current state snapshot
   */
  function getState() {
    return Object.assign({}, _state);
  }

  /**
   * Get a specific property from state.
   * @param {string} key - State property name
   * @returns {*} Value of the property
   */
  function get(key) {
    return _state[key];
  }

  /**
   * Merge partial updates into state. Does not mutate—creates
   * a new object for any changed top-level key.
   * @param {Object} updates - Key/value pairs to merge
   */
  function setState(updates) {
    const prev = _state;
    _state = Object.assign({}, _state, updates);
    _notifyListeners(prev, _state);
  }

  /**
   * Subscribe to state changes.
   * @param {Function} listener - Called with (prevState, newState)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(listener) {
    _state._listeners.push(listener);
    return function unsubscribe() {
      const idx = _state._listeners.indexOf(listener);
      if (idx > -1) _state._listeners.splice(idx, 1);
    };
  }

  /**
   * Notify all registered listeners of a state change.
   * @param {Object} prev - Previous state
   * @param {Object} next - New state
   */
  function _notifyListeners(prev, next) {
    const listeners = next._listeners || [];
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](prev, next);
      } catch (err) {
        console.error("[State] Listener error:", err);
      }
    }
  }

  /**
   * Reset telemetry, GPS, graphs, and counters.
   * Keeps connection and configuration intact.
   */
  function resetTelemetry() {
    setState({
      telemetryHistory: [],
      currentPacket: null,
      packetCount: 0,
      packetsThisSecond: 0,
      packetRate: 0,
      graphData: {
        labels: [],
        altitude: [],
        pressure: [],
        temperature: [],
        descentRate: [],
        batteryVoltage: [],
      },
      gpsHistory: [],
      currentGps: null,
      totalDistance: 0,
      errorCodes: [0, 0, 0, 0],
      previousErrorCodes: [0, 0, 0, 0],
      commandHistory: [],
      lastUpdateTime: null,
    });
  }

  /**
   * Add a parsed telemetry packet to history and update current.
   * Enforces MAX_PACKET_HISTORY to prevent memory growth.
   * @param {Object} packet - Parsed telemetry packet
   */
  function addTelemetryPacket(packet) {
    if (!packet) return;

    const history = _state.telemetryHistory.slice();
    history.push(packet);

    // Enforce bounded history
    if (history.length > CONFIG.TELEMETRY.MAX_PACKET_HISTORY) {
      history.shift();
    }

    // Update graph data arrays (rolling window)
    const gd = _cloneGraphData();
    const label = packet.timestamp || new Date().toISOString();
    gd.labels.push(label);
    gd.altitude.push(packet.altitude);
    gd.pressure.push(packet.pressure);
    gd.temperature.push(packet.temperature);
    gd.descentRate.push(packet.descentRate);
    gd.batteryVoltage.push(packet.batteryVoltage);

    // Trim to max graph points
    const max = CONFIG.GRAPH.MAX_POINTS;
    if (gd.labels.length > max) {
      gd.labels = gd.labels.slice(-max);
      gd.altitude = gd.altitude.slice(-max);
      gd.pressure = gd.pressure.slice(-max);
      gd.temperature = gd.temperature.slice(-max);
      gd.descentRate = gd.descentRate.slice(-max);
      gd.batteryVoltage = gd.batteryVoltage.slice(-max);
    }

    setState({
      telemetryHistory: history,
      currentPacket: packet,
      packetCount: _state.packetCount + 1,
      packetsThisSecond: _state.packetsThisSecond + 1,
      graphData: gd,
      lastUpdateTime: Date.now(),
    });
  }

  /**
   * Clone the graph data object to avoid mutation.
   * @returns {Object} Deep-ish copy of graphData
   */
  function _cloneGraphData() {
    const gd = _state.graphData;
    return {
      labels: gd.labels.slice(),
      altitude: gd.altitude.slice(),
      pressure: gd.pressure.slice(),
      temperature: gd.temperature.slice(),
      descentRate: gd.descentRate.slice(),
      batteryVoltage: gd.batteryVoltage.slice(),
    };
  }

  /**
   * Add a GPS coordinate to history.
   * Filters invalid (0,0) coordinates and speed outliers.
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lon - Longitude in decimal degrees
   */
  function addGpsPoint(lat, lon) {
    // Skip invalid coordinates
    if (lat === 0 && lon === 0) return;
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return;

    const point = { lat: lat, lon: lon, timestamp: Date.now() };
    const history = _state.gpsHistory.slice();

    // Filter speed outliers if we have previous points
    if (history.length > 0) {
      const prev = history[history.length - 1];
      const dist = _haversineDistance(prev.lat, prev.lon, lat, lon);
      const dt = (point.timestamp - prev.timestamp) / 1000;
      if (dt > 0) {
        const speed = dist / dt;
        if (speed > CONFIG.MAP.MAX_GROUND_SPEED_MS) {
          return; // Outlier, skip
        }
      }
    }

    history.push(point);

    // Enforce GPS history limit
    if (history.length > CONFIG.MAP.MAX_GPS_HISTORY) {
      history.shift();
    }

    // Calculate cumulative distance
    let totalDist = 0;
    for (let i = 1; i < history.length; i++) {
      totalDist += _haversineDistance(
        history[i - 1].lat,
        history[i - 1].lon,
        history[i].lat,
        history[i].lon
      );
    }

    setState({
      gpsHistory: history,
      currentGps: point,
      totalDistance: totalDist,
    });
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula.
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in meters
   */
  function _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Update the 4-digit error code array.
   * @param {number[]} codes - Array of 4 error digits (0 or 1)
   */
  function updateErrorCodes(codes) {
    if (!Array.isArray(codes) || codes.length !== CONFIG.ERROR.DIGIT_COUNT) {
      return;
    }
    setState({
      previousErrorCodes: _state.errorCodes.slice(),
      errorCodes: codes.slice(),
    });
  }

  /**
   * Add a command to the command history log.
   * @param {string} command - Command identifier
   * @param {string} status - Command status
   * @param {string} [message] - Optional message
   */
  function logCommand(command, status, message) {
    const entry = {
      command: command,
      status: status,
      message: message || "",
      timestamp: new Date().toISOString(),
    };
    const history = _state.commandHistory.slice();
    history.push(entry);
    setState({ commandHistory: history });
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    getState: getState,
    get: get,
    setState: setState,
    subscribe: subscribe,
    resetTelemetry: resetTelemetry,
    addTelemetryPacket: addTelemetryPacket,
    addGpsPoint: addGpsPoint,
    updateErrorCodes: updateErrorCodes,
    logCommand: logCommand,
  };
})();
