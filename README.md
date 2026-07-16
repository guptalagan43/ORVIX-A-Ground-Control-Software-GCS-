# ORVIX - Ground Control Software (GCS)

![Status](https://img.shields.io/badge/Phase-8%20Polish%20%26%20Documentation-success)
![Tech](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JavaScript-black)

> A professional single-page Ground Control Software for CanSat missions. Built with HTML, CSS, and JavaScript.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/guptalagan43/ORVIX-A-Ground-Control-Software-GCS-.git
cd ORVIX-A-Ground-Control-Software-GCS-

# Open in browser (Chrome/Edge recommended)
# Use VS Code Live Server or open src/index.html directly
```

## 📋 Features

### Real-time Monitoring
- **Live Telemetry** - Web Serial API connection to CanSat microcontroller
- **5 Real-time Graphs** - Altitude, pressure, temperature, descent rate, battery voltage
- **GPS Tracking Map** - Live position with trajectory history using Leaflet.js
- **Orientation Display** - 2D artificial horizon showing roll, pitch, and yaw

### Mission Controls
- **Manual Separation** - Single confirmation trigger
- **Emergency Parachute** - Double confirmation for safety
- **Redundant Activation** - Backup system activation

### Safety & Monitoring
- **4-Digit Error Code System** - Fault detection with visual alerts
- **Descent Rate Monitoring** - Validates 8-10 m/s safe range
- **GPS Availability Check** - Detects signal loss
- **Command Logging** - All mission commands tracked with timestamps

### Data Management
- **Live Video Streaming** - Camera integration via MediaDevices API
- **CSV Export** - Telemetry data export with timestamps
- **PNG Export** - All 5 graphs captured as single image
- **Mission Log** - Complete mission data bundled for post-flight analysis

### Testing Tools
- **Telemetry Simulator** - Full mission simulation (pre-flight, ascent, apogee, descent, landing)
- **Fault Injection** - Test error code scenarios
- **Sample Data** - Pre-recorded telemetry packets for validation

## 🛠️ Technology Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Charts** | Chart.js v4.4.0 |
| **Maps** | Leaflet.js v1.9.4 |
| **Serial** | Web Serial API |
| **Video** | MediaDevices getUserMedia API |
| **Design** | Inter + JetBrains Mono fonts |

## 📱 Browser Requirements

- **Chrome 89+** (Recommended - full Web Serial API support)
- **Edge 89+** (Full support)
- **Firefox 88+** (Limited - Web Serial requires flag)
- **Safari** (Not recommended - no Web Serial API support)

Internet connection required for CDN libraries (Chart.js, Leaflet.js).

## 📖 Usage Guide

### 1. Connect to CanSat

1. Power on your CanSat microcontroller
2. Connect via USB to your computer
3. Open `src/index.html` in Chrome/Edge
4. Click **"Start Telemetry"** button in top bar
5. Select the correct COM port from browser dialog
6. Telemetry streaming begins automatically (~10 Hz)

### 2. Use Simulator Mode

For testing without hardware:

1. Open `src/index.html`
2. Click **"Simulator"** button in top bar
3. Watch all systems update in real-time
4. Simulation runs through complete mission profile
5. Click **"Simulator"** again to stop

### 3. Mission Controls

⚠️ **WARNING:** These commands are irreversible and can trigger real hardware actions.

- **Manual Separation:** Single confirmation required
  - Click button → Confirm dialog → Command sent
  - Status indicator: Yellow → Blue → Green

- **Emergency Parachute:** Double confirmation required
  - Click button → First confirm → Second confirm → Command sent
  - Status indicator: Red pulse → Blue → Green

- **Redundant Activation:** Single confirmation required
  - Click button → Confirm dialog → Command sent
  - Status indicator: Yellow → Blue → Green

### 4. Export Data

- **Export CSV:** Downloads all telemetry as timestamped CSV file
  - Filename: `mission_data_YYYYMMDD_HHMMSS.csv`
  - Opens in Excel, Google Sheets, or any CSV viewer

- **Export Graph:** Downloads all 5 charts as PNG image
  - Filename: `mission_graphs_YYYYMMDD_HHMMSS.png`
  - Useful for mission reports and presentations

### 5. Video Streaming

1. Select camera from dropdown (if multiple cameras)
2. Click **"Start Stream"** button
3. Video appears in video panel
4. Click **"Stop Stream"** to disable

## 📁 Project Structure

```
ORVIX/
├── src/                      # Source code
│   ├── index.html            # Main dashboard (450+ lines)
│   ├── css/
│   │   └── styles.css        # Design system (1242 lines)
│   └── js/
│       ├── app.js            # Main entry point
│       ├── config.js         # Constants and thresholds
│       ├── state.js          # Central state management
│       ├── telemetry/        # Web Serial API, parsing, logging
│       ├── controls/         # Top bar and mission controls
│       ├── visualizations/   # Charts, map, orientation, video
│       ├── monitoring/       # Error code system
│       ├── export/           # CSV and PNG export
│       └── utils/            # DOM, formatters, time utilities
├── test/
│   ├── telemetry-simulator.js # Mission simulator
│   └── test-data/            # Sample telemetry packets
├── docs/                     # Documentation (local only)
│   ├── prd.md                # Product Requirements
│   ├── architecture.md       # System Architecture
│   ├── rules.md              # Development Guidelines
│   ├── phases.md             # Project Phases
│   ├── design.md             # Design System
│   └── memory.md             # Progress Log
├── README.md                 # This file
└── .gitignore
```
