/**
 * ORVIX Ground Control Software — Video Stream Module
 *
 * Purpose: Manages live camera/webcam access via the Web MediaDevices API.
 *          Handles camera enumeration, selection, start/stop toggling,
 *          stream error recovery, and status indicator transitions.
 *
 * Design: Matches the existing HTML elements and BEM classes:
 *         `video-stream`, `camera-select`, `btn-start-stream`, `btn-stop-stream`,
 *         `video-status-dot`, `video-status-text`, `video-placeholder`.
 *
 * Dependencies: state.js, utils/dom.js
 *
 * @module visualizations/video
 */
"use strict";

const VideoStreamManager = (function () {
  // ── Private Variable Cache ────────────────────────────────────

  let _els = {};

  /** @type {MediaStream|null} Live stream track container */
  let _stream = null;

  /** @type {string|null} Selected device ID */
  let _selectedDeviceId = null;

  // ── Public API ────────────────────────────────────────────────

  /**
   * Cache elements, attach button listeners, and discover cameras.
   */
  function initializeVideo() {
    _cacheElements();
    _attachListeners();
    _resetUI();

    // Dynamically query and populate camera dropdown
    getCameraList();

    console.log("[Video] Stream system initialized.");
  }

  /**
   * Enumerate available video inputs and populate dropdown options.
   * Handles browser authorization requests gracefully.
   *
   * @returns {Promise<Object[]>} Array of media devices
   */
  async function getCameraList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn("[Video] MediaDevices API not supported.");
      return [];
    }

    try {
      // Enforce permission request first if not yet granted
      // so labels are populated rather than empty strings
      await _requestInitialPermission();

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = [];

      // Clear existing options (except the default select option)
      if (_els.select) {
        _els.select.innerHTML = '<option value="">Select Camera</option>';
      }

      for (let i = 0; i < devices.length; i++) {
        const d = devices[i];
        if (d.kind === "videoinput") {
          const label = d.label || `Camera ${videoDevices.length + 1}`;
          videoDevices.push({
            deviceId: d.deviceId,
            label: label,
          });

          // Add option to dropdown
          if (_els.select) {
            const opt = DOM.createElement("option", "", label);
            opt.value = d.deviceId;
            _els.select.appendChild(opt);
          }
        }
      }

      console.log(`[Video] Discovered ${videoDevices.length} camera devices.`);
      return videoDevices;
    } catch (err) {
      console.error("[Video] Error enumerating cameras:", err);
      return [];
    }
  }

  /**
   * Select a specific camera device and hot-swap stream if currently active.
   *
   * @param {string} deviceId
   */
  async function selectCamera(deviceId) {
    _selectedDeviceId = deviceId || null;
    console.log("[Video] Camera selected: " + _selectedDeviceId);

    if (OrvixState.get("videoStreamActive")) {
      // Hot-swap: stop active stream first, then start new one
      await stopStream();
      if (_selectedDeviceId) {
        await startStream(_selectedDeviceId);
      }
    }
  }

  /**
   * Initiate video capture stream from the selected device.
   *
   * @param {string|null} [deviceId=null]
   * @returns {Promise<boolean>} Success status
   */
  async function startStream(deviceId) {
    const id = deviceId || _selectedDeviceId;

    _updateVideoStatus("CONNECTING...");

    const constraints = {
      video: {
        deviceId: id ? { exact: id } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false, // Mute ground-station microphone by default
    };

    try {
      _stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (_els.video) {
        _els.video.srcObject = _stream;
        _els.video.classList.add("active");
      }

      if (_els.placeholder) {
        _els.placeholder.classList.add("hidden");
      }

      OrvixState.setState({ videoStreamActive: true });
      _updateVideoStatus("STREAMING");
      _updateButtonStates(true);

      console.log("[Video] Camera stream started.");
      return true;
    } catch (err) {
      _handleCameraError(err);
      return false;
    }
  }

  /**
   * Release camera device locks and stop streaming tracks.
   */
  async function stopStream() {
    if (_stream) {
      _stream.getTracks().forEach(function (track) {
        track.stop();
      });
      _stream = null;
    }

    if (_els.video) {
      _els.video.srcObject = null;
      _els.video.classList.remove("active");
    }

    if (_els.placeholder) {
      _els.placeholder.classList.remove("hidden");
    }

    OrvixState.setState({ videoStreamActive: false });
    _updateVideoStatus("OFFLINE");
    _updateButtonStates(false);

    console.log("[Video] Camera stream stopped.");
  }

  /**
   * Toggle between active streaming and offline.
   */
  async function toggleStream() {
    if (OrvixState.get("videoStreamActive")) {
      await stopStream();
    } else {
      await startStream();
    }
  }

  // ── Private Helpers ───────────────────────────────────────────

  /**
   * Request initial temporary access to cameras. This ensures
   * device labels are returned by subsequent enumerateDevices calls.
   */
  async function _requestInitialPermission() {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) {
      // Fail silently, permissions will trigger alerts during startStream
    }
  }

  /**
   * Update visual status indicators.
   *
   * @param {string} status - 'OFFLINE', 'CONNECTING...', 'STREAMING'
   */
  function _updateVideoStatus(status) {
    if (_els.statusText) {
      _els.statusText.textContent = status;
    }

    if (_els.statusDot) {
      _els.statusDot.className = "status-indicator";

      if (status === "STREAMING") {
        _els.statusDot.classList.add("status-indicator--online");
      } else if (status === "CONNECTING...") {
        _els.statusDot.classList.add("status-indicator--connecting");
      } else {
        _els.statusDot.classList.add("status-indicator--offline");
      }
    }
  }

  /**
   * Update button enabled/disabled attributes.
   *
   * @param {boolean} active - true if stream is active
   */
  function _updateButtonStates(active) {
    if (_els.btnStart) _els.btnStart.disabled = active;
    if (_els.btnStop)  _els.btnStop.disabled = !active;
  }

  /**
   * Standardized alert responses for various browser device errors.
   */
  function _handleCameraError(err) {
    let msg = "Failed to open camera: " + err.message;

    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Permission Denied: Allow camera permissions in your browser settings.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No video capture hardware found on this computer.";
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      msg = "Camera Blocked: Device is in use by another application.";
    } else if (err.name === "OverconstrainedError") {
      msg = "Resolution Not Supported: The requested size is invalid for this lens.";
    }

    alert(msg);
    _resetUI();
    console.error("[Video] Camera error: " + err.name, err);
  }

  /**
   * Cache elements.
   */
  function _cacheElements() {
    _els = {
      select: DOM.byId("camera-select"),
      btnStart: DOM.byId("btn-start-stream"),
      btnStop: DOM.byId("btn-stop-stream"),
      video: DOM.byId("video-stream"),
      placeholder: DOM.byId("video-placeholder"),
      statusDot: DOM.byId("video-status-dot"),
      statusText: DOM.byId("video-status-text"),
    };
  }

  /**
   * Bind DOM listeners.
   */
  function _attachListeners() {
    if (_els.btnStart) {
      _els.btnStart.addEventListener("click", function () {
        startStream();
      });
    }
    if (_els.btnStop) {
      _els.btnStop.addEventListener("click", stopStream);
    }
    if (_els.select) {
      _els.select.addEventListener("change", function () {
        selectCamera(_els.select.value);
      });
    }
  }

  /**
   * Restore base layout.
   */
  function _resetUI() {
    _updateVideoStatus("OFFLINE");
    _updateButtonStates(false);
    if (_els.video) {
      _els.video.classList.remove("active");
    }
    if (_els.placeholder) {
      _els.placeholder.classList.remove("hidden");
    }
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeVideo: initializeVideo,
    getCameraList: getCameraList,
    selectCamera: selectCamera,
    startStream: startStream,
    stopStream: stopStream,
    toggleStream: toggleStream,
  };
})();
