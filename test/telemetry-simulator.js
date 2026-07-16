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

// Phase 2+: Telemetry simulation logic
