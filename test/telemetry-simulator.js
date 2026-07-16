/**
 * ORVIX Ground Control Software — Telemetry Simulator
 *
 * Purpose: Generates realistic dummy telemetry packets for testing
 *          and development. Simulates normal flight, fault conditions,
 *          GPS loss, and parameter excursions.
 *
 * Usage: Include this script and call startSimulation() to begin
 *        generating dummy packets at 10 Hz.
 *
 * Parameter Ranges:
 *   - Altitude: 0–3000 m (ascent/descent profile)
 *   - Pressure: 700–1013 hPa (inversely correlated with altitude)
 *   - Temperature: −10 to 35 °C
 *   - GPS: Launch coordinates + random walk
 *   - Descent Rate: 8–10 m/s (normal), occasional excursions
 *
 * @module test/telemetry-simulator
 */
"use strict";

const TelemetrySimulator = (function () {
  // ── Simulation States ─────────────────────────────────────────

  let _intervalId = null;
  let _packetId = 1000;

  // Flight simulation state variables
  let _altitude = 0;
  let _batteryVoltage = 4.2;
  let _gpsLat = 26.9124; // Launch coordinates (Jaipur)
  let _gpsLon = 75.7873;
  let _roll = 0;
  let _pitch = 0;
  let _yaw = 0;
  let _descentRate = 0;

  let _phaseTicks = 0;
  let _missionPhase = "PRE_FLIGHT"; // PRE_FLIGHT, ASCENT, APOGEE, DESCENT, LANDED

  // Active faults (injected via UI or console)
  const _activeFaults = {
    descent_rate_high: false,
    gps_loss: false,
    separation_failed: false,
    parachute_deployed: false,
  };

  // ── Public API ────────────────────────────────────────────────

  /**
   * Start the simulation timer loop.
   *
   * @param {number} [intervalMs=100] - Interval between packets (defaults to 10Hz)
   * @param {Function} [onPacketCallback] - Called on each packet generation
   * @returns {number} Interval ID
   */
  function startSimulation(intervalMs, onPacketCallback) {
    if (_intervalId !== null) return _intervalId;

    const rate = intervalMs || (CONFIG.SIMULATOR ? CONFIG.SIMULATOR.PACKET_INTERVAL : 100);
    resetSimulation();

    _intervalId = setInterval(function () {
      _simulateMissionPhase();

      // Generate packet and notify subscriber
      const packet = _generatePacket();
      _packetId++;

      if (typeof onPacketCallback === "function") {
        onPacketCallback(packet);
      }
    }, rate);

    console.log("[Simulator] Simulation started at " + (1000 / rate) + " Hz.");
    return _intervalId;
  }

  /**
   * Stop the active simulation interval.
   */
  function stopSimulation() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
      console.log("[Simulator] Simulation stopped.");
    }
  }

  /**
   * Reset all flight telemetry variables to pre-flight startup states.
   */
  function resetSimulation() {
    _packetId = 1000;
    _altitude = 0;
    _batteryVoltage = 4.2;
    _gpsLat = (CONFIG.SIMULATOR ? CONFIG.SIMULATOR.LAUNCH_LAT : 26.9124);
    _gpsLon = (CONFIG.SIMULATOR ? CONFIG.SIMULATOR.LAUNCH_LON : 75.7873);
    _roll = 0;
    _pitch = 0;
    _yaw = 0;
    _descentRate = 0;

    _phaseTicks = 0;
    _missionPhase = "PRE_FLIGHT";

    // Clear any active faults
    for (const key in _activeFaults) {
      if (_activeFaults.hasOwnProperty(key)) {
        _activeFaults[key] = false;
      }
    }

    console.log("[Simulator] Simulation parameters reset.");
  }

  /**
   * Inject or clear specific flight fault conditions.
   *
   * @param {string} faultType - 'descent_rate_high', 'gps_loss', 'separation_failed', 'parachute_deployed'
   * @param {boolean} [active=true]
   */
  function injectFault(faultType, active) {
    const isState = (active === undefined) ? true : active;
    if (_activeFaults.hasOwnProperty(faultType)) {
      _activeFaults[faultType] = isState;
      console.warn(`[Simulator] Fault condition ${faultType} set to ${isState}`);
    }
  }

  // ── Private Simulation Logic ──────────────────────────────────

  /**
   * Simulates the flight profile state machine.
   * Updates coordinates, descent/ascent rate, and altitudes.
   */
  function _simulateMissionPhase() {
    _phaseTicks++;
    const S = CONFIG.SIMULATOR || {
      MAX_ALTITUDE: 3000,
      ASCENT_RATE: 40,
      DESCENT_RATE_NORMAL: 9
    };

    switch (_missionPhase) {
      case "PRE_FLIGHT":
        _altitude = 0;
        _descentRate = 0;
        // Wait 50 ticks (5 seconds at 10Hz) before launch
        if (_phaseTicks > 50) {
          _missionPhase = "ASCENT";
          _phaseTicks = 0;
          console.log("[Simulator] LAUNCH DETECTED — Transitioning to ASCENT");
        }
        break;

      case "ASCENT":
        // Increase altitude at designated rate with small noise
        const asc = S.ASCENT_RATE / 10; // Rate per tick (at 10Hz)
        _altitude += asc + (Math.random() - 0.5) * 2;
        _descentRate = -asc; // Negative descent means ascent

        if (_altitude >= S.MAX_ALTITUDE) {
          _altitude = S.MAX_ALTITUDE;
          _missionPhase = "APOGEE";
          _phaseTicks = 0;
          console.log("[Simulator] APOGEE REACHED — Transitioning to APOGEE");
        }
        break;

      case "APOGEE":
        _descentRate = 0;
        // Hover at apogee for 2 seconds (20 ticks) before nose dive
        if (_phaseTicks > 20) {
          _missionPhase = "DESCENT";
          _phaseTicks = 0;
          console.log("[Simulator] PAYLOAD DESCENT START — Transitioning to DESCENT");
        }
        break;

      case "DESCENT":
        // Decrease altitude based on normal rate
        const desc = _activeFaults.descent_rate_high ? 15 : S.DESCENT_RATE_NORMAL;
        const tickDesc = desc / 10;
        _altitude -= tickDesc + (Math.random() - 0.5) * 0.5;
        _descentRate = desc;

        if (_altitude <= 0) {
          _altitude = 0;
          _missionPhase = "LANDED";
          _phaseTicks = 0;
          console.log("[Simulator] PAYLOAD TOUCHDOWN — Transitioning to LANDED");
        }
        break;

      case "LANDED":
        _altitude = 0;
        _descentRate = 0;
        break;

      default:
        _missionPhase = "PRE_FLIGHT";
        break;
    }
  }

  /**
   * Generates a parsed packet object with realistic simulated values.
   *
   * @returns {Object} Structured telemetry packet
   */
  function _generatePacket() {
    // 1. Calculate pressure and temperature based on altitude
    const pressure = _calculatePressure(_altitude);
    const temperature = _calculateTemperature(_altitude);

    // 2. Battery discharge (slow drop + random noise)
    _batteryVoltage -= 0.0001; // Tiny discharge per tick
    if (_batteryVoltage < 3.3) _batteryVoltage = 3.3; // Min voltage
    const noisyBattery = _batteryVoltage + (Math.random() - 0.5) * 0.02;

    // 3. Coordinate movement (simulated GPS random walk during descent)
    if (!_activeFaults.gps_loss) {
      if (_missionPhase === "DESCENT") {
        // Drift slightly due to wind during descent
        _gpsLat += (Math.random() - 0.4) * 0.0001;
        _gpsLon += (Math.random() - 0.4) * 0.0001;
      }
    }

    // 4. Orientation drift (slow rotation)
    _roll = (_roll + 5 + Math.random() * 2) % 360;
    _pitch = Math.sin(_packetId * 0.05) * 20; // Oscillate between -20 and 20
    _yaw = (_yaw + 1 + Math.random()) % 360;

    // 5. Build telemetry packet fields
    const packet = {
      packetId: _packetId,
      timestamp: new Date().toISOString(),
      batteryVoltage: Number(noisyBattery.toFixed(2)),
      altitude: Number(_altitude.toFixed(1)),
      pressure: Number(pressure.toFixed(2)),
      temperature: Number(temperature.toFixed(1)),
      gpsLat: _activeFaults.gps_loss ? 0 : Number(_gpsLat.toFixed(6)),
      gpsLon: _activeFaults.gps_loss ? 0 : Number(_gpsLon.toFixed(6)),
      roll: Number(_roll.toFixed(1)),
      pitch: Number(_pitch.toFixed(1)),
      yaw: Number(_yaw.toFixed(1)),
      descentRate: Number(_descentRate.toFixed(1)),
      separationStatus: _activeFaults.separation_failed ? 1 : (_missionPhase === "DESCENT" || _missionPhase === "LANDED" ? 1 : 0),
      parachuteStatus: _activeFaults.parachute_deployed ? 1 : 0,
    };

    return packet;
  }

  /**
   * Barometric formula simplified: pressure decreases ~12 hPa per 100m.
   */
  function _calculatePressure(alt) {
    const P0 = 1013.25;
    return P0 * Math.pow(1 - (0.0065 * alt) / 288.15, 5.255);
  }

  /**
   * Lapse rate formula: Temperature drops ~6.5°C per 1000m altitude.
   */
  function _calculateTemperature(alt) {
    const baseT = 25.0;
    return baseT - (alt * 0.0065);
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    startSimulation: startSimulation,
    stopSimulation: stopSimulation,
    resetSimulation: resetSimulation,
    injectFault: injectFault,
  };
})();
