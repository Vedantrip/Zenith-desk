# Zenith Desk

Zenith Desk is an Electron desktop productivity app that combines real-time system telemetry, lag optimization, focus sessions, distraction shielding, file organization, and a floating desktop widget.

## Features

- **System Telemetry Dashboard**: Live CPU/RAM stats, process list, and telemetry chart.
- **AI Lag Sweeper**: Cleans temp files, evaluates heavy processes, and reports optimization score.
- **Smart Folder Organizer**: Sorts files into category folders (Documents, Images, Videos, Audio, Installers, Archives, Code).
- **Focus Space**: Timer-based focus sessions with optional Zen mode automation.
- **Distraction Shield**: Detects distracting apps and supports one-click or auto cleanup.
- **Soundscapes**: Built-in synthesized focus audio presets (rain, pink noise, brown noise, binaural).
- **Desktop Widget Overlay**: Floating widget with clock, focus status, telemetry bars, and task checklist.
- **Tray-first Experience**: Runs from the system tray and supports auto-start settings.

## Tech Stack

- [Electron](https://www.electronjs.org/)
- [systeminformation](https://www.npmjs.com/package/systeminformation)
- Vanilla HTML/CSS/JavaScript (CommonJS)

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

## Available Scripts

- `npm start` — Launches the Electron app.
- `npm test` — Placeholder script (currently exits with `Error: no test specified`).

## Project Structure

```text
.
├── main.js            # Electron main process, windows, tray, IPC handlers
├── preload.js         # Secure API bridge (contextBridge)
├── src/
│   ├── index.html     # Control Center UI
│   ├── renderer.js    # Control Center runtime logic
│   ├── widget.html    # Desktop widget UI
│   ├── widget.js      # Widget runtime logic
│   ├── optimizer.js   # Telemetry + lag sweep utilities
│   ├── organizer.js   # Folder categorization and file moving
│   ├── soundEngine.js # Web Audio focus soundscapes
│   ├── style.css
│   └── widget.css
└── package.json
```

## Notes

- App settings are persisted in Electron `userData` (`settings.json`).
- The app is designed to stay active in the tray and can reopen windows from tray actions.

## License

ISC
