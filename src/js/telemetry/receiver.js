/**
 * ORVIX Ground Control Software — Telemetry Receiver
 * 
 * Purpose: Manages Web Serial API connection to the microcontroller.
 *          Opens/closes serial port, reads incoming data stream,
 *          and passes raw strings to the parser.
 * 
 * Dependencies: config.js, state.js, telemetry/parser.js
 * 
 * @module telemetry/receiver
 */
"use strict";

// Phase 2: Web Serial API connection and data reading
