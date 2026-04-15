# WorldView Development Tasks

## Task 1: Maritime Traffic Layer (AIS)
- Fetch AIS data from MarineTraffic or similar public API
- Display ships as points on the globe
- Color-code by ship type (tanker, cargo, military)
- Highlight Strait of Hormuz region
- Filter controls for ship types

## Task 2: No-Fly Zones / Airspace Layer
- Create polygon overlays for airspace restrictions
- Support timestamping for temporal visualization
- Display Iran, Iraq, Kuwait, Bahrain, Qatar regions
- Color-coded by restriction level

## Task 3: Timeline Scrubber
- Add timeline control at bottom of screen
- Enable scrubbing through historical data
- Animate visualization over time
- Play/pause controls
- Time range selector

## Task 4: Enhanced Info Popups
- Click on aircraft: callsign, origin, destination, altitude, aircraft type
- Click on satellite: orbital parameters, country, launch date
- Click on ship: name, type, destination, speed, course

## Task 5: Layer Toggle Panel (Sidebar)
- Collapsible sidebar with layer controls
- Per-layer opacity slider
- Filter options per layer
- Search functionality

## Task 6: Performance Optimization
- Entity clustering for 5000+ items
- Level-of-detail rendering
- Frustum culling
- WebGL optimization

---

## API Endpoints to Implement (server/proxy.ts)
- `GET /api/maritime` - AIS ship data
- `GET /api/airspaces` - No-fly zone polygons
- `GET /api/flights/history` - Historical flight data

## Tech Stack
- React + TypeScript + Vite
- CesiumJS
- satellite.js for orbital calculations
- Existing proxy server at localhost:3001
