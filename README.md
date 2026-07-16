# ORVIX — CanSat Ground Control Software (GCS)

A professional, single-page Ground Control Software dashboard for monitoring and controlling CanSat missions in real-time. Built with an aerospace-grade black-and-white interface with vibrant color accents for critical status indicators.

![Status](https://img.shields.io/badge/Phase-1%20Foundation-blue)
![Tech](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JavaScript-black)

---

## Features

- **Real-Time Telemetry** — Live packet display for container and payload data
- **5 Interactive Graphs** — Altitude, Pressure, Temperature, Descent Rate, Battery Voltage (Chart.js)
- **GPS Tracking Map** — Live position and flight trajectory on OpenStreetMap (Leaflet.js)
- **4-Digit Error Code System** — Color-coded fault monitoring (Descent Rate, GPS, Separation, Parachute)
- **Mission Controls** — Manual Separation, Emergency Parachute, Redundant Activation with safety confirmations
- **Orientation Display** — Roll, Pitch, Yaw visualization
- **Live Video Stream** — Camera feed integration via MediaDevices API
- **Data Export** — CSV telemetry export and graph image capture

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Structure | HTML5 | Single-page dashboard layout |
| Styling | CSS3 (Grid, Flexbox) | Aerospace-style dark theme |
| Logic | Vanilla JavaScript (ES6+) | Application logic, state management |
| Graphs | Chart.js | Real-time data visualization |
| Maps | Leaflet.js + OpenStreetMap | GPS tracking and trajectory |
| Serial | Web Serial API | Microcontroller communication |
| Video | MediaDevices API | Camera streaming |
| Export | Blob API, File API | CSV and image export |

---

## Quick Start

### Prerequisites
- **Browser:** Chrome 89+ or Edge 89+ (Web Serial API required)
- **Microcontroller:** Arduino or ESP32 with telemetry firmware (or use built-in simulator)

### Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/guptalagan43/ORVIX-A-Ground-Control-Software-GCS-.git
   ```
2. Open `src/index.html` in Chrome, or use a local HTTP server:
   ```bash
   # Using VS Code Live Server extension (recommended)
   # Or Python:
   cd src && python -m http.server 8080
   ```
3. Click **Start Telemetry** to connect to a serial device, or use **Simulator Mode** for testing.

---

## Folder Structure

```
orvix/
├── src/
│   ├── index.html              # Main dashboard page
│   ├── css/
│   │   └── styles.css          # Design system and layout
│   └── js/
│       ├── app.js              # Application bootstrap
│       ├── config.js           # Constants and thresholds
│       ├── state.js            # Central state store
│       ├── telemetry/
│       │   ├── parser.js       # Packet parsing and validation
│       │   ├── receiver.js     # Web Serial API connection
│       │   └── logger.js       # Telemetry logging
│       ├── controls/
│       │   ├── topbar.js       # Top control bar buttons
│       │   └── mission-controls.js  # Mission command handling
│       ├── visualizations/
│       │   ├── charts.js       # Chart.js graph management
│       │   ├── map.js          # Leaflet.js GPS map
│       │   ├── orientation.js  # Roll/Pitch/Yaw display
│       │   └── video.js        # Camera streaming
│       ├── monitoring/
│       │   └── error-code.js   # 4-digit fault detection
│       ├── export/
│       │   └── export-manager.js  # CSV and image export
│       └── utils/
│           ├── dom.js          # DOM helper functions
│           ├── formatters.js   # Value formatting utilities
│           └── time.js         # Time and timestamp utilities
├── assets/
│   ├── icons/                  # SVG icons
│   └── images/                 # Static images
├── test/
│   ├── telemetry-simulator.js  # Dummy packet generator
│   └── test-data/              # Sample telemetry data
├── .gitignore
└── README.md
```

---

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 89+ | ✅ Full | Primary target, Web Serial API |
| Edge 89+ | ✅ Full | Chromium-based |
| Firefox | ⚠️ Partial | No Web Serial API (simulator mode only) |
| Safari | ❌ None | Web Serial API not available |

---

## Development Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation & Setup | 🔄 In Progress |
| 2 | Core UI & Telemetry | ⚪ Pending |
| 3 | Graphs & Monitoring | ⚪ Pending |
| 4 | Map & Orientation | ⚪ Pending |
| 5 | Mission Controls | ⚪ Pending |
| 6 | Video & Export | ⚪ Pending |
| 7 | Hardware Integration | ⚪ Pending |
| 8 | Polish & Documentation | ⚪ Pending |

---

## License

This project is developed for educational aerospace research purposes.

---

**ORVIX** — *Operational Real-time Visualization & Integrated eXecution*
