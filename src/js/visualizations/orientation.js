/**
 * ORVIX Ground Control Software — Orientation Visualization
 *
 * Purpose: Renders pitch, roll, and yaw attitude data on a 2D canvas
 *          as an aerospace-grade primary flight display (PFD) / artificial
 *          horizon. Includes pitch ladder, roll scale, static aircraft
 *          reference symbol, and a compass card for heading.
 *
 * Design: High-performance 2D Canvas drawing, zero-jitter damping
 *         interpolation, dark-theme styling, and distinct cardinal compass.
 *
 * Dependencies: config.js, state.js, utils/dom.js
 *
 * @module visualizations/orientation
 */
"use strict";

const OrientationManager = (function () {
  // ── Private Variables ─────────────────────────────────────────

  /** @type {HTMLCanvasElement|null} */
  let _canvas = null;

  /** @type {CanvasRenderingContext2D|null} */
  let _ctx = null;

  /** Damping factor for smooth interpolation (0 = none, 1 = freeze) */
  const DAMPING = 0.85;

  /** Current smoothed values to prevent visual jitter */
  const _smooth = {
    roll: 0,
    pitch: 0,
    yaw: 0,
  };

  /** Center coords and dimensions of instrument */
  let _cx = 140;
  let _cy = 140;
  let _radius = 110;

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialise the artificial horizon canvas.
   *
   * @param {string} [canvasId='orientation-canvas']
   */
  function initializeOrientation(canvasId) {
    const id = canvasId || "orientation-canvas";
    _canvas = document.getElementById(id);
    if (!_canvas) {
      console.warn("[Orientation] Canvas element not found: " + id);
      return;
    }

    _ctx = _canvas.getContext("2d");
    _cx = _canvas.width / 2;
    _cy = _canvas.height / 2 - 10; // Shift up slightly to leave space for heading card
    _radius = (_canvas.width * 0.72) / 2;

    _smooth.roll = 0;
    _smooth.pitch = 0;
    _smooth.yaw = 0;

    // Draw initial level horizon
    clearOrientation();
    console.log("[Orientation] Artificial horizon canvas initialized.");
  }

  /**
   * Update orientation values and redraw canvas. Applies damping.
   *
   * @param {Object} packet - Current telemetry packet
   */
  function updateOrientation(packet) {
    if (!_ctx || !_canvas || !packet) return;

    // Extract angles and validate ranges
    const rawRoll = _clamp(packet.roll || 0, -180, 180);
    const rawPitch = _clamp(packet.pitch || 0, -90, 90);
    const rawYaw = (packet.yaw || 0) % 360;

    // Damped interpolation to smooth out noise/vibration
    _smooth.roll = _smooth.roll * DAMPING + rawRoll * (1 - DAMPING);
    _smooth.pitch = _smooth.pitch * DAMPING + rawPitch * (1 - DAMPING);

    // Yaw interpolation needs wrapping to handle 359 -> 0 transitions correctly
    _smooth.yaw = _interpolateAngle(_smooth.yaw, rawYaw, 1 - DAMPING);

    // Redraw entire instrument
    _draw();
  }

  /**
   * Reset instrument to 0° roll, 0° pitch, 0° yaw.
   */
  function clearOrientation() {
    _smooth.roll = 0;
    _smooth.pitch = 0;
    _smooth.yaw = 0;
    _draw();
  }

  // ── Private Drawing Logic ─────────────────────────────────────

  /**
   * Perform full draw cycle of artificial horizon instrument.
   */
  function _draw() {
    if (!_ctx || !_canvas) return;

    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;

    // 1. Clear background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0A0A0A"; // Match panel background
    ctx.fillRect(0, 0, w, h);

    // 2. Render Horizon Sphere (with clipping mask)
    ctx.save();
    ctx.beginPath();
    ctx.arc(_cx, _cy, _radius, 0, Math.PI * 2);
    ctx.clip(); // Mask sky/ground within circular dial

    _drawSkyGround(ctx);
    _drawPitchLadder(ctx);

    ctx.restore(); // Remove clipping mask

    // 3. Render dial borders and roll scale (static marks outside)
    _drawRollScale(ctx);

    // 4. Draw static aircraft symbol in front
    _drawAircraftSymbol(ctx);

    // 5. Draw Yaw Compass Card below
    _drawCompassCard(ctx);
  }

  /**
   * Draw sky and ground layers rotated and shifted by pitch/roll.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function _drawSkyGround(ctx) {
    const pitchPx = _smooth.pitch * 2.0; // Scale: 2px per degree of pitch
    const rollRad = (_smooth.roll * Math.PI) / 180;

    ctx.save();
    ctx.translate(_cx, _cy);
    ctx.rotate(-rollRad); // Roll rotation
    ctx.translate(0, pitchPx); // Pitch shift

    // Draw Sky (light grey in B&W theme)
    ctx.fillStyle = "#222222";
    ctx.fillRect(-_radius * 2, -_radius * 2, _radius * 4, _radius * 2);

    // Draw Ground (solid black)
    ctx.fillStyle = "#020202";
    ctx.fillRect(-_radius * 2, 0, _radius * 4, _radius * 2);

    // Draw dividing white horizon line
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-_radius * 1.5, 0);
    ctx.lineTo(_radius * 1.5, 0);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw pitch lines and numerals on the moving sphere.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function _drawPitchLadder(ctx) {
    const pitchPx = _smooth.pitch * 2.0;
    const rollRad = (_smooth.roll * Math.PI) / 180;

    ctx.save();
    ctx.translate(_cx, _cy);
    ctx.rotate(-rollRad);
    ctx.translate(0, pitchPx);

    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.lineWidth = 1;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw ladder rungs every 10 degrees (from -50 to 50)
    for (let deg = -50; deg <= 50; deg += 10) {
      if (deg === 0) continue; // Horizon line already drawn

      const y = -deg * 2.0;
      const width = deg % 20 === 0 ? 40 : 25; // Alternate line lengths

      ctx.beginPath();
      ctx.moveTo(-width / 2, y);
      ctx.lineTo(width / 2, y);
      ctx.stroke();

      // Add little ticks at the end of rungs
      const tickDir = deg > 0 ? 4 : -4; // Ticks point toward horizon
      ctx.beginPath();
      ctx.moveTo(-width / 2, y);
      ctx.lineTo(-width / 2, y + tickDir);
      ctx.moveTo(width / 2, y);
      ctx.lineTo(width / 2, y + tickDir);
      ctx.stroke();

      // Numeric labels on sides
      ctx.fillText(Math.abs(deg).toString(), -width / 2 - 12, y);
      ctx.fillText(Math.abs(deg).toString(), width / 2 + 12, y);
    }

    ctx.restore();
  }

  /**
   * Draw static roll scale ticks and a moving indicator pointer.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function _drawRollScale(ctx) {
    // Draw static outer dial ring
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(_cx, _cy, _radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw static tick marks for 0, 30, 45, 60 degrees of roll
    const ticks = [-60, -45, -30, 0, 30, 45, 60];
    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "8px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    for (let i = 0; i < ticks.length; i++) {
      const angleRad = ((ticks[i] - 90) * Math.PI) / 180;
      const length = ticks[i] === 0 ? 8 : 4;

      const x1 = _cx + Math.cos(angleRad) * _radius;
      const y1 = _cy + Math.sin(angleRad) * _radius;
      const x2 = _cx + Math.cos(angleRad) * (_radius - length);
      const y2 = _cy + Math.sin(angleRad) * (_radius - length);

      ctx.lineWidth = ticks[i] === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw pointer at top that rotates by roll
    const rollRad = (_smooth.roll * Math.PI) / 180;
    ctx.save();
    ctx.translate(_cx, _cy);
    ctx.rotate(-rollRad); // Counter-rotation for the pointer

    // Draw moving pointer triangle
    ctx.fillStyle = "#FFD600"; // Accent Yellow
    ctx.beginPath();
    ctx.moveTo(0, -_radius + 2);
    ctx.lineTo(-6, -_radius + 12);
    ctx.lineTo(6, -_radius + 12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw stationary aircraft reference symbol in the center.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function _drawAircraftSymbol(ctx) {
    ctx.strokeStyle = "#00E676"; // Neon green accent for high visibility
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.beginPath();
    // Left wing
    ctx.moveTo(_cx - 45, _cy);
    ctx.lineTo(_cx - 20, _cy);
    // Left elbow/prop
    ctx.lineTo(_cx - 15, _cy + 8);
    // Center point dot
    ctx.moveTo(_cx, _cy);
    ctx.arc(_cx, _cy, 1.5, 0, Math.PI * 2);
    // Right elbow/prop
    ctx.moveTo(_cx + 15, _cy + 8);
    ctx.lineTo(_cx + 20, _cy);
    // Right wing
    ctx.lineTo(_cx + 45, _cy);

    ctx.stroke();
  }

  /**
   * Draw yaw compass card at the bottom of the canvas.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function _drawCompassCard(ctx) {
    const yaw = _smooth.yaw;
    const compassY = _canvas.height - 30;
    const width = _canvas.width - 40;

    // Draw compass card background box
    ctx.fillStyle = "#111111";
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(_cx - width / 2, compassY, width, 24);
    ctx.fill();
    ctx.stroke();

    // Clip the ticks within the box bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(_cx - width / 2 + 2, compassY + 1, width - 4, 22);
    ctx.clip();

    // Draw heading ticks and letters
    const degPerPx = 0.5; // Scale: 0.5 deg per pixel
    const centerOffset = yaw / degPerPx;

    ctx.fillStyle = "#B0B0B0";
    ctx.strokeStyle = "#555555";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw ticks from -180px to +180px relative to center
    for (let px = -150; px <= 150; px += 10) {
      // Find degree corresponding to this pixel
      const angle = (yaw + px * degPerPx + 360) % 360;
      const x = _cx + px;

      if (angle % 30 === 0) {
        // Major ticks & labels
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, compassY + 2);
        ctx.lineTo(x, compassY + 8);
        ctx.stroke();

        let label = (angle / 10).toString(); // Heading code, e.g. 03, 09, 36
        if (angle === 0) label = "N";
        if (angle === 90) label = "E";
        if (angle === 180) label = "S";
        if (angle === 270) label = "W";

        if (label === "N" || label === "S" || label === "E" || label === "W") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(label, x, compassY + 16);
        } else {
          ctx.fillStyle = "#888888";
          ctx.fillText(label, x, compassY + 15);
        }
      } else if (angle % 10 === 0) {
        // Minor ticks
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, compassY + 2);
        ctx.lineTo(x, compassY + 6);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw center index pointer (Yellow triangle pointing down)
    ctx.fillStyle = "#FFD600";
    ctx.beginPath();
    ctx.moveTo(_cx, compassY);
    ctx.lineTo(_cx - 5, compassY - 6);
    ctx.lineTo(_cx + 5, compassY - 6);
    ctx.closePath();
    ctx.fill();

    // Numeric readout in box center
    ctx.fillStyle = "#000000";
    ctx.fillRect(_cx - 18, compassY - 14, 36, 12);
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 1;
    ctx.strokeRect(_cx - 18, compassY - 14, 36, 12);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(yaw).toString().padStart(3, "0") + "\u00b0", _cx, compassY - 8);
  }

  /**
   * Custom angular interpolation to handle 0/360 degree wrap.
   */
  function _interpolateAngle(current, target, step) {
    let diff = target - current;

    // Wrap diff to range [-180, 180]
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    return (current + diff * step + 360) % 360;
  }

  /**
   * Keep value strictly within min and max.
   */
  function _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeOrientation: initializeOrientation,
    updateOrientation: updateOrientation,
    clearOrientation: clearOrientation,
  };
})();
