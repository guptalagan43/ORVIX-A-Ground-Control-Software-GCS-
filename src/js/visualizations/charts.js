/**
 * ORVIX Ground Control Software — Charts Manager
 *
 * Purpose: Manages 5 real-time Chart.js graphs (Altitude, Pressure,
 *          Temperature, Descent Rate, Battery Voltage) on their respective
 *          HTML5 canvas elements. Handles initialization, incremental updates,
 *          clearing, and destruction of chart instances.
 *
 * Charts are configured using the design.md guidelines:
 *  - Dark mode gridlines (rgba(255, 255, 255, 0.05))
 *  - Custom neon/vibrant line colors
 *  - Point radiuses hidden by default (radius: 0) for sleek aerospace theme
 *  - Chart updates use 'none' mode for performance/60 FPS rendering
 *
 * Dependencies: config.js, state.js, Chart.js (CDN)
 *
 * @module visualizations/charts
 */
"use strict";

const ChartsManager = (function () {

  // ── Private Chart References ──────────────────────────────────

  /** @type {Object} References to Chart.js instances */
  const _charts = {
    altitude: null,
    pressure: null,
    temperature: null,
    descentRate: null,
    battery: null,
  };

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialize all 5 real-time line charts on the canvases.
   */
  function initializeCharts() {
    // Clean up any existing instances first
    destroyCharts();

    const C = CONFIG.GRAPH;

    // Check if Chart.js is loaded
    if (typeof Chart === "undefined") {
      console.error("[Charts] Chart.js library not loaded. Check script imports.");
      return;
    }

    // Set global default styles for dark theme
    Chart.defaults.color = "#B0B0B0";
    Chart.defaults.font.family = "'Inter', Arial, sans-serif";
    Chart.defaults.font.size = 11;

    // Create Chart.js instances
    _charts.altitude = _createLineChart(
      "chart-altitude",
      "Altitude",
      C.COLORS.altitude,
      "m"
    );
    _charts.pressure = _createLineChart(
      "chart-pressure",
      "Pressure",
      C.COLORS.pressure,
      "hPa"
    );
    _charts.temperature = _createLineChart(
      "chart-temperature",
      "Temperature",
      C.COLORS.temperature,
      "\u00b0C"
    );
    _charts.descentRate = _createLineChart(
      "chart-descent-rate",
      "Descent Rate",
      C.COLORS.descentRate,
      "m/s"
    );
    _charts.battery = _createLineChart(
      "chart-battery",
      "Battery Voltage",
      C.COLORS.battery,
      "V"
    );

    console.log("[Charts] All 5 charts initialized.");
  }

  /**
   * Add a new telemetry data point to all charts and trigger rendering.
   *
   * @param {Object} packet - Parsed telemetry packet
   */
  function updateCharts(packet) {
    if (!packet) return;

    // Generate label from timestamp (HH:MM:SS format)
    const label = TimeUtils.formatChartLabel(packet.timestamp);

    // Update each chart
    _addDataPoint(_charts.altitude, label, packet.altitude);
    _addDataPoint(_charts.pressure, label, packet.pressure);
    _addDataPoint(_charts.temperature, label, packet.temperature);
    _addDataPoint(_charts.descentRate, label, packet.descentRate);
    _addDataPoint(_charts.battery, label, packet.batteryVoltage);
  }

  /**
   * Push a value to the chart, shifting if limits are exceeded.
   * Uses performance update mode ('none') to keep GCS scrolling fast.
   *
   * @param {Chart} chart - Chart.js instance
   * @param {string} label - X-axis time label
   * @param {number} value - Y-axis telemetry value
   * @returns {Chart} The chart instance
   */
  function _addDataPoint(chart, label, value) {
    if (!chart) return null;

    const data = chart.data;
    data.labels.push(label);
    data.datasets[0].data.push(value);

    // Enforce sliding window limits
    if (data.labels.length > CONFIG.GRAPH.GRAPH_MAX_POINTS) {
      data.labels.shift();
      data.datasets[0].data.shift();
    }

    // Performance update: bypass animations to render at 60fps
    chart.update("none");
    return chart;
  }

  /**
   * Reset all charts, removing all historical points.
   */
  function clearAllCharts() {
    for (const key in _charts) {
      if (_charts.hasOwnProperty(key) && _charts[key]) {
        const chart = _charts[key];
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
      }
    }
    console.log("[Charts] All charts cleared.");
  }

  /**
   * Destroy all Chart.js instances and set references to null.
   */
  function destroyCharts() {
    for (const key in _charts) {
      if (_charts.hasOwnProperty(key) && _charts[key]) {
        try {
          _charts[key].destroy();
        } catch (err) {
          console.error("[Charts] Error destroying chart: " + key, err);
        }
        _charts[key] = null;
      }
    }
  }

  // ── Private Helper to Create Charts ───────────────────────────

  /**
   * Helper to create a unified line chart configuration.
   *
   * @param {string} canvasId - Element ID of canvas
   * @param {string} label - Dataset label
   * @param {string} color - Accent color for line
   * @param {string} unit - Measurement unit
   * @returns {Chart|null} Chart.js instance or null if element not found
   */
  function _createLineChart(canvasId, label, color, unit) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn("[Charts] Canvas element not found: " + canvasId);
      return null;
    }

    const ctx = canvas.getContext("2d");

    return new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: label,
            data: [],
            borderColor: color,
            borderWidth: 2,
            tension: 0.4, // Smooth curves
            pointRadius: 0, // Sleek look without dots
            pointHoverRadius: 4,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: CONFIG.GRAPH.ANIMATION_DURATION_MS, // Fast, smooth updates
        },
        plugins: {
          legend: {
            display: false, // Hidden since card title handles labels
          },
          tooltip: {
            enabled: true,
            intersect: false,
            mode: "index",
            callbacks: {
              label: function (context) {
                return context.dataset.label + ": " + context.raw.toFixed(2) + " " + unit;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
              borderColor: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              maxTicksLimit: 6,
              color: "#808080",
            },
          },
          y: {
            display: true,
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
              borderColor: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "#808080",
            },
          },
        },
      },
    });
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeCharts: initializeCharts,
    updateCharts: updateCharts,
    clearAllCharts: clearAllCharts,
    destroyCharts: destroyCharts,
  };
})();
