/**
 * ORVIX Ground Control Software — GPS Map Module
 *
 * Purpose: Manages Leaflet.js map for GPS tracking. Displays live
 *          payload position marker, trajectory polyline, and distance.
 *          Implements auto-centering, path history limit (500 points),
 *          and handles GPS signal loss/restoration gracefully.
 *
 * Design: Custom aerospace-style circular vector marker to prevent local
 *         image loading issues. The map placeholder is hidden when live
 *         telemetry starts.
 *
 * Dependencies: config.js, state.js, Leaflet.js (CDN)
 *
 * @module visualizations/map
 */
"use strict";

const GpsMapManager = (function () {
  // ── Private Map References ────────────────────────────────────

  /** @type {L.Map|null} */
  let _map = null;

  /** @type {L.CircleMarker|null} Custom payload marker */
  let _marker = null;

  /** @type {L.Polyline|null} Trajectory path */
  let _polyline = null;

  /** @type {boolean} Flag tracking if map has been initialized */
  let _isInitialized = false;

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialize Leaflet map in the container.
   *
   * @param {string} [containerId='map'] - DOM ID of map container
   * @returns {L.Map|null} Leaflet map instance
   */
  function initializeMap(containerId) {
    const id = containerId || "map";
    const el = document.getElementById(id);
    if (!el) {
      console.warn("[Map] Container element not found: " + id);
      return null;
    }

    // Guard: already initialized
    if (_isInitialized && _map) {
      return _map;
    }

    try {
      const M = CONFIG.MAP;

      // Set default Jaipur coords if config has 0,0
      const defaultLat = M.DEFAULT_LAT || 26.9124;
      const defaultLon = M.DEFAULT_LON || 75.7873;

      // Create map
      _map = L.map(id, {
        zoomControl: true,
        attributionControl: true,
      }).setView([defaultLat, defaultLon], M.DEFAULT_ZOOM);

      // Add OpenStreetMap dark-ish tiles or standard OSM
      L.tileLayer(M.TILE_URL, {
        attribution: M.TILE_ATTRIBUTION,
        maxZoom: 18,
        minZoom: 3,
      }).addTo(_map);

      // Create empty trajectory line
      _polyline = L.polyline([], {
        color: M.TRAJECTORY_COLOR,
        weight: M.TRAJECTORY_WEIGHT,
        opacity: M.TRAJECTORY_OPACITY,
      }).addTo(_map);

      _isInitialized = true;
      console.log("[Map] Leaflet map initialized successfully.");
      return _map;
    } catch (err) {
      console.error("[Map] Error initializing Leaflet map:", err);
      return null;
    }
  }

  /**
   * Main update function called from the state observer.
   *
   * @param {Object} packet - Current telemetry packet
   */
  function updateMap(packet) {
    if (!_map || !_isInitialized || !packet) return;

    const lat = packet.gpsLat;
    const lon = packet.gpsLon;

    // Check for invalid coordinates
    if (lat === 0 && lon === 0 || lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
      handleGpsLoss();
      return;
    }

    // Hide placeholder when live GPS is received
    const placeholder = document.getElementById("map-placeholder");
    if (placeholder && placeholder.style.display !== "none") {
      placeholder.style.display = "none";
    }

    // Create or update marker position
    if (!_marker) {
      _marker = _createMarker(lat, lon);
    } else {
      _updateMarkerPosition(lat, lon);
    }

    // Add point to trajectory line
    _addGpsPointToTrajectory(lat, lon);
  }

  /**
   * Handle GPS signal loss. Fades the marker opacity to signal
   * "Offline/No Signal" state while keeping last known position.
   */
  function handleGpsLoss() {
    if (_marker) {
      _marker.setStyle({
        fillColor: "var(--color-text-muted)",
        opacity: 0.5,
        fillOpacity: 0.3,
      });
      _marker.setPopupContent("<b>Last Known Position</b><br>Signal Lost");
    }
    console.warn("[Map] Invalid/No GPS coordinates. Signal lost.");
  }

  /**
   * Calculate cumulative distance traveled in meters using Haversine formula.
   *
   * @param {Object[]} points - Array of {lat, lon} points
   * @returns {number} Distance in meters
   */
  function calculateTotalDistance(points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      distance += _haversineDistance(
        points[i - 1].lat,
        points[i - 1].lon,
        points[i].lat,
        points[i].lon
      );
    }
    return distance;
  }

  /**
   * Autofit the map zoom level to show the full flight path.
   */
  function fitMapToTrajectory() {
    if (_map && _polyline && _polyline.getLatLngs().length > 0) {
      _map.fitBounds(_polyline.getBounds(), { padding: [20, 20] });
    }
  }

  /**
   * Reset map to initial state, clear paths/markers, and show placeholder.
   */
  function clearMap() {
    if (!_map) return;

    if (_marker) {
      _map.removeLayer(_marker);
      _marker = null;
    }

    if (_polyline) {
      _polyline.setLatLngs([]);
    }

    const placeholder = document.getElementById("map-placeholder");
    if (placeholder) {
      placeholder.style.display = "flex";
    }

    const M = CONFIG.MAP;
    const defaultLat = M.DEFAULT_LAT || 26.9124;
    const defaultLon = M.DEFAULT_LON || 75.7873;
    _map.setView([defaultLat, defaultLon], M.DEFAULT_ZOOM);

    console.log("[Map] Map visualization cleared.");
  }

  // ── Private Helpers ───────────────────────────────────────────

  /**
   * Create a custom vector circle marker for the CanSat position.
   *
   * @param {number} lat
   * @param {number} lon
   * @returns {L.CircleMarker}
   */
  function _createMarker(lat, lon) {
    const marker = L.circleMarker([lat, lon], {
      radius: 8,
      fillColor: "#FF3B30", // Red
      color: "#FFFFFF",     // White border
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(_map);

    marker.bindPopup(
      `<b>CanSat Payload</b><br>Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}`
    ).openPopup();

    return marker;
  }

  /**
   * Update marker coordinates and popup contents. Pans map smoothly.
   *
   * @param {number} lat
   * @param {number} lon
   */
  function _updateMarkerPosition(lat, lon) {
    if (!_marker || !_map) return;

    _marker.setLatLng([lat, lon]);
    _marker.setStyle({
      fillColor: "#FF3B30",
      opacity: 1,
      fillOpacity: 0.9,
    });
    _marker.setPopupContent(
      `<b>CanSat Payload</b><br>Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}`
    );

    // Smoothly pan map to center on new position
    _map.panTo([lat, lon]);
  }

  /**
   * Add new coordinates to the path line. Shifts if past points limit.
   *
   * @param {number} lat
   * @param {number} lon
   */
  function _addGpsPointToTrajectory(lat, lon) {
    if (!_polyline) return;

    const path = _polyline.getLatLngs();
    path.push(L.latLng(lat, lon));

    // Limit path memory
    if (path.length > CONFIG.MAP.MAX_GPS_HISTORY) {
      path.shift();
    }

    _polyline.setLatLngs(path);
  }

  /**
   * Haversine distance calculator.
   */
  function _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
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

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeMap: initializeMap,
    updateMap: updateMap,
    handleGpsLoss: handleGpsLoss,
    calculateTotalDistance: calculateTotalDistance,
    fitMapToTrajectory: fitMapToTrajectory,
    clearMap: clearMap,
  };
})();
