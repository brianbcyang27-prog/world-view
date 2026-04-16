# WorldView - Real-Time Global Flight Tracker

A comprehensive real-time flight tracking and geospatial intelligence platform built with React, TypeScript, and CesiumJS.

## Features

### 🛫 Flight Tracking
- Real-time ADS-B flight data from multiple global regions
- **3000+ commercial flights** tracked simultaneously
- Flight routes visualization with glowing lines to destinations
- Click any aircraft to see detailed information:
  - Airline name and flight number
  - Origin and destination airports
  - Aircraft type, registration, and details
  - Altitude, ground speed, heading
  - Position accuracy and signal strength

### 🔍 Search Functionality
Search flights by:
- Callsign (e.g., "AAL123", "UAL456")
- Flight number
- Airline name
- Aircraft hex code
- Origin/destination airport code

### 🛰️ Satellite Tracking
- Real-time orbital positions of 600+ satellites
- Orbital path visualization
- Click to track individual satellite trajectories

### 📰 News Layer
- GDELT news integration with geolocated events
- Global news events displayed on the map

### 🛠️ Controls
- **Route Toggle**: Show/hide flight routes (🛫/🚫 button)
- **Settings Panel**: Adjust data refresh interval (0.5s to 1min)
- **Layer Toggles**: Enable/disable flights, satellites, GPS jamming, maritime, no-fly zones, news, satellite imagery
- **Reset View**: Return camera to default position

### ⚡ Performance
- Chunked processing for smooth UI updates
- Smart entity updates (no full redraw on each refresh)
- Preserves selected flight tracking across data updates

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **3D Globe**: CesiumJS
- **Satellite Calculations**: satellite.js
- **Backend**: Express.js proxy server

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/brianbcyang27-prog/world-view.git
cd world-view

# Install dependencies
cd worldview-app && npm install
```

### Running the Application

1. Start the proxy server (Terminal 1):
```bash
cd worldview-app
node server/proxy.ts
```

2. Start the development server (Terminal 2):
```bash
cd worldview-app
npm run dev
```

3. Open http://localhost:5174 in your browser

## API Endpoints

The proxy server runs on http://localhost:3001:

- `GET /api/flights` - Real-time flight data
- `GET /api/satellites` - Satellite TLE data
- `GET /api/flight/:hex` - Individual flight details
- `GET /api/news` - GDELT news articles
- `GET /api/gps-jamming` - GPS jamming zones
- `GET /api/maritime` - Maritime vessel data
- `GET /api/noflyzones` - No-fly zone data

## Keyboard Shortcuts

- Click on aircraft: View flight details in side panel
- Search bar: Find flights by callsign, number, or airline

## Data Sources

- **ADS-B Data**: airplanes.live API (free, real-time)
- **Satellite TLE**: CelesTrak
- **News**: GDELT Project
- **Airport Data**: OpenFlights

## License

MIT License

## Author

Built with ❤️ by Brian Yang