/**
 * ORVIX Ground Control Software — Export Manager
 *
 * Purpose: Generates structured file exports for post-flight analysis.
 *          Exports telemetry log as CSV, captures chart canvases as a
 *          stacked composite PNG, and exports complete flight state (telemetry,
 *          command history, error codes) as JSON.
 *
 * Browser APIs: Blob API, URL.createObjectURL, HTMLCanvasElement.toBlob
 *
 * Dependencies: state.js, telemetry/logger.js
 *
 * @module export/export-manager
 */
"use strict";

const ExportManager = (function () {

  // ── Public API ────────────────────────────────────────────────

  /**
   * Export the entire telemetry history as a downloadable CSV file.
   */
  function exportTelemetryCSV() {
    const history = TelemetryLogger.getTelemetryHistory();
    if (history.length === 0) {
      alert("No telemetry data available to export. Connect telemetry first.");
      return;
    }

    const headers = CONFIG.EXPORT.CSV_HEADERS;
    const sep = CONFIG.EXPORT.CSV_SEPARATOR;

    // Build CSV content
    const rows = [headers.join(sep)];
    for (let i = 0; i < history.length; i++) {
      const row = _formatCSVRow(history[i]);
      rows.push(row);
    }

    const csvContent = rows.join("\n");
    const filename = _generateTimestampFilename(CONFIG.EXPORT.FILENAME_PREFIX_CSV, "csv");

    _createDownloadLink(csvContent, filename, "text/csv;charset=utf-8;");
    OrvixState.logCommand("EXPORT_CSV", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, filename);
    console.log("[Export] Telemetry CSV exported successfully: " + filename);
  }

  /**
   * Capture Chart.js canvases (all stacked or individual) and export
   * them as a PNG image file.
   *
   * @param {string} [chartType="all"] - "all", "altitude", "pressure", "temperature", "descent", "battery"
   */
  function exportGraphsPNG(chartType) {
    const type = chartType || "all";

    const canvasMap = {
      altitude: "chart-altitude",
      pressure: "chart-pressure",
      temperature: "chart-temperature",
      descent: "chart-descent-rate",
      battery: "chart-battery",
    };

    let canvasIds = [];
    if (type === "all") {
      canvasIds = [
        "chart-altitude",
        "chart-pressure",
        "chart-temperature",
        "chart-descent-rate",
        "chart-battery",
      ];
    } else if (canvasMap[type]) {
      canvasIds = [canvasMap[type]];
    } else {
      canvasIds = [type];
    }

    // Collect valid canvas elements
    const canvases = [];
    for (let i = 0; i < canvasIds.length; i++) {
      const canvas = document.getElementById(canvasIds[i]);
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        canvases.push(canvas);
      }
    }

    if (canvases.length === 0) {
      alert("No active graph visualisations found to export.");
      return;
    }

    try {
      let finalCanvas;

      if (canvases.length === 1) {
        // Draw single chart onto a dark background
        const sourceCanvas = canvases[0];
        finalCanvas = document.createElement("canvas");
        finalCanvas.width = sourceCanvas.width;
        finalCanvas.height = sourceCanvas.height;
        const ctx = finalCanvas.getContext("2d");
        ctx.fillStyle = "#0A0A0A";
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(sourceCanvas, 0, 0);
      } else {
        const padding = 16;
        // Use maximum width to avoid truncation
        const totalWidth = Math.max.apply(
          null,
          canvases.map(function (c) { return c.width; })
        );
        // Total height is the sum of heights plus standard margins
        const totalHeight = canvases.reduce(function (sum, c) {
          return sum + c.height + padding;
        }, 0) - padding;

        // Create a temporary off-screen canvas to assemble the composite
        finalCanvas = document.createElement("canvas");
        finalCanvas.width = totalWidth;
        finalCanvas.height = totalHeight;
        const ctx = finalCanvas.getContext("2d");

        // Draw dark background to match design theme
        ctx.fillStyle = "#0A0A0A";
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Draw each chart onto the composite canvas
        let yOffset = 0;
        for (let i = 0; i < canvases.length; i++) {
          const c = canvases[i];
          ctx.drawImage(c, 0, yOffset, c.width, c.height);
          yOffset += c.height + padding;
        }
      }

      // Convert to blob and download
      finalCanvas.toBlob(function (blob) {
        if (!blob) {
          console.error("[Export] Failed to render graph image.");
          return;
        }
        const filePrefix = type === "all" ? CONFIG.EXPORT.FILENAME_PREFIX_GRAPH : `mission_graph_${type}_`;
        const filename = _generateTimestampFilename(filePrefix, "png");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        OrvixState.logCommand("EXPORT_GRAPH", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, filename);
        console.log("[Export] Graphs PNG exported successfully: " + filename);
      }, "image/png");
    } catch (err) {
      console.error("[Export] Error exporting composite graphs:", err);
      alert("Failed to export graphs due to canvas render restrictions.");
    }
  }

  /**
   * Gather complete mission telemetry history, command logs,
   * error history, and metadata, and download as a single JSON file.
   */
  function exportMissionLog() {
    const state = OrvixState.getState();
    const summary = TelemetryLogger.getSessionSummary();

    const missionLog = {
      metadata: {
        missionStartTime: state.missionStartTime ? new Date(state.missionStartTime).toISOString() : null,
        exportTime: new Date().toISOString(),
        durationMs: summary.duration,
        finalMissionPhase: state.missionPhase,
        finalErrorCode: state.errorCodes.join(""),
      },
      summary: {
        packetsReceived: state.packetCount,
        gpsPointsLogged: state.gpsHistory.length,
        totalDistanceMeters: state.totalDistance,
      },
      commandHistory: state.commandHistory,
      telemetryHistory: state.telemetryHistory,
    };

    const jsonString = JSON.stringify(missionLog, null, 2);
    const filename = _generateTimestampFilename("mission_log_", "json");

    _createDownloadLink(jsonString, filename, "application/json;charset=utf-8;");
    OrvixState.logCommand("EXPORT_MISSION_LOG", CONFIG.COMMAND_STATUS.ACKNOWLEDGED, filename);
    console.log("[Export] Mission log JSON exported: " + filename);
  }

  // ── Private Helpers ───────────────────────────────────────────

  /**
   * Helper to format a single telemetry packet object into a CSV row.
   *
   * @param {Object} p - Telemetry packet
   * @returns {string} Comma-separated row string
   */
  function _formatCSVRow(p) {
    const sep = CONFIG.EXPORT.CSV_SEPARATOR;
    const errorCode = (OrvixState.get("errorCodes") || [0, 0, 0, 0]).join("");

    return [
      p.timestamp || "",
      p.packetId || 0,
      p.batteryVoltage || 0,
      p.altitude || 0,
      p.pressure || 0,
      p.temperature || 0,
      p.gpsLat || 0,
      p.gpsLon || 0,
      p.roll || 0,
      p.pitch || 0,
      p.yaw || 0,
      p.descentRate || 0,
      p.separationStatus || 0,
      p.parachuteStatus || 0,
      errorCode,
    ].join(sep);
  }

  /**
   * Generate a timestamped filename based on prefix and extension.
   * Format: prefix_YYYYMMDD_HHMMSS.extension
   *
   * @param {string} prefix
   * @param {string} extension
   * @returns {string} Filename string
   */
  function _generateTimestampFilename(prefix, extension) {
    const ts = TimeUtils.formatForFilename();
    return prefix + ts + "." + extension;
  }

  /**
   * Create a temporary anchor element and trigger file download.
   *
   * @param {string} content - String contents to download
   * @param {string} filename - Filename attribute
   * @param {string} mimeType - MIME type for Blob
   */
  function _createDownloadLink(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    exportTelemetryCSV: exportTelemetryCSV,
    exportGraphsPNG: exportGraphsPNG,
    exportMissionLog: exportMissionLog,
  };
})();
