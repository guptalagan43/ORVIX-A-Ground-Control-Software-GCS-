/**
 * ORVIX Ground Control Software — Mission Controls
 *
 * Purpose: Handles mission-critical commands (Manual Separation,
 *          Emergency Parachute, Redundant Activation) with confirmation
 *          dialogs, command transmission via Web Serial, status tracking,
 *          and command logging.
 *
 * Safety Features implemented:
 *  - Single confirmation for Separation and Redundant commands.
 *  - Double confirmation for Parachute command.
 *  - Blinking/colored status indicators for active command state.
 *  - Logs commands locally and in state command history.
 *
 * Dependencies: config.js, state.js, telemetry/receiver.js, utils/dom.js
 *
 * @module controls/mission-controls
 */
"use strict";

const MissionControls = (function () {
  // ── Command Byte Codes (as specified in guidelines) ───────────
  const COMMAND_CODES = {
    SEPARATION: 0x01,      // Byte command for separation
    PARACHUTE: 0x02,       // Byte command for parachute
    REDUNDANT: 0x03,       // Byte command for redundant activation
    SYNC_TIME: 0x10,       // PC time sync
    RESET_PACKET: 0x11     // Reset packet counter
  };

  // ── Private Variable Cache ────────────────────────────────────

  let _els = {};

  // ── Public API ────────────────────────────────────────────────

  /**
   * Cache elements, attach listeners, and set initial states.
   */
  function initializeMissionControls() {
    _cacheElements();
    _attachListeners();
    _resetUI();

    console.log("[MissionControls] System initialized.");
  }

  /**
   * Trigger Manual Separation of payload (requires single confirmation).
   */
  async function sendSeparationCommand() {
    const confirmed = confirm("⚠️ WARNING: This will trigger payload separation. Continue?");
    if (!confirmed) {
      console.log("[MissionControls] Separation command cancelled by user.");
      return;
    }

    _updateCommandStatus("separation", CONFIG.COMMAND_STATUS.PENDING);
    OrvixState.logCommand("MANUAL_SEPARATION", CONFIG.COMMAND_STATUS.PENDING, "Waiting for transmission");

    // Start timer for separation failure (digit 3 = 1 after timeout)
    OrvixState.setState({ separationCommandTime: Date.now() });

    const success = await TelemetryReceiver.writeSerialCommand(CONFIG.COMMANDS.MANUAL_SEPARATION);
    if (success) {
      _updateCommandStatus("separation", CONFIG.COMMAND_STATUS.SENT);
      OrvixState.logCommand("MANUAL_SEPARATION", CONFIG.COMMAND_STATUS.SENT, "Transmitted successfully");
    } else {
      _updateCommandStatus("separation", CONFIG.COMMAND_STATUS.FAILED);
      OrvixState.logCommand("MANUAL_SEPARATION", CONFIG.COMMAND_STATUS.FAILED, "Transmission failed");
    }
  }

  /**
   * Deploy emergency parachute (requires double confirmation).
   */
  async function sendParachuteCommand() {
    const first = confirm("🚨 EMERGENCY: Deploy parachute?");
    if (!first) return;

    const second = confirm("⚠️ FINAL CONFIRMATION: This cannot be undone. Proceed?");
    if (!second) {
      console.log("[MissionControls] Parachute command cancelled by user.");
      return;
    }

    _updateCommandStatus("parachute", CONFIG.COMMAND_STATUS.PENDING);
    OrvixState.logCommand("EMERGENCY_PARACHUTE", CONFIG.COMMAND_STATUS.PENDING, "Waiting for transmission");

    const success = await TelemetryReceiver.writeSerialCommand(CONFIG.COMMANDS.EMERGENCY_PARACHUTE);
    if (success) {
      _updateCommandStatus("parachute", CONFIG.COMMAND_STATUS.SENT);
      OrvixState.setState({ parachuteDeployed: true });
      OrvixState.logCommand("EMERGENCY_PARACHUTE", CONFIG.COMMAND_STATUS.SENT, "Transmitted successfully");
    } else {
      _updateCommandStatus("parachute", CONFIG.COMMAND_STATUS.FAILED);
      OrvixState.logCommand("EMERGENCY_PARACHUTE", CONFIG.COMMAND_STATUS.FAILED, "Transmission failed");
    }
  }

  /**
   * Activate backup/redundant systems (requires single confirmation).
   */
  async function sendRedundantCommand() {
    const confirmed = confirm("Activate redundant systems?");
    if (!confirmed) {
      console.log("[MissionControls] Redundant command cancelled by user.");
      return;
    }

    _updateCommandStatus("redundant", CONFIG.COMMAND_STATUS.PENDING);
    OrvixState.logCommand("REDUNDANT_ACTIVATION", CONFIG.COMMAND_STATUS.PENDING, "Waiting for transmission");

    const success = await TelemetryReceiver.writeSerialCommand(CONFIG.COMMANDS.REDUNDANT_ACTIVATION);
    if (success) {
      _updateCommandStatus("redundant", CONFIG.COMMAND_STATUS.SENT);
      OrvixState.logCommand("REDUNDANT_ACTIVATION", CONFIG.COMMAND_STATUS.SENT, "Transmitted successfully");
    } else {
      _updateCommandStatus("redundant", CONFIG.COMMAND_STATUS.FAILED);
      OrvixState.logCommand("REDUNDANT_ACTIVATION", CONFIG.COMMAND_STATUS.FAILED, "Transmission failed");
    }
  }

  /**
   * Update the status text and class for a specific command key.
   *
   * @param {string} commandKey - 'separation', 'parachute', or 'redundant'
   * @param {string} status - 'STANDBY', 'PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED'
   */
  function _updateCommandStatus(commandKey, status) {
    const textEl = _els[commandKey + "Text"];
    const containerEl = _els[commandKey + "Status"];

    if (textEl) {
      textEl.textContent = status;
    }

    if (containerEl) {
      // Clear status classes
      containerEl.className = "command-status";

      // Add appropriate state class for CSS styling
      switch (status) {
        case CONFIG.COMMAND_STATUS.PENDING:
          containerEl.classList.add("command-status--pending");
          break;
        case CONFIG.COMMAND_STATUS.SENT:
          containerEl.classList.add("command-status--sent");
          break;
        case CONFIG.COMMAND_STATUS.ACKNOWLEDGED:
          containerEl.classList.add("command-status--confirmed");
          break;
        case CONFIG.COMMAND_STATUS.FAILED:
          containerEl.classList.add("command-status--failed");
          break;
        default:
          // Standby is unstyled base
          break;
      }
    }
  }

  /**
   * Process command response/acknowledgment from microcontroller telemetry.
   *
   * @param {string} commandName - 'MANUAL_SEPARATION', 'EMERGENCY_PARACHUTE', 'REDUNDANT_ACTIVATION'
   * @param {boolean} success - Whether command executed successfully on MCU
   */
  function handleCommandResponse(commandName, success) {
    const status = success ? CONFIG.COMMAND_STATUS.ACKNOWLEDGED : CONFIG.COMMAND_STATUS.FAILED;
    const msg = success ? "Acknowledgment received" : "Command failed on device";

    let key = "";
    if (commandName === "MANUAL_SEPARATION") {
      key = "separation";
      if (success) {
        OrvixState.setState({ separationConfirmed: true });
      }
    } else if (commandName === "EMERGENCY_PARACHUTE") {
      key = "parachute";
    } else if (commandName === "REDUNDANT_ACTIVATION") {
      key = "redundant";
    }

    if (key) {
      _updateCommandStatus(key, status);
      OrvixState.logCommand(commandName, status, msg);
    }
  }

  /**
   * Resets local log and clears history.
   */
  function clearCommandLog() {
    _resetUI();
    // Cleared by OrvixState on resetTelemetry
  }

  // ── Private Helpers ───────────────────────────────────────────

  /**
   * Cache all DOM controls.
   */
  function _cacheElements() {
    _els = {
      btnSep: DOM.byId("btn-manual-separation"),
      btnChute: DOM.byId("btn-emergency-parachute"),
      btnRedun: DOM.byId("btn-redundant-activation"),

      separationStatus: DOM.byId("separation-status"),
      separationText: DOM.getElement("#separation-status .command-status__text"),

      parachuteStatus: DOM.byId("parachute-status"),
      parachuteText: DOM.getElement("#parachute-status .command-status__text"),

      redundantStatus: DOM.byId("redundant-status"),
      redundantText: DOM.getElement("#redundant-status .command-status__text"),
    };
  }

  /**
   * Attach click event listeners to physical buttons.
   */
  function _attachListeners() {
    if (_els.btnSep) {
      _els.btnSep.addEventListener("click", sendSeparationCommand);
    }
    if (_els.btnChute) {
      _els.btnChute.addEventListener("click", sendParachuteCommand);
    }
    if (_els.btnRedun) {
      _els.btnRedun.addEventListener("click", sendRedundantCommand);
    }
  }

  /**
   * Reset command indicators to STANDBY.
   */
  function _resetUI() {
    _updateCommandStatus("separation", CONFIG.COMMAND_STATUS.STANDBY);
    _updateCommandStatus("parachute", CONFIG.COMMAND_STATUS.STANDBY);
    _updateCommandStatus("redundant", CONFIG.COMMAND_STATUS.STANDBY);
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    initializeMissionControls: initializeMissionControls,
    sendSeparationCommand: sendSeparationCommand,
    sendParachuteCommand: sendParachuteCommand,
    sendRedundantCommand: sendRedundantCommand,
    handleCommandResponse: handleCommandResponse,
    clearCommandLog: clearCommandLog,
    COMMAND_CODES: COMMAND_CODES,
  };
})();
