import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Cesium from 'cesium';
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite';

type ShaderMode = 'normal' | 'dark' | 'light' | 'nvg' | 'flir' | 'crt' | 'anime' | 'godmode';
type TabType = 'globe' | 'intel' | 'finance' | 'news' | 'tech' | 'hazards' | 'cameras';
type LayerVisibility = {
  flights: boolean;
  satellites: boolean;
  gpsJamming: boolean;
  maritime: boolean;
  noflyzones: boolean;
  news: boolean;
  satelliteImagery: boolean;
  intelligence: boolean;
  finance: boolean;
  weather: boolean;
  infrastructure: boolean;
  cables: boolean;
  outages: boolean;
  datacenters: boolean;
  cloudRegions: boolean;
  hackerEvents: boolean;
  naturalDisasters: boolean;
  techHQs: boolean;
  startupHubs: boolean;
  powerPlants: boolean;
};

interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
}

interface GPSZone {
  lat: number;
  lon: number;
  intensity: number;
  count: number;
}

interface NoFlyZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  type: string;
  active: boolean;
  level: string;
}

interface MaritimeVessel {
mmsi: string;
name: string;
lat: number;
lon: number;
speed: number;
heading: number;
type: string;
flag: string;
}

const API_BASE = 'http://localhost:3001';

const WorldView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  
const flightEntitiesRef = useRef<Cesium.Entity[]>([]);
  const flightEntitiesByHexRef = useRef<Map<string, Cesium.Entity[]>>(new Map());
  const satelliteEntitiesRef = useRef<Cesium.Entity[]>([]);
  const gpsJammingEntitiesRef = useRef<Cesium.Entity[]>([]);
  const maritimeEntitiesRef = useRef<Cesium.Entity[]>([]);
  const noFlyZoneEntitiesRef = useRef<Cesium.Entity[]>([]);
  const newsEntitiesRef = useRef<Cesium.Entity[]>([]);
  const orbitPathRef = useRef<Cesium.Entity | null>(null);
  const satellitesDataRef = useRef<SatelliteData[]>([]);

const [layers, setLayers] = useState<LayerVisibility>({
flights: true,
satellites: true,
gpsJamming: false,
maritime: false,
noflyzones: false,
news: false,
satelliteImagery: false,
intelligence: false,
finance: false,
weather: false,
infrastructure: false,
cables: false,
outages: false,
datacenters: false,
cloudRegions: false,
hackerEvents: false,
naturalDisasters: false,
techHQs: false,
startupHubs: false,
  powerPlants: false
});

const [activeTab, setActiveTab] = useState<TabType>('globe');
const [countrySummary, setCountrySummary] = useState<any>(null);

const fetchCountryInfo = async (countryCode: string) => {
try {
const response = await fetch(`${API_BASE}/api/country/${countryCode}`);
const data = await response.json();
setCountrySummary(data);
} catch (error) {
console.error('[COUNTRY] Error:', error);
}
};

const [shaderMode, setShaderMode] = useState<ShaderMode>('normal');
const [flightCount, setFlightCount] = useState(0);

useEffect(() => {
const tabLayers: Record<TabType, Partial<LayerVisibility>> = {
'globe': { flights: true, satellites: true, gpsJamming: false, maritime: false, noflyzones: false, news: false, satelliteImagery: false, intelligence: false, finance: false, weather: false, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: false, naturalDisasters: false, techHQs: false, startupHubs: false },
'intel': { flights: false, satellites: false, gpsJamming: false, maritime: false, noflyzones: false, news: true, satelliteImagery: false, intelligence: true, finance: false, weather: false, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: false, naturalDisasters: false, techHQs: false, startupHubs: false },
'finance': { flights: false, satellites: false, gpsJamming: false, maritime: false, noflyzones: false, news: false, satelliteImagery: false, intelligence: false, finance: true, weather: false, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: false, naturalDisasters: false, techHQs: false, startupHubs: false },
'news': { flights: false, satellites: false, gpsJamming: false, maritime: false, noflyzones: false, news: true, satelliteImagery: false, intelligence: true, finance: false, weather: false, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: false, naturalDisasters: false, techHQs: false, startupHubs: false },
'tech': { flights: false, satellites: false, gpsJamming: false, maritime: false, noflyzones: false, news: false, satelliteImagery: false, intelligence: false, finance: false, weather: false, infrastructure: true, cables: true, outages: true, datacenters: true, cloudRegions: true, hackerEvents: false, naturalDisasters: false, techHQs: true, startupHubs: true, powerPlants: true },
'hazards': { flights: false, satellites: false, gpsJamming: true, maritime: false, noflyzones: false, news: false, satelliteImagery: false, intelligence: false, finance: false, weather: true, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: true, naturalDisasters: true, techHQs: false, startupHubs: false },
'cameras': { flights: true, satellites: false, gpsJamming: false, maritime: false, noflyzones: false, news: true, satelliteImagery: true, intelligence: true, finance: false, weather: true, infrastructure: false, cables: false, outages: false, datacenters: false, cloudRegions: false, hackerEvents: false, naturalDisasters: false, techHQs: false, startupHubs: false },
};
setLayers(prev => ({ ...prev, ...tabLayers[activeTab] }));
}, [activeTab]);

const [satelliteCount, setSatelliteCount] = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [satellitesLoading, setSatellitesLoading] = useState(false);
const [gpsJammingCount, setGpsJammingCount] = useState(0);
const [maritimeCount, setMaritimeCount] = useState(0);
const [noFlyZoneCount, setNoFlyZoneCount] = useState(0);
const [newsCount, setNewsCount] = useState(0);
const [trackedSatellite, setTrackedSatellite] = useState<string | null>(null);
const [selectedFlight, setSelectedFlight] = useState<any>(null);
const [flightHistory, setFlightHistory] = useState<Map<string, {lat: number, lon: number, time: number}[]>>(new Map());
  
const [timelineMode, setTimelineMode] = useState(false);
const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
const [availableTimestamps, setAvailableTimestamps] = useState<number[]>([]);
const [latency, setLatency] = useState<number | null>(null);
const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
const [refreshInterval, setRefreshInterval] = useState(2000);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const trackedFlightHexRef = useRef<string | null>(null);
  const allFlightsDataRef = useRef<any[]>([]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const q = query.toLowerCase();
    const results = allFlightsDataRef.current.filter(f => {
      const callsignMatch = f.callsign?.toLowerCase().includes(q);
      const flightNumMatch = f.flightNumber?.toLowerCase().includes(q);
      const airlineMatch = f.airline?.toLowerCase().includes(q);
      const hexMatch = f.hex?.toLowerCase().includes(q);
      const originMatch = f.origin?.toLowerCase().includes(q);
      const destMatch = f.destination?.toLowerCase().includes(q);
      return callsignMatch || flightNumMatch || airlineMatch || hexMatch || originMatch || destMatch;
    }).slice(0, 20);
    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  };

  const selectSearchResult = (flight: any) => {
    const entity = viewerRef.current?.entities.getById(`flight_${flight.hex}`);
    if (entity) {
      trackedFlightHexRef.current = flight.hex;
      viewerRef.current!.selectedEntity = entity;
      viewerRef.current!.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(flight.lon, flight.lat, 500000),
        duration: 1.5
      });
    }
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleTrackSatelliteRef = useRef<(name: string) => void>(() => {});
  const clearOrbitPathRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;

const initViewer = async () => {
try {
setLoading(true);
setError(null);

const openStreetMapProvider = new Cesium.OpenStreetMapImageryProvider({
url: 'https://tile.openstreetmap.org/'
});

const cesiumViewer = new Cesium.Viewer(containerRef.current!, {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: true,
          timeline: timelineMode,
          fullscreenButton: false,
          vrButton: false,
          infoBox: true,
          selectionIndicator: true,
          shadows: false,
          shouldAnimate: true,
          terrainProvider: undefined,
        });

        cesiumViewer.imageryLayers.removeAll();
        cesiumViewer.imageryLayers.addImageryProvider(openStreetMapProvider);

        cesiumViewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(45, 30, 20000000)
        });

        viewerRef.current = cesiumViewer;
        setViewer(cesiumViewer);

cesiumViewer.selectedEntityChanged.addEventListener((selectedEntity: Cesium.Entity | undefined) => {
      if (!selectedEntity) {
        setTrackedSatellite(null);
        setSelectedFlight(null);
        clearOrbitPathRef.current?.();
        return;
      }
      
const entityId = selectedEntity.id as string || '';

// Check if it's a country (intel layer)
  if (entityId.startsWith('intel_')) {
    const countryCode = entityId.replace('intel_', '');
    fetchCountryInfo(countryCode);
    setSelectedFlight(null);
    setTrackedSatellite(null);
    clearOrbitPathRef.current?.();
    return;
  }
  // Check if it's a flight
  if (entityId.startsWith('flight_')) {
    const hex = entityId.replace('flight_', '');
    trackedFlightHexRef.current = hex;
    const props = selectedEntity.properties;

            if (props) {
              // Helper to safely get property value from Cesium Entity properties
              const getPropValue = (propObj: any, name: string, fallback: any = null): any => {
                try {
                  const prop = propObj[name];
                  if (prop !== undefined && prop !== null) {
                    if (typeof prop === 'object' && 'getValue' in prop) {
                      return prop.getValue(Cesium.JulianDate.now());
                    }
                    return prop;
                  }
                  return fallback;
                } catch { return fallback; }
              };

              const detailsJson = getPropValue(props, 'details', '{}');
const details = detailsJson ? JSON.parse(detailsJson) : {};
              setSelectedFlight({
                id: entityId,
                hex: getPropValue(props, 'hex', hex),
                callsign: getPropValue(props, 'callsign', 'Unknown'),
                registration: getPropValue(props, 'registration', 'N/A'),
                aircraftType: getPropValue(props, 'aircraftType', 'N/A'),
                aircraftDesc: getPropValue(props, 'aircraftDesc', 'N/A'),
                lat: getPropValue(props, 'lat', 0),
                lon: getPropValue(props, 'lon', 0),
                altFeet: getPropValue(props, 'altFeet', 0),
                groundSpeedKnots: getPropValue(props, 'groundSpeedKnots', 0),
                groundSpeedKmh: getPropValue(props, 'groundSpeedKmh', 0),
                track: getPropValue(props, 'track', 0),
                trackDirection: getPropValue(props, 'trackDirection', 'N'),
                onGround: getPropValue(props, 'onGround', false),
                squawk: getPropValue(props, 'squawk', 'N/A'),
                isMilitary: getPropValue(props, 'isMilitary', false),
                verticalSpeed: getPropValue(props, 'verticalSpeed', '0 ft/min'),
                verticalSpeedFpm: getPropValue(props, 'verticalSpeedFpm', 0),
                positionAccuracy: getPropValue(props, 'positionAccuracy', 'Unknown'),
                signalStrength: getPropValue(props, 'signalStrength', 'Unknown'),
                rssi: getPropValue(props, 'rssi', null),
                // Flight info
                airline: getPropValue(props, 'airline', details.airline || 'Unknown'),
                flightNumber: getPropValue(props, 'flightNumber', details.flightNumber || 'N/A'),
                airlineCode: getPropValue(props, 'airlineCode', details.airlineCode || ''),
                // Route info
                origin: getPropValue(props, 'origin', details.origin || ''),
                originCity: getPropValue(props, 'originCity', details.originCity || ''),
                originCountry: getPropValue(props, 'originCountry', details.originCountry || ''),
                originName: getPropValue(props, 'originName', details.originName || ''),
                destination: getPropValue(props, 'destination', details.destination || ''),
                destinationCity: getPropValue(props, 'destinationCity', details.destinationCity || ''),
                destinationCountry: getPropValue(props, 'destinationCountry', details.destinationCountry || ''),
                destinationName: getPropValue(props, 'destinationName', details.destinationName || ''),
                // Additional data
                emergency: getPropValue(props, 'emergency', details.emergency || 'none'),
                alert: getPropValue(props, 'alert', details.alert || false),
                distance: getPropValue(props, 'distance', details.distance || 0),
                direction: getPropValue(props, 'direction', details.direction || 0),
                nac_p: getPropValue(props, 'nac_p', details.nac_p || 0),
                nic: getPropValue(props, 'nic', details.nic || 0),
                navAltitudeMcp: getPropValue(props, 'navAltitudeMcp', details.navAltitudeMcp || null),
                navHeading: getPropValue(props, 'navHeading', details.navHeading || null),
                navQnh: getPropValue(props, 'navQnh', details.navQnh || null),
                operator: getPropValue(props, 'operator', details.operator || ''),
                year: getPropValue(props, 'year', details.year || ''),
                messages: getPropValue(props, 'messages', details.messages || 0),
                seen: getPropValue(props, 'seen', details.seen || 0),
                sil: getPropValue(props, 'sil', details.sil || 3),
                silType: getPropValue(props, 'silType', details.silType || 'perhour'),
                category: getPropValue(props, 'category', details.category || ''),
              });
            }

            // Fly to the flight
            if (props && viewer) {
              const lat = (props as any).lat?.getValue ? props.lat.getValue(Cesium.JulianDate.now()) : ((props as any).lat || 0);
              const lon = (props as any).lon?.getValue ? props.lon.getValue(Cesium.JulianDate.now()) : ((props as any).lon || 0);
              const altFeet = (props as any).altFeet?.getValue ? props.altFeet.getValue(Cesium.JulianDate.now()) : ((props as any).altFeet || 10000);
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, altFeet * 0.3048 + 50000),
                duration: 1
              });
            }

            setTrackedSatellite(null);
            clearOrbitPathRef.current?.();
          }
      // Check if it's a satellite
      else if (selectedEntity.name) {
        handleTrackSatelliteRef.current?.(selectedEntity.name);
        setSelectedFlight(null);
      }
    });

        setLoading(false);
        console.log('[WORLDVIEW] Globe initialized successfully');
      } catch (err) {
        console.error('[WORLDVIEW] Failed to initialize Cesium:', err);
        setError(`Failed to load globe: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, []);

  // Fetch timeline data
  useEffect(() => {
    if (!timelineMode) return;
    
    fetch(`${API_BASE}/api/timeline/2`)
      .then(r => r.json())
      .then(data => {
        setAvailableTimestamps(data.timestamps);
        setCurrentTimeIndex(data.timestamps.length - 1);
      })
      .catch(console.error);
  }, [timelineMode]);

// Flights layer
  useEffect(() => {
    if (!viewer) return;

    const clearFlightEntities = (hex: string) => {
      const entities = flightEntitiesByHexRef.current.get(hex) || [];
      entities.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      flightEntitiesByHexRef.current.delete(hex);
    };

    const clearAllFlights = () => {
      flightEntitiesByHexRef.current.forEach((entities, _hex) => {
        entities.forEach(entity => {
          try { viewer.entities.remove(entity); } catch {}
        });
      });
      flightEntitiesByHexRef.current.clear();
      flightEntitiesRef.current = [];
    };

    if (!layers.flights) {
      clearAllFlights();
      setFlightCount(0);
      return;
    }

    const fetchFlights = async () => {
      const startTime = Date.now();
      try {
        const response = await fetch(`${API_BASE}/api/flights`);
        const elapsed = Date.now() - startTime;
        setLatency(elapsed);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setLastUpdate(new Date());

        if (!data.states || data.states.length === 0) {
          clearAllFlights();
          setFlightCount(0);
          return;
        }

        const validFlights = data.states.filter((state: unknown[]) =>
          state[5] !== null && state[6] !== null &&
          !isNaN(state[5] as number) && !isNaN(state[6] as number)
        );

        const newFlightHexes = new Set<string>();
        const newHistory = new Map<string, {lat: number, lon: number, time: number}[]>();
        const CHUNK_SIZE = 50;
        const allFlightsHexes = new Set(validFlights.map((s: unknown[]) => s[0] as string));

        let existingHexes = new Set(flightEntitiesByHexRef.current.keys());
        existingHexes.forEach(hex => {
          if (!allFlightsHexes.has(hex)) {
            clearFlightEntities(hex);
          }
        });

        const processChunk = (startIdx: number) => {
          const endIdx = Math.min(startIdx + CHUNK_SIZE, validFlights.length);
          const chunk = validFlights.slice(startIdx, endIdx);

          chunk.forEach((state: unknown[]) => {
            try {
              const hex = state[0] as string;
              const lat = state[6] as number;
              const lon = state[5] as number;
              const alt = ((state[7] as number) || 10000) * 0.3048;
              const groundSpeed = state[9] as number || 0;
              const track = state[10] as number || 0;
              const flightCallsign = (state[1] as string)?.trim() || 'UNKNOWN';
              const registration = state[2] as string || '';
              const aircraftType = (state[18] as string) || '';
              const aircraftDesc = state[19] as string || '';
              const onGround = state[8] as boolean || false;
              const squawk = state[14] as string || '';

              const details = data.aircraftDetails?.[hex] || {};
              const airline = details.airline || '';
              const flightNumber = details.flightNumber || '';
              const airlineCode = details.airlineCode || '';
              const origin = details.origin || '';
              const originCity = details.originCity || '';
              const originCountry = details.originCountry || '';
              const originName = details.originName || '';
              const destination = details.destination || '';
              const destinationCity = details.destinationCity || '';
              const destinationCountry = details.destinationCountry || '';
              const destinationName = details.destinationName || '';
              const isMilitary = details.mil || aircraftType.includes('C-') || aircraftType.includes('KC-') || aircraftType.includes('F-') || aircraftType.includes('H60') || flightCallsign.includes('RCH') || flightCallsign.includes('CMV');

              const history = flightHistory.get(hex) || [];
              history.push({ lat, lon, time: Date.now() });
              if (history.length > 25) history.shift();
              newHistory.set(hex, history);

              newFlightHexes.add(hex);
              const existingEntities = flightEntitiesByHexRef.current.get(hex) || [];
              const mainEntity = existingEntities.find(e => e.id === `flight_${hex}`);

              if (mainEntity) {
                mainEntity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(lon, lat, alt));

                const mainBillboard = mainEntity.billboard as any;
                if (mainBillboard) {
                  mainBillboard.rotation = Cesium.Math.toRadians(-(track || 0) - 90);
                  mainBillboard.color = onGround ? Cesium.Color.GRAY : (isMilitary ? Cesium.Color.ORANGE : (details.emergency !== 'none' ? Cesium.Color.RED : Cesium.Color.CYAN));
                }

                const historyPoints = newHistory.get(hex);
                const trailEntity = existingEntities.find(e => e.id === `trail_${hex}`);
                if (trailEntity && historyPoints && historyPoints.length > 2 && showRoutes) {
                  const trailPositions: number[] = [];
                  historyPoints.forEach(p => trailPositions.push(p.lon, p.lat, alt));
                  (trailEntity.polyline as any).positions = new Cesium.ConstantProperty(Cesium.Cartesian3.fromDegreesArrayHeights(trailPositions));
                }

                const routeEntity = existingEntities.find(e => e.id === `route_${hex}`);
                if (destination && !onGround && showRoutes) {
                  const destCoords = getAirportCoords(destination);
                  if (destCoords && routeEntity) {
                    (routeEntity.polyline as any).positions = new Cesium.ConstantProperty(
                      Cesium.Cartesian3.fromDegreesArrayHeights([lon, lat, alt, destCoords.lon, destCoords.lat, 0])
                    );
                  }
                } else if (routeEntity && !showRoutes) {
                  viewer.entities.remove(routeEntity);
                  const idx = existingEntities.indexOf(routeEntity);
                  if (idx > -1) existingEntities.splice(idx, 1);
                }
              } else {
                const newEntities: Cesium.Entity[] = [];

                const entity = viewer.entities.add({
                  id: `flight_${hex}`,
                  name: flightCallsign || hex,
                  position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
                  billboard: {
                    image: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${onGround ? '#888888' : (isMilitary ? 'orange' : details.emergency !== 'none' ? 'red' : 'cyan')}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`),
                    width: 36,
                    height: 36,
                    rotation: Cesium.Math.toRadians(-(track || 0) - 90),
                    scaleByDistance: new Cesium.NearFarScalar(1e5, 0.4, 2e6, 1.0),
                    color: onGround ? Cesium.Color.GRAY : (isMilitary ? Cesium.Color.ORANGE : (details.emergency !== 'none' ? Cesium.Color.RED : Cesium.Color.CYAN)),
                  },
                  point: {
                    pixelSize: 0,
                    color: Cesium.Color.TRANSPARENT,
                  },
                  properties: {
                    hex,
                    callsign: flightCallsign,
                    registration: details.registration || registration,
                    aircraftType: details.aircraftType || aircraftType,
                    aircraftDesc: details.aircraftDesc || aircraftDesc,
                    lat,
                    lon,
                    altFeet: details.altBar || Math.round(alt / 0.3048),
                    groundSpeedKnots: Math.round(details.groundSpeed || groundSpeed),
                    groundSpeedKmh: details.groundSpeedKmh || Math.round((details.groundSpeed || groundSpeed) * 1.852),
                    track: Math.round(details.track || track),
                    trackDirection: details.trackDirection || getCardinalDirection(details.track || track),
                    onGround: details.onGround || onGround,
                    squawk: details.squawk || squawk,
                    isMilitary,
                    verticalSpeed: details.verticalSpeed || `${details.baro_rate > 0 ? '+' : ''}${Math.round((details.baro_rate || 0) * 196.85)} ft/min`,
                    verticalSpeedFpm: details.verticalSpeedFpm || Math.round((details.baro_rate || 0) * 196.85),
                    nac_p: details.nac_p || 0,
                    nic: details.nic || 0,
                    positionAccuracy: details.positionAccuracy || getPositionAccuracy(details.nac_p, details.nic),
                    signalStrength: details.rssi ? `${details.rssi.toFixed(1)} dBm` : 'Unknown',
                    rssi: details.rssi || null,
                    airline,
                    flightNumber,
                    airlineCode,
                    origin,
                    originCity,
                    originCountry,
                    originName,
                    destination,
                    destinationCity,
                    destinationCountry,
                    destinationName,
                    emergency: details.emergency || 'none',
                    alert: details.alert || false,
                    distance: details.distance || 0,
                    direction: details.direction || 0,
                    navAltitudeMcp: details.navAltitudeMcp || null,
                    navHeading: details.navHeading || null,
                    navQnh: details.navQnh || null,
                    operator: details.operator || '',
                    year: details.year || '',
                    messages: details.messages || 0,
                    seen: details.seen || 0,
                    sil: details.sil || 3,
                    silType: details.silType || 'perhour',
                    category: details.category || '',
                    altGeom: details.altGeom || 0,
                    details: JSON.stringify(details),
                  },
                  description: buildFlightDescription(hex, flightCallsign, details.registration || registration, details.aircraftType || aircraftType, details.aircraftDesc || aircraftDesc, lat, lon, alt, details.groundSpeed || groundSpeed, details.track || track, details.onGround || onGround, isMilitary, airline, flightNumber, origin, originCity, destination, destinationCity, destinationName, details.emergency)
                });
                newEntities.push(entity);

                if (!onGround && groundSpeed > 50) {
                  const headingEntity = viewer.entities.add({
                    id: `heading_${hex}`,
                    position: Cesium.Cartesian3.fromDegrees(lon, lat, alt + 500),
                    point: {
                      pixelSize: 3,
                      color: isMilitary ? Cesium.Color.ORANGE.withAlpha(0.7) : Cesium.Color.CYAN.withAlpha(0.7),
                    },
                  });
                  newEntities.push(headingEntity);
                }

                const historyPoints = newHistory.get(hex);
                if (historyPoints && historyPoints.length > 2 && showRoutes) {
                  const trailPositions: number[] = [];
                  historyPoints.forEach(p => trailPositions.push(p.lon, p.lat, alt));
                  const trailEntity = viewer.entities.add({
                    id: `trail_${hex}`,
                    polyline: {
                      positions: Cesium.Cartesian3.fromDegreesArrayHeights(trailPositions),
                      width: 1,
                      material: new Cesium.PolylineDashMaterialProperty({
                        color: isMilitary ? Cesium.Color.ORANGE.withAlpha(0.4) : Cesium.Color.CYAN.withAlpha(0.4),
                        dashLength: 8,
                      })
                    }
                  });
                  newEntities.push(trailEntity);
                }

                if (destination && !onGround && showRoutes) {
                  const destCoords = getAirportCoords(destination);
                  if (destCoords) {
                    const routeEntity = viewer.entities.add({
                      id: `route_${hex}`,
                      polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArrayHeights([lon, lat, alt, destCoords.lon, destCoords.lat, 0]),
                        width: 2,
                        material: new Cesium.PolylineGlowMaterialProperty({
                          glowPower: 0.3,
                          color: isMilitary ? Cesium.Color.ORANGE.withAlpha(0.7) : Cesium.Color.LIME.withAlpha(0.7),
                        })
                      }
                    });
                    newEntities.push(routeEntity);

                    const destMarker = viewer.entities.add({
                      id: `dest_${hex}`,
                      position: Cesium.Cartesian3.fromDegrees(destCoords.lon, destCoords.lat, 0),
                      point: {
                        pixelSize: 8,
                        color: Cesium.Color.YELLOW.withAlpha(0.8),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                      },
                      label: {
                        text: destination,
                        font: '10px JetBrains Mono',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                      }
                    });
                    newEntities.push(destMarker);
                  }
                }

                flightEntitiesByHexRef.current.set(hex, newEntities);
              }
            } catch (err) {
              // Skip invalid flights
            }
          });

          if (endIdx < validFlights.length) {
            requestAnimationFrame(() => processChunk(endIdx));
          } else {
            const allEntities: Cesium.Entity[] = [];
            flightEntitiesByHexRef.current.forEach(ents => allEntities.push(...ents));
            flightEntitiesRef.current = allEntities;
            setFlightHistory(newHistory);
            setFlightCount(validFlights.length);

            allFlightsDataRef.current = validFlights.map((state: unknown[]) => {
              const hex = state[0] as string;
              const details = data.aircraftDetails?.[hex] || {};
              return {
                hex,
                callsign: (state[1] as string)?.trim() || '',
                airline: details.airline || '',
                flightNumber: details.flightNumber || '',
                airlineCode: details.airlineCode || '',
                origin: details.origin || '',
                destination: details.destination || '',
                lat: state[6] as number,
                lon: state[5] as number,
              };
            });

            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              const results = allFlightsDataRef.current.filter(f => {
                const callsignMatch = f.callsign?.toLowerCase().includes(q);
                const flightNumMatch = f.flightNumber?.toLowerCase().includes(q);
                const airlineMatch = f.airline?.toLowerCase().includes(q);
                const hexMatch = f.hex?.toLowerCase().includes(q);
                const originMatch = f.origin?.toLowerCase().includes(q);
                const destMatch = f.destination?.toLowerCase().includes(q);
                return callsignMatch || flightNumMatch || airlineMatch || hexMatch || originMatch || destMatch;
              }).slice(0, 20);
              setSearchResults(results);
              setShowSearchResults(results.length > 0);
            }

            const trackedHex = trackedFlightHexRef.current;
            if (trackedHex && flightEntitiesByHexRef.current.has(trackedHex)) {
              const trackedEntity = viewer.entities.getById(`flight_${trackedHex}`);
              if (trackedEntity) {
                viewer.selectedEntity = trackedEntity;
              }
            }
          }
        };

        processChunk(0);
      } catch (error) {
        console.error('[FLIGHTS] Error:', error);
      }
    };

  // Helper functions
  const getCardinalDirection = (heading: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(heading / 22.5) % 16];
  };

const getPositionAccuracy = (nacP: number, _nic: number): string => {
  if (nacP >= 11) return '< 3m (GPS RTK)';
  if (nacP >= 10) return '< 10m (GPS PPP)';
  if (nacP >= 9) return '< 100m (ADS-B)';
  if (nacP >= 8) return '< 1nm';
  if (nacP >= 7) return '< 10nm';
  return 'Unknown';
};

// Airport coordinates for route visualization
const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  // North America
  'JFK': { lat: 40.6413, lon: -73.7781 }, 'LAX': { lat: 33.9425, lon: -118.4081 },
  'ORD': { lat: 41.9742, lon: -87.9073 }, 'DFW': { lat: 32.8998, lon: -97.0403 },
  'DEN': { lat: 39.8561, lon: -104.6737 }, 'ATL': { lat: 33.6407, lon: -84.4277 },
  'SFO': { lat: 37.6213, lon: -122.3790 }, 'SEA': { lat: 47.4502, lon: -122.3088 },
  'MIA': { lat: 25.7959, lon: -80.2870 }, 'BOS': { lat: 42.3656, lon: -71.0096 },
  'EWR': { lat: 40.6895, lon: -74.1745 }, 'PHX': { lat: 33.4373, lon: -112.0078 },
  'IAH': { lat: 29.9902, lon: -95.3368 }, 'LAS': { lat: 36.0840, lon: -115.1537 },
  'MSP': { lat: 44.8820, lon: -93.2218 }, 'DTW': { lat: 42.2162, lon: -83.3554 },
  'PHL': { lat: 39.8744, lon: -75.2424 }, 'FLL': { lat: 26.0742, lon: -80.1506 },
  'DCA': { lat: 38.8512, lon: -77.0402 }, 'IAD': { lat: 38.9531, lon: -77.4565 },
  'SAN': { lat: 32.7336, lon: -117.1897 }, 'TPA': { lat: 27.9755, lon: -82.5332 },
  'MCO': { lat: 28.4312, lon: -81.3081 }, 'PDX': { lat: 45.5898, lon: -122.5951 },
  'STL': { lat: 38.7499, lon: -90.3700 }, 'BNA': { lat: 36.1263, lon: -86.6774 },
  'AUS': { lat: 30.1945, lon: -97.6699 }, 'RDU': { lat: 35.8801, lon: -78.7880 },
  'CLT': { lat: 35.2140, lon: -80.9431 }, 'SLC': { lat: 40.7899, lon: -111.9791 },
  'MCI': { lat: 39.2976, lon: -94.7139 }, 'SAT': { lat: 29.5337, lon: -98.4698 },
  'ABQ': { lat: 35.0402, lon: -106.6092 }, 'TUS': { lat: 32.1161, lon: -110.9410 },
  'HOU': { lat: 29.6455, lon: -95.2789 }, 'MDW': { lat: 41.7868, lon: -87.7522 },
  'MSY': { lat: 29.9934, lon: -90.2580 }, 'OMA': { lat: 41.3032, lon: -95.8941 },
  'BWI': { lat: 39.1774, lon: -76.6684 }, 'RSW': { lat: 26.5362, lon: -81.7552 },
  'PBI': { lat: 26.6832, lon: -80.0956 }, 'JAX': { lat: 30.4941, lon: -81.6879 },
  'MEM': { lat: 35.0421, lon: -89.9792 }, 'BHM': { lat: 33.5641, lon: -86.7455 },
  'SJC': { lat: 37.3639, lon: -121.9292 }, 'ONT': { lat: 34.0560, lon: -117.6004 },
  'SNA': { lat: 33.6757, lon: -117.8682 }, 'BUR': { lat: 34.2006, lon: -118.3585 },
  'LGB': { lat: 33.8177, lon: -118.1516 }, 'HNL': { lat: 21.3187, lon: -157.9225 },
  'ANC': { lat: 61.1743, lon: -149.9962 }, 'YYZ': { lat: 43.6777, lon: -79.6248 },
  'YVR': { lat: 49.1967, lon: -123.1815 }, 'YYC': { lat: 51.1215, lon: -114.0076 },
  'MEX': { lat: 19.4363, lon: -99.0721 }, 'GUM': { lat: 13.4834, lon: 144.7960 },
  // Europe
  'LHR': { lat: 51.4700, lon: -0.4543 }, 'CDG': { lat: 49.0097, lon: 2.5479 },
  'FRA': { lat: 50.0379, lon: 8.5622 }, 'AMS': { lat: 52.3105, lon: 4.7683 },
  'MAD': { lat: 40.4983, lon: -3.5676 }, 'MUC': { lat: 48.3537, lon: 11.7750 },
  'FCO': { lat: 41.8003, lon: 12.2389 }, 'BCN': { lat: 41.2974, lon: 2.0833 },
  'LGW': { lat: 51.1537, lon: -0.1821 }, 'ZRH': { lat: 47.4647, lon: 8.5492 },
  'VIE': { lat: 48.1103, lon: 16.5697 }, 'BRU': { lat: 50.9014, lon: 4.4844 },
  'DUB': { lat: 53.4264, lon: -6.2499 }, 'IST': { lat: 41.2753, lon: 28.7519 },
  'ATH': { lat: 37.9364, lon: 23.9475 }, 'WAW': { lat: 52.1657, lon: 20.9671 },
  'BUD': { lat: 47.4294, lon: 19.2613 }, 'PRG': { lat: 50.1008, lon: 14.2600 },
  'CPH': { lat: 55.6180, lon: 12.6560 }, 'OSL': { lat: 60.1939, lon: 11.1004 },
  'ARN': { lat: 59.6519, lon: 17.9186 }, 'HEL': { lat: 60.3172, lon: 24.9633 },
  'LIS': { lat: 38.7756, lon: -9.1354 }, 'MXP': { lat: 45.6306, lon: 8.7281 },
  'VCE': { lat: 45.5053, lon: 12.3522 }, 'NCE': { lat: 43.6584, lon: 7.2159 },
  'GVA': { lat: 46.2381, lon: 6.1089 }, 'MLA': { lat: 35.8574, lon: 14.4774 },
  // Middle East
  'DXB': { lat: 25.2532, lon: 55.3657 }, 'AUH': { lat: 24.4330, lon: 54.6511 },
  'DOH': { lat: 25.2609, lon: 51.6138 }, 'JED': { lat: 21.6796, lon: 39.1565 },
  'RUH': { lat: 24.9578, lon: 46.6989 }, 'CAI': { lat: 30.1219, lon: 31.4056 },
  'TLV': { lat: 32.0054, lon: 34.8854 }, 'AMM': { lat: 31.9726, lon: 35.9769 },
  'BEY': { lat: 33.8209, lon: 35.4884 }, 'KWI': { lat: 29.2266, lon: 47.9689 },
  'BAH': { lat: 26.2708, lon: 50.6336 }, 'MCT': { lat: 23.5933, lon: 58.2889 },
  // Asia
  'BOM': { lat: 19.0896, lon: 72.8656 }, 'DEL': { lat: 28.5665, lon: 77.1031 },
  'SIN': { lat: 1.3644, lon: 103.9915 }, 'HKG': { lat: 22.3080, lon: 113.9185 },
  'NRT': { lat: 35.7720, lon: 140.3929 }, 'HND': { lat: 35.5494, lon: 139.7798 },
  'KIX': { lat: 34.4273, lon: 135.2444 }, 'ICN': { lat: 37.4602, lon: 126.4407 },
  'PEK': { lat: 40.0799, lon: 116.6031 }, 'PVG': { lat: 31.1434, lon: 121.8052 },
  'CAN': { lat: 23.3924, lon: 113.2988 }, 'CTU': { lat: 30.5785, lon: 104.0650 },
  'CKG': { lat: 29.7196, lon: 106.6425 }, 'XIY': { lat: 34.4471, lon: 108.7516 },
  'WUH': { lat: 30.7838, lon: 114.2081 }, 'NKG': { lat: 31.7420, lon: 118.8620 },
  'SZX': { lat: 22.6393, lon: 113.8108 }, 'BKK': { lat: 13.6900, lon: 100.7501 },
  'KUL': { lat: 2.7456, lon: 101.7072 }, 'CGK': { lat: -6.1275, lon: 106.6537 },
  'MNL': { lat: 14.5086, lon: 121.0194 }, 'TPE': { lat: 25.0797, lon: 121.2342 },
  'KTM': { lat: 27.6966, lon: 85.3594 }, 'CMB': { lat: 7.1809, lon: 79.8841 },
  'MLE': { lat: 4.1918, lon: 73.5292 }, 'DAC': { lat: 23.9903, lon: 90.4025 },
  'ISB': { lat: 33.6167, lon: 72.8333 }, 'LHE': { lat: 31.5216, lon: 74.4033 },
  'KHI': { lat: 24.8934, lon: 67.1612 }, 'HYD': { lat: 17.2403, lon: 78.4294 },
  'BLR': { lat: 13.1979, lon: 77.7063 }, 'MAA': { lat: 12.9941, lon: 80.1709 },
  'CCU': { lat: 22.6547, lon: 88.4468 }, 'NGO': { lat: 34.4347, lon: 136.8036 },
  'PUS': { lat: 35.1796, lon: 128.9382 }, 'CJU': { lat: 33.5113, lon: 126.4928 },
  // Oceania
  'SYD': { lat: -33.9399, lon: 151.1753 }, 'MEL': { lat: -37.6690, lon: 144.8410 },
  'AKL': { lat: -37.0082, lon: 174.7850 },
  // South America
  'GRU': { lat: -23.4356, lon: -46.4731 }, 'EZE': { lat: -34.8222, lon: -58.5358 },
  'SCL': { lat: -33.3930, lon: -70.7856 }, 'LIM': { lat: -12.0219, lon: -77.1143 },
  'BOG': { lat: 4.7016, lon: -74.1469 },
};

const getAirportCoords = (code: string): { lat: number; lon: number } | null => {
  return AIRPORT_COORDS[code?.toUpperCase()] || null;
};

  const buildFlightDescription = (
    hex: string,
    callsign: string,
    registration: string,
    type: string,
    desc: string,
    lat: number,
    lon: number,
    alt: number,
    speed: number,
    track: number,
    onGround: boolean,
    isMilitary: boolean,
    airline?: string,
    flightNumber?: string,
    origin?: string,
    originCity?: string,
    destination?: string,
    destinationCity?: string,
    destinationName?: string,
    emergency?: string
  ): string => {
    const emergencyText = emergency && emergency !== 'none' ? `\n⚠️ **EMERGENCY: ${emergency.toUpperCase()}**` : '';
    const milText = isMilitary ? '\n⚠️ **MILITARY AIRCRAFT**' : '';

    return `**${callsign || 'Unknown'}** (${hex})${emergencyText}${milText}

**Flight Info**
Airline: ${airline || 'Unknown'}
Flight Number: ${flightNumber || 'N/A'}
${origin ? `Origin: ${originCity || origin} (${origin})` : 'Origin: Unknown'}
${destination ? `Destination: ${destinationCity || destination} (${destination})` : 'Destination: Unknown'}
${destinationName && destinationName !== destination ? `  -> ${destinationName}` : ''}

**Aircraft**
Type: ${type || 'Unknown'}
Registration: ${registration || 'N/A'}
Description: ${desc || 'N/A'}

**Position**
Latitude: ${lat.toFixed(4)}°
Longitude: ${lon.toFixed(4)}°
Altitude: ${Math.round(alt / 0.3048)} ft
Ground Speed: ${Math.round(speed)} knots (${Math.round(speed * 1.852)} km/h)
Heading: ${Math.round(track)}° ${getCardinalDirection(track)}
Status: ${onGround ? '🛫 On Ground' : '✈️ Airborne'}

*Click to see full details*`;
  };

fetchFlights();
    const interval = setInterval(fetchFlights, refreshInterval);

    return () => {
      clearInterval(interval);
      clearAllFlights();
    };
  }, [viewer, layers.flights, refreshInterval, showRoutes]);

  // Satellites layer
  useEffect(() => {
    if (!viewer) return;

    const clearSatellites = () => {
      satelliteEntitiesRef.current.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      satelliteEntitiesRef.current = [];
    };

    if (!layers.satellites) {
      clearSatellites();
      setSatelliteCount(0);
      return;
    }

    const fetchSatellites = async () => {
      setSatellitesLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/satellites`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const lines = text.trim().split('\n');

        clearSatellites();

        const satellites: SatelliteData[] = [];
        for (let i = 0; i < Math.min(lines.length, 600); i += 3) {
          if (i + 2 < lines.length) {
            const name = lines[i]?.trim();
            const line1 = lines[i + 1]?.trim();
            const line2 = lines[i + 2]?.trim();
            if (name && line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
              satellites.push({ name, line1, line2 });
            }
          }
        }

        satellitesDataRef.current = satellites;

        const now = new Date();
        const entities: Cesium.Entity[] = [];

        satellites.forEach(sat => {
          try {
            const satrec = twoline2satrec(sat.line1, sat.line2);
            const positionAndVelocity = propagate(satrec, now);

            if (positionAndVelocity.position && typeof positionAndVelocity.position === 'object') {
              const positionEci = positionAndVelocity.position;
              const gmst = gstime(now);
              const positionGd = eciToGeodetic(positionEci, gmst);

              const entity = viewer.entities.add({
                id: sat.name,
                name: sat.name,
                position: Cesium.Cartesian3.fromDegrees(
                  Cesium.Math.toDegrees(positionGd.longitude),
                  Cesium.Math.toDegrees(positionGd.latitude),
                  positionGd.height * 1000
                ),
                point: {
                  pixelSize: 4,
                  color: Cesium.Color.LIME.withAlpha(0.85),
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 1,
                  scaleByDistance: new Cesium.NearFarScalar(1.5e2, 4.0, 1.5e7, 0.5)
                },
                description: `**${sat.name}**\n\nClick to track orbital path`
              });
              entities.push(entity);
            }
          } catch {}
        });

        satelliteEntitiesRef.current = entities;
        setSatelliteCount(satellites.length);
      } catch (error) {
        console.error('[SATELLITES] Error:', error);
      } finally {
        setSatellitesLoading(false);
      }
    };

    fetchSatellites();
    const interval = setInterval(fetchSatellites, 60000);

    return () => {
      clearInterval(interval);
      clearSatellites();
    };
  }, [viewer, layers.satellites]);

  // GPS Jamming layer
  useEffect(() => {
    if (!viewer) return;

    const clearGPSJamming = () => {
      gpsJammingEntitiesRef.current.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      gpsJammingEntitiesRef.current = [];
    };

    if (!layers.gpsJamming) {
      clearGPSJamming();
      setGpsJammingCount(0);
      return;
    }

    const fetchGPSJamming = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/gps-jamming`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        clearGPSJamming();

        if (data.zones && data.zones.length > 0) {
          const entities: Cesium.Entity[] = [];

          data.zones.forEach((zone: GPSZone) => {
            const entity = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat, 0),
              ellipse: {
                semiMinorAxis: 50000 * zone.intensity,
                semiMajorAxis: 50000 * zone.intensity,
                material: Cesium.Color.RED.withAlpha(0.4 * zone.intensity),
                outline: true,
                outlineColor: Cesium.Color.RED.withAlpha(0.8),
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
              },
              description: `**GPS Interference**\n\nAircraft affected: ${zone.count}\nIntensity: ${Math.round(zone.intensity * 100)}%`
            });
            entities.push(entity);
          });

          gpsJammingEntitiesRef.current = entities;
          setGpsJammingCount(data.zones.length);
        }
      } catch (error) {
        console.error('[GPSJAMMING] Error:', error);
      }
    };

    fetchGPSJamming();
    const interval = setInterval(fetchGPSJamming, 60000);

    return () => {
      clearInterval(interval);
      clearGPSJamming();
    };
  }, [viewer, layers.gpsJamming]);

  // Maritime layer
  useEffect(() => {
    if (!viewer) return;

    const clearMaritime = () => {
      maritimeEntitiesRef.current.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      maritimeEntitiesRef.current = [];
    };

    if (!layers.maritime) {
      clearMaritime();
      setMaritimeCount(0);
      return;
    }

    const fetchMaritime = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/maritime`);
        const data = await response.json();

        clearMaritime();

        if (data.vessels && data.vessels.length > 0) {
          const entities: Cesium.Entity[] = [];

          data.vessels.forEach((vessel: MaritimeVessel) => {
            const isWarship = vessel.type === 'warship';
            const entity = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(vessel.lon, vessel.lat, 0),
              point: {
                pixelSize: isWarship ? 8 : 6,
                color: isWarship ? Cesium.Color.RED : Cesium.Color.BLUE,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
              },
              description: `**${vessel.name}**\n\nType: ${vessel.type}\nFlag: ${vessel.flag}\nSpeed: ${vessel.speed} knots\nHeading: ${vessel.heading}°\nMMSI: ${vessel.mmsi}`
            });
            entities.push(entity);
          });

          maritimeEntitiesRef.current = entities;
          setMaritimeCount(data.vessels.length);
        }
      } catch (error) {
        console.error('[MARITIME] Error:', error);
      }
    };

    fetchMaritime();
    const interval = setInterval(fetchMaritime, 60000);

    return () => {
      clearInterval(interval);
      clearMaritime();
    };
  }, [viewer, layers.maritime]);

  // No-fly zones layer
  useEffect(() => {
    if (!viewer) return;

    const clearNoFlyZones = () => {
      noFlyZoneEntitiesRef.current.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      noFlyZoneEntitiesRef.current = [];
    };

    if (!layers.noflyzones) {
      clearNoFlyZones();
      setNoFlyZoneCount(0);
      return;
    }

    const fetchNoFlyZones = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/noflyzones`);
        const data = await response.json();

        clearNoFlyZones();

        if (data.zones && data.zones.length > 0) {
          const entities: Cesium.Entity[] = [];

          data.zones.forEach((zone: NoFlyZone) => {
            let color = Cesium.Color.GRAY.withAlpha(0.3);
            if (zone.type === 'danger') color = Cesium.Color.RED.withAlpha(0.4);
            else if (zone.type === 'restricted') color = Cesium.Color.ORANGE.withAlpha(0.4);
            else if (zone.type === 'caution') color = Cesium.Color.YELLOW.withAlpha(0.3);
            else if (zone.type === 'temporary') color = Cesium.Color.MAGENTA.withAlpha(0.3);

            const entity = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat, 0),
              ellipse: {
                semiMinorAxis: zone.radius,
                semiMajorAxis: zone.radius,
                material: color,
                outline: true,
                outlineColor: color.withAlpha(0.8),
                outlineWidth: 3,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
              },
              description: `**${zone.name}**\n\nType: ${zone.type}\nLevel: ${zone.level}\nRadius: ${zone.radius / 1000} km\nActive: ${zone.active ? 'YES' : 'NO'}`
            });
            entities.push(entity);
          });

          noFlyZoneEntitiesRef.current = entities;
          setNoFlyZoneCount(data.zones.length);
        }
      } catch (error) {
        console.error('[NOFLYZONES] Error:', error);
      }
    };

fetchNoFlyZones();

return () => {
clearNoFlyZones();
};
}, [viewer, layers.noflyzones]);

// News layer effect
useEffect(() => {
if (!viewer) return;

const clearNews = () => {
newsEntitiesRef.current.forEach(entity => {
viewer.entities.remove(entity);
});
newsEntitiesRef.current = [];
};

if (!layers.news) {
clearNews();
setNewsCount(0);
return;
}

const fetchNews = async () => {
try {
const response = await fetch(`${API_BASE}/api/news/geo?q=conflict protest military disaster war&timespan=24h`);
const data = await response.json();

clearNews();

if (data.articles && data.articles.length > 0) {
setNewsCount(data.articles.length);

const container = document.querySelector('.news-articles-container');
if (container) {
container.innerHTML = data.articles.slice(0, 10).map((article: any) => `
<div class="news-item" onclick="window.open('${article.url}', '_blank')">
<div class="news-title">${article.title?.substring(0, 80) || 'Untitled'}${article.title?.length > 80 ? '...' : ''}</div>
<div class="news-meta">${article.source} • ${article.language}</div>
</div>
`).join('');
}
}
} catch (error) {
console.error('[NEWS] Error:', error);
}
};

fetchNews();
const interval = setInterval(fetchNews, 900000);

return () => {
clearInterval(interval);
clearNews();
};
}, [viewer, layers.news]);

// Satellite imagery layer effect
useEffect(() => {
if (!viewer) return;

const imageryLayers = viewer.scene.imageryLayers;

if (layers.satelliteImagery) {
const satelliteLayer = imageryLayers.addImageryProvider(
new Cesium.UrlTemplateImageryProvider({
url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
maximumLevel: 19
})
);
satelliteLayer.alpha = 0.85;
} else {
if (imageryLayers.length > 1) {
imageryLayers.remove(imageryLayers.get(imageryLayers.length - 1));
}
}
}, [viewer, layers.satelliteImagery]);

useEffect(() => {
if (!viewer) return;

const clearIntelligence = () => {
viewer.entities.values.filter((e: any) => e.id?.startsWith('intel_')).forEach((e: any) => viewer.entities.remove(e));
};

if (!layers.intelligence) {
clearIntelligence();
return;
}

const fetchIntelligence = async () => {
try {
const response = await fetch(`${API_BASE}/api/intelligence/index`);
const data = await response.json();

const countryCoords: Record<string, [number, number]> = {
'US': [-98, 38], 'CN': [105, 35], 'RU': [100, 60], 'IR': [53, 32],
'KP': [127, 40], 'SY': [38, 35], 'YE': [45, 15], 'UA': [30, 50],
'AF': [66, 33], 'IQ': [44, 33], 'VE': [-66, 7], 'ZW': [29, -19],
'SD': [30, 15], 'LY': [17, 27], 'SO': [46, 5], 'MM': [96, 21],
'BY': [28, 53], 'VN': [108, 16], 'SA': [45, 25], 'IL': [35, 31],
'PK': [70, 30], 'IN': [78, 22], 'BR': [-52, -10], 'ZA': [25, -29],
'NG': [8, 10], 'EG': [30, 27], 'TR': [35, 39], 'JP': [138, 36],
'DE': [10, 51], 'GB': [-2, 52], 'FR': [2, 46], 'KR': [128, 36]
};

if (data.data) {
Object.entries(data.data).forEach(([country, info]: [string, any]) => {
const coords = countryCoords[country] || [0, 20];
const riskColor = info.score > 70 ? Cesium.Color.RED.withAlpha(0.4) :
info.score > 40 ? Cesium.Color.ORANGE.withAlpha(0.3) :
Cesium.Color.LIME.withAlpha(0.2);

viewer.entities.add({
id: `intel_${country}`,
position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], 0),
ellipse: {
semiMajorAxis: 800000,
semiMinorAxis: 600000,
material: riskColor,
outline: true,
outlineColor: info.score > 70 ? Cesium.Color.RED : info.score > 40 ? Cesium.Color.ORANGE : Cesium.Color.LIME,
outlineWidth: 2
},
label: {
text: `${country}: ${info.score}`,
font: '12px monospace',
fillColor: Cesium.Color.WHITE,
outlineColor: Cesium.Color.BLACK,
outlineWidth: 2,
verticalOrigin: Cesium.VerticalOrigin.CENTER,
pixelOffset: new Cesium.Cartesian2(0, 0)
},
description: `**Country:** ${country}\\n**Risk Score:** ${info.score}/100\\n**Category:** ${info.category}\\n**Trend:** ${info.trend}\\n**Factors:** ${info.factors.join(', ')}`
});
});
}
} catch (error) {
console.error('[INTELLIGENCE] Error:', error);
}
};

fetchIntelligence();
}, [viewer, layers.intelligence]);

useEffect(() => {
if (!viewer) return;

const clearFinance = () => {
viewer.entities.values.filter((e: any) => e.id?.startsWith('finance_')).forEach((e: any) => viewer.entities.remove(e));
};

if (!layers.finance) {
clearFinance();
return;
}

const fetchFinance = async () => {
try {
const response = await fetch(`${API_BASE}/api/finance/radar`);
const data = await response.json();

if (data.data) {
const financeLocations: Record<string, [number, number]> = {
'SPX': [-74, 40], 'NDX': [-74, 40], 'DJI': [-74, 40],
'FTSE': [-0.1, 51.5], 'DAX': [8.6, 50.1], 'N225': [139.7, 35.7],
'HSI': [114.1, 22.3], 'SSEC': [121.5, 31.2]
};

data.data.indices?.forEach((idx: any) => {
const coords = financeLocations[idx.symbol] || [0, 0];
const color = idx.change >= 0 ? Cesium.Color.LIME : Cesium.Color.RED;

viewer.entities.add({
id: `finance_idx_${idx.symbol}`,
position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], 0),
point: {
pixelSize: 12,
color: color,
outlineColor: Cesium.Color.WHITE,
outlineWidth: 1
},
label: {
text: `${idx.symbol}: ${idx.price.toFixed(0)} (${idx.change >= 0 ? '+' : ''}${idx.change.toFixed(2)}%)`,
font: '11px monospace',
fillColor: Cesium.Color.WHITE,
outlineColor: Cesium.Color.BLACK,
outlineWidth: 2,
verticalOrigin: Cesium.VerticalOrigin.TOP,
pixelOffset: new Cesium.Cartesian2(0, 10)
}
});
});

data.data.crypto?.forEach((crypto: any) => {
const cryptoLat = crypto.symbol === 'BTC' ? 40.7 : crypto.symbol === 'ETH' ? 37.8 : 35.7;
const cryptoLon = crypto.symbol === 'BTC' ? -74.0 : crypto.symbol === 'ETH' ? -122.4 : -122.4;

viewer.entities.add({
id: `finance_crypto_${crypto.symbol}`,
position: Cesium.Cartesian3.fromDegrees(cryptoLon, cryptoLat, 0),
point: {
pixelSize: 10,
color: crypto.change >= 0 ? Cesium.Color.CYAN : Cesium.Color.RED
},
label: {
text: `${crypto.symbol}: $${crypto.price.toLocaleString()} (${crypto.change >= 0 ? '+' : ''}${crypto.change.toFixed(2)}%)`,
font: '10px monospace',
fillColor: Cesium.Color.CYAN,
outlineColor: Cesium.Color.BLACK,
outlineWidth: 2,
verticalOrigin: Cesium.VerticalOrigin.TOP
}
});
});
}
} catch (error) {
console.error('[FINANCE] Error:', error);
}
};

fetchFinance();
}, [viewer, layers.finance]);

useEffect(() => {
if (!viewer) return;

const clearWeather = () => {
viewer.entities.values.filter((e: any) => e.id?.startsWith('weather_')).forEach((e: any) => viewer.entities.remove(e));
};

if (!layers.weather) {
clearWeather();
return;
}

const fetchWeather = async () => {
try {
const response = await fetch(`${API_BASE}/api/weather`);
const data = await response.json();

if (data.data) {
data.data.storms?.forEach((storm: any) => {
const catColor = storm.category?.includes('typhoon') || storm.category?.includes('hurricane') ? Cesium.Color.RED :
storm.category?.includes('cyclon') ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;

viewer.entities.add({
id: `weather_storm_${storm.id}`,
position: Cesium.Cartesian3.fromDegrees(storm.lon, storm.lat, 0),
point: {
pixelSize: 20,
color: catColor.withAlpha(0.8),
outlineColor: Cesium.Color.WHITE,
outlineWidth: 2
},
label: {
text: `⚠️ ${storm.name}\nWind: ${storm.wind} km/h`,
font: '11px monospace',
fillColor: Cesium.Color.WHITE,
outlineColor: Cesium.Color.BLACK,
outlineWidth: 2,
verticalOrigin: Cesium.VerticalOrigin.BOTTOM
},
description: `**Storm:** ${storm.name}\n**Category:** ${storm.category}\n**Wind:** ${storm.wind} km/h\n**Pressure:** ${storm.pressure} hPa\n**Movement:** ${storm.movement}`
});
});

data.data.temperature?.forEach((temp: any) => {
const tempColor = temp.temp > 30 ? Cesium.Color.RED : temp.temp > 20 ? Cesium.Color.YELLOW : temp.temp > 10 ? Cesium.Color.LIME : Cesium.Color.CYAN;

viewer.entities.add({
id: `weather_temp_${temp.lat}_${temp.lon}`,
position: Cesium.Cartesian3.fromDegrees(temp.lon, temp.lat, 0),
point: {
pixelSize: 8,
color: tempColor.withAlpha(0.6)
}
});
});
}
} catch (error) {
console.error('[WEATHER] Error:', error);
}
};

fetchWeather();
}, [viewer, layers.weather]);

useEffect(() => {
if (!viewer) return;

const clearInfrastructure = () => {
viewer.entities.values.filter((e: any) => e.id?.startsWith('infra_')).forEach((e: any) => viewer.entities.remove(e));
};

if (!layers.infrastructure) {
clearInfrastructure();
return;
}

const fetchInfrastructure = async () => {
try {
const response = await fetch(`${API_BASE}/api/infrastructure`);
const data = await response.json();

if (data.data) {
data.data.powerPlants?.forEach((plant: any) => {
const typeColor = plant.type === 'nuclear' ? Cesium.Color.YELLOW :
plant.type === 'coal' ? Cesium.Color.GRAY :
plant.type === 'natural_gas' ? Cesium.Color.ORANGE :
Cesium.Color.LIME;

viewer.entities.add({
id: `infra_power_${plant.name.replace(/\s/g, '_')}`,
position: Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat, 0),
point: {
pixelSize: 10,
color: typeColor,
outlineColor: Cesium.Color.WHITE,
outlineWidth: 1
},
label: {
text: `⚡ ${plant.name.substring(0, 15)}`,
font: '9px monospace',
fillColor: Cesium.Color.WHITE,
outlineColor: Cesium.Color.BLACK,
outlineWidth: 1,
verticalOrigin: Cesium.VerticalOrigin.TOP
},
description: `**Plant:** ${plant.name}\n**Type:** ${plant.type}\n**Capacity:** ${plant.capacity} MW\n**Status:** ${plant.status}`
});
});

data.data.datacenters?.forEach((dc: any) => {
  if (!layers.datacenters) return;
  viewer.entities.add({
    id: `infra_dc_${dc.name.replace(/\s/g, '_')}`,
    position: Cesium.Cartesian3.fromDegrees(dc.lon, dc.lat, 0),
    point: {
      pixelSize: 8,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1
    },
    label: {
      text: '💾 DC',
      font: '9px monospace',
      fillColor: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      verticalOrigin: Cesium.VerticalOrigin.TOP
    }
  });
});

if (layers.cables && data.data.submarineCables) {
  data.data.submarineCables.forEach((cable: any) => {
    if (cable.path && cable.path.length >= 2) {
      const positions = cable.path.map((p: number[]) => Cesium.Cartesian3.fromDegrees(p[1], p[0], 0));
      viewer.entities.add({
        id: `infra_cable_${cable.name.replace(/\s/g, '_')}`,
        polyline: {
          positions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN.withAlpha(0.8)
          })
        },
        description: `**Cable:** ${cable.name}\n**Type:** Submarine Fiber Optic`
      });
    }
  });
}

if (layers.outages && data.data.internetOutages) {
  data.data.internetOutages.forEach((outage: any) => {
    const severityColor = outage.severity === 'major' ? Cesium.Color.RED : Cesium.Color.ORANGE;
    viewer.entities.add({
      id: `infra_outage_${outage.region.replace(/\s/g, '_')}`,
      position: Cesium.Cartesian3.fromDegrees(outage.lon, outage.lat, 0),
      point: {
        pixelSize: 12,
        color: severityColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: `⚠️ ${outage.region.split(',')[0]}`,
        font: '10px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, -15)
      },
      description: `**Region:** ${outage.region}\n**Severity:** ${outage.severity}\n**Duration:** ${outage.duration}`
    });
  });
}

if (layers.cloudRegions) {
  const cloudRegions = [
    { name: 'AWS US-East', lat: 38.8, lon: -77.0, provider: 'AWS' },
    { name: 'AWS EU-West', lat: 51.5, lon: -0.1, provider: 'AWS' },
    { name: 'Azure East US', lat: 36.0, lon: -78.9, provider: 'Azure' },
    { name: 'Azure West Europe', lat: 52.3, lon: 4.9, provider: 'Azure' },
    { name: 'GCP US-Central', lat: 41.9, lon: -87.6, provider: 'GCP' },
    { name: 'GCP EU-West', lat: 53.3, lon: -6.3, provider: 'GCP' }
  ];
  cloudRegions.forEach((region: any) => {
    const providerColor = region.provider === 'AWS' ? Cesium.Color.ORANGE :
                          region.provider === 'Azure' ? Cesium.Color.CYAN : Cesium.Color.LIME;
    viewer.entities.add({
      id: `cloud_${region.name.replace(/\s/g, '_')}`,
      position: Cesium.Cartesian3.fromDegrees(region.lon, region.lat, 0),
      point: {
        pixelSize: 10,
        color: providerColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1
      },
      label: {
        text: `☁️ ${region.name}`,
        font: '9px monospace',
        fillColor: providerColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        verticalOrigin: Cesium.VerticalOrigin.TOP
      }
    });
  });
}

if (layers.techHQs) {
  const techHQs = [
    { name: 'Google HQ', lat: 37.4220, lon: -122.0841 },
    { name: 'Meta HQ', lat: 37.4848, lon: -122.1483 },
    { name: 'Apple HQ', lat: 37.3318, lon: -122.0312 },
    { name: 'Microsoft HQ', lat: 47.6395, lon: -122.1285 },
    { name: 'Amazon HQ', lat: 47.6223, lon: -122.3378 },
    { name: 'OpenAI', lat: 37.4075, lon: -122.1467 }
  ];
  techHQs.forEach((hq: any) => {
    viewer.entities.add({
      id: `techhq_${hq.name.replace(/\s/g, '_')}`,
      position: Cesium.Cartesian3.fromDegrees(hq.lon, hq.lat, 0),
      point: {
        pixelSize: 10,
        color: Cesium.Color.PURPLE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1
      },
      label: {
        text: `🏢 ${hq.name}`,
        font: '9px monospace',
        fillColor: Cesium.Color.PURPLE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        verticalOrigin: Cesium.VerticalOrigin.TOP
      }
    });
  });
}

if (layers.startupHubs) {
  const startupHubs = [
    { name: 'Silicon Valley', lat: 37.3875, lon: -122.0575 },
    { name: 'NYC', lat: 40.7128, lon: -74.0060 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
    { name: 'Tel Aviv', lat: 32.0853, lon: 34.7818 },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198 }
  ];
  startupHubs.forEach((hub: any) => {
    viewer.entities.add({
      id: `startup_${hub.name.replace(/\s/g, '_')}`,
      position: Cesium.Cartesian3.fromDegrees(hub.lon, hub.lat, 0),
      point: {
        pixelSize: 8,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1
      },
      label: {
        text: `🚀 ${hub.name}`,
        font: '9px monospace',
        fillColor: Cesium.Color.LIME,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        verticalOrigin: Cesium.VerticalOrigin.TOP
      }
    });
  });
}
}
} catch (error) {
console.error('[INFRASTRUCTURE] Error:', error);
}
};

fetchInfrastructure();
}, [viewer, layers.infrastructure, layers.cables, layers.outages, layers.datacenters, layers.cloudRegions, layers.techHQs, layers.startupHubs, layers.hackerEvents]);

useEffect(() => {
  if (!viewer) return;

  const clearHackerEvents = () => {
    viewer.entities.values.filter((e: any) => e.id?.startsWith('hacker_')).forEach((e: any) => viewer.entities.remove(e));
  };

  if (!layers.hackerEvents) {
    clearHackerEvents();
    return;
  }

  const fetchHackerEvents = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tech/events`);
      const data = await response.json();

      if (data.events) {
        const securityEvents = data.events.filter((e: any) => e.type === 'security');
        const eventLocations: Record<string, { lat: number; lon: number }> = {
          'Las Vegas, USA': { lat: 36.1699, lon: -115.1398 },
          'San Francisco, USA': { lat: 37.7749, lon: -122.4194 }
        };

        securityEvents.forEach((event: any) => {
          const coords = eventLocations[event.location] || { lat: 37.7749, lon: -122.4194 };
          viewer.entities.add({
            id: `hacker_${event.name.replace(/\s/g, '_')}`,
            position: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, 0),
            point: {
              pixelSize: 12,
              color: Cesium.Color.RED,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2
            },
            label: {
              text: `💀 ${event.name}`,
              font: '10px monospace',
              fillColor: Cesium.Color.RED,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, -15)
            },
            description: `**Event:** ${event.name}\n**Location:** ${event.location}\n**Date:** ${event.date}\n**Attendees:** ${event.attendees?.toLocaleString()}`
          });
        });
      }
    } catch (error) {
      console.error('[HACKER EVENTS] Error:', error);
    }
  };

  fetchHackerEvents();
}, [viewer, layers.hackerEvents]);

useEffect(() => {
  if (!viewer) return;

  const clearPowerPlants = () => {
    viewer.entities.values.filter((e: any) => e.id?.startsWith('powerplant_')).forEach((e: any) => viewer.entities.remove(e));
  };

  if (!layers.powerPlants) {
    clearPowerPlants();
    return;
  }

  const fetchPowerPlants = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/power-plants`);
      const data = await response.json();

      if (data.plants) {
        const fuelColors: Record<string, Cesium.Color> = {
          coal: Cesium.Color.DARKGRAY,
          gas: Cesium.Color.ORANGE,
          nuclear: Cesium.Color.YELLOW,
          hydro: Cesium.Color.CYAN,
          oil: Cesium.Color.RED,
          wind: Cesium.Color.LIME,
          solar: Cesium.Color.GOLD,
          biomass: Cesium.Color.LIGHTGREEN
        };

        data.plants.forEach((plant: any) => {
          const color = fuelColors[plant.fuel] || Cesium.Color.WHITE;
          const size = Math.min(20, Math.max(6, Math.log10(plant.capacity) * 4));

          viewer.entities.add({
            id: `powerplant_${plant.name.replace(/\s/g, '_')}`,
            position: Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat, 0),
            point: {
              pixelSize: size,
              color: color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1
            },
            label: {
              text: `⚡ ${plant.name.substring(0, 18)}`,
              font: '9px monospace',
              fillColor: color,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, -size - 2)
            },
            description: `**${plant.name}**\n**Country:** ${plant.country}\n**Capacity:** ${plant.capacity} MW\n**Fuel:** ${plant.fuel}\n**Status:** ${plant.status}`
          });
        });
      }
    } catch (error) {
      console.error('[POWER PLANTS] Error:', error);
    }
  };

  fetchPowerPlants();
}, [viewer, layers.powerPlants]);

useEffect(() => {
  if (!viewer) return;

  const clearDisasters = () => {
    viewer.entities.values.filter((e: any) => e.id?.startsWith('disaster_')).forEach((e: any) => viewer.entities.remove(e));
  };

  if (!layers.naturalDisasters) {
    clearDisasters();
    return;
  }

  const fetchDisasters = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/weather`);
      const data = await response.json();

      if (data.data?.alerts) {
        data.data.alerts.forEach((alert: any) => {
          const coords: Record<string, { lat: number; lon: number }> = {
            'South China Sea': { lat: 15.0, lon: 118.0 },
            'Caribbean': { lat: 18.0, lon: -70.0 },
            'Central Europe': { lat: 50.0, lon: 10.0 }
          };
          const c = coords[alert.region] || { lat: 20.0, lon: 0.0 };
          const severityColor = alert.severity === 'red' ? Cesium.Color.RED :
                                alert.severity === 'orange' ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;

          viewer.entities.add({
            id: `disaster_${alert.id}`,
            position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0),
            point: {
              pixelSize: 15,
              color: severityColor,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            },
            label: {
              text: `🌋 ${alert.region}`,
              font: '11px monospace',
              fillColor: severityColor,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, -18)
            },
            description: `**Alert:** ${alert.type}\n**Region:** ${alert.region}\n**Severity:** ${alert.severity}\n**Message:** ${alert.message}`
          });
        });
      }

      if (data.data?.storms) {
        data.data.storms.forEach((storm: any) => {
          const stormColor = storm.wind > 150 ? Cesium.Color.RED :
                            storm.wind > 120 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;

          viewer.entities.add({
            id: `disaster_storm_${storm.id}`,
            position: Cesium.Cartesian3.fromDegrees(storm.lon, storm.lat, 0),
            point: {
              pixelSize: 18,
              color: stormColor.withAlpha(0.8),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            },
            label: {
              text: `⛈️ ${storm.name.trim()}`,
              font: '10px monospace',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, -20)
            },
            description: `**Storm:** ${storm.name}\n**Wind:** ${storm.wind} km/h\n**Pressure:** ${storm.pressure} hPa\n**Movement:** ${storm.movement}`
          });
        });
      }
    } catch (error) {
      console.error('[NATURAL DISASTERS] Error:', error);
    }
  };

  fetchDisasters();
}, [viewer, layers.naturalDisasters]);

// Shader mode effects
  useEffect(() => {
    if (!viewer) return;

    const scene = viewer.scene;
    const imageryLayers = scene.imageryLayers;

    if (imageryLayers.length > 0) {
      switch (shaderMode) {
        case 'dark':
          imageryLayers.get(0).alpha = 0.85;
          scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0a0a');
          scene.backgroundColor = Cesium.Color.fromCssColorString('#000000');
          break;
        case 'light':
          imageryLayers.get(0).alpha = 0.4;
          scene.globe.baseColor = Cesium.Color.fromCssColorString('#e8e8e8');
          scene.backgroundColor = Cesium.Color.fromCssColorString('#f0f0f0');
          break;
        case 'nvg':
          imageryLayers.get(0).alpha = 0.6;
          scene.globe.baseColor = Cesium.Color.fromCssColorString('#003300');
          break;
        case 'flir':
          imageryLayers.get(0).alpha = 0.5;
          scene.globe.baseColor = Cesium.Color.fromCssColorString('#001a00');
          break;
case 'crt':
  imageryLayers.get(0).alpha = 0.75;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#001100');
  break;
case 'godmode':
  imageryLayers.get(0).alpha = 0.4;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#000800');
  break;
default:
          imageryLayers.get(0).alpha = 1.0;
          scene.globe.baseColor = Cesium.Color.WHITE;
          scene.backgroundColor = Cesium.Color.BLACK;
      }
    }
  }, [viewer, shaderMode]);

  const handleLayerToggle = (layer: keyof LayerVisibility) => {
    setLayers((prev: LayerVisibility) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const clearOrbitPath = useCallback(() => {
    if (viewer && orbitPathRef.current) {
      try {
        viewer.entities.remove(orbitPathRef.current);
      } catch {}
      orbitPathRef.current = null;
    }
  }, [viewer]);

  const calculateOrbitPath = useCallback((satellite: SatelliteData, minutes: number = 90, points: number = 200) => {
    const path: number[] = [];
    const satrec = twoline2satrec(satellite.line1, satellite.line2);
    const now = new Date();

    for (let i = 0; i <= points; i++) {
      const timeOffset = (i / points - 0.5) * minutes * 60 * 1000;
      const time = new Date(now.getTime() + timeOffset);

      try {
        const positionAndVelocity = propagate(satrec, time);
        if (positionAndVelocity.position && typeof positionAndVelocity.position === 'object') {
          const gmst = gstime(time);
          const positionGd = eciToGeodetic(positionAndVelocity.position, gmst);
          path.push(
            Cesium.Math.toDegrees(positionGd.longitude),
            Cesium.Math.toDegrees(positionGd.latitude),
            positionGd.height * 1000
          );
        }
      } catch {}
    }

    return path;
  }, []);

  const showOrbitPath = useCallback((satellite: SatelliteData) => {
    if (!viewer) return;

    clearOrbitPath();

    const path = calculateOrbitPath(satellite);
    if (path.length < 6) return;

    const entity = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(path),
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.LIME.withAlpha(0.8)
        })
      }
    });

    orbitPathRef.current = entity;

    const satrec = twoline2satrec(satellite.line1, satellite.line2);
    const now = new Date();
    const posAndVel = propagate(satrec, now);

    if (posAndVel.position && typeof posAndVel.position === 'object') {
      const gmst = gstime(now);
      const positionGd = eciToGeodetic(posAndVel.position, gmst);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(positionGd.longitude),
          Cesium.Math.toDegrees(positionGd.latitude),
          positionGd.height * 1000 + 500000
        ),
        duration: 1.5
      });
    }
  }, [viewer, clearOrbitPath, calculateOrbitPath]);

  const handleTrackSatellite = useCallback((satelliteName: string) => {
    const satellite = satellitesDataRef.current.find(s => s.name === satelliteName);
    if (!satellite) return;

    if (trackedSatellite === satelliteName) {
      setTrackedSatellite(null);
      clearOrbitPath();
    } else {
      setTrackedSatellite(satelliteName);
      showOrbitPath(satellite);
    }
  }, [trackedSatellite, showOrbitPath, clearOrbitPath]);

  handleTrackSatelliteRef.current = handleTrackSatellite;
  clearOrbitPathRef.current = clearOrbitPath;

  const flyTo = (lon: number, lat: number, height: number = 500000) => {
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2
    });
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setCurrentTimeIndex(idx);
    
    if (availableTimestamps[idx]) {
      const selectedTime = new Date(availableTimestamps[idx]);
      if (viewer && viewer.clock) {
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(selectedTime);
      }
      console.log('[TIMELINE] Scrubbing to:', selectedTime.toISOString());
    }
  };

return (
<div className="worldview-container">
<div className="main-tabs">
{(['globe', 'intel', 'finance', 'news', 'tech', 'hazards', 'cameras'] as TabType[]).map(tab => (
<button
key={tab}
className={`tab-button ${activeTab === tab ? 'active' : ''}`}
onClick={() => setActiveTab(tab)}
>
{tab === 'globe' ? '🌍 Globe' : tab === 'intel' ? '🗺️ Intel' : tab === 'finance' ? '📈 Finance' : tab === 'news' ? '📰 News' : tab === 'tech' ? '💻 Tech' : tab === 'hazards' ? '⚠️ Hazards' : '📹 Cameras'}
</button>
))}
</div>

<div ref={containerRef} className="cesium-viewer" />

{/* Network Status Indicator */}
<div className="network-status">
<div className={`ping-indicator ${latency === null ? 'loading' : latency < 100 ? 'good' : latency < 300 ? 'medium' : 'poor'}`}>
<span className="ping-dot"></span>
<span className="ping-text">
{latency === null ? 'Connecting...' : `${latency}ms`}
</span>
</div>
{lastUpdate && (
        <div className="last-update">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
      <div className="search-container">
        <input
          type="text"
          className="flight-search-input"
          placeholder="🔍 Search flight..."
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
        />
        {showSearchResults && searchResults.length > 0 && (
          <div className="search-results-dropdown">
            {searchResults.map(flight => (
              <div
                key={flight.hex}
                className="search-result-item"
                onClick={() => selectSearchResult(flight)}
              >
                <span className="result-callsign">{flight.callsign || flight.hex}</span>
                <span className="result-airline">{flight.airline}</span>
                <span className="result-route">
                  {flight.origin || '???'} → {flight.destination || '???'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        className={`route-toggle-btn ${showRoutes ? 'active' : ''}`}
        onClick={() => setShowRoutes(!showRoutes)}
        title={showRoutes ? 'Hide Flight Routes' : 'Show Flight Routes'}
      >
        {showRoutes ? '🛫' : '🚫'}
      </button>
      <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
        ⚙️
      </button>
    </div>

{/* Settings Panel */}
{showSettings && (
<div className="settings-panel">
<h4>Data Refresh Settings</h4>
<div className="setting-row">
<label>Refresh Interval:</label>
<select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
<option value={500}>0.5 seconds (Ultra Fast)</option>
<option value={1000}>1 second (Fastest)</option>
<option value={2000}>2 seconds</option>
<option value={5000}>5 seconds</option>
<option value={10000}>10 seconds</option>
<option value={30000}>30 seconds</option>
<option value={60000}>1 minute</option>
</select>
</div>
<button className="close-settings" onClick={() => setShowSettings(false)}>Close</button>
</div>
)}

{loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <span>Initializing Globe...</span>
        </div>
      )}

      {error && (
        <div className="error-overlay">
          <div className="error-message">
            <h3>Error Loading Globe</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      )}

{shaderMode === 'crt' && !loading && (
  <>
  <div className="crt-effect" />
  <div className="scanline" />
  </>
)}

{(shaderMode === 'nvg' || shaderMode === 'flir' || shaderMode === 'crt' || shaderMode === 'godmode') && !loading && (
  <>
  <div className="nvg-overlay" />
  <div className="flir-overlay" />
  <div className={shaderMode === 'godmode' ? 'military-reticle godmode-reticle' : 'military-reticle'}>
    <div className="reticle-ring" />
    <div className="reticle-ring-inner" />
    <div className="reticle-corners" />
  </div>
  <div className="radar-sweep" />
  <div className="military-coords">
    <div className="label">GRID REFERENCE</div>
    <div className="value">37°34'N 126°58'E</div>
    <div className="timestamp">
      <span className="label">ZULU </span>
      <span className="value">{new Date().toISOString().slice(0,19).replace('T',' ')}Z</span>
    </div>
  </div>
  <div className="system-status">
    {shaderMode === 'godmode' ? '👁️ PANOPTIC MODE' : 'System Online'}
  </div>
  <div className="data-freshness">
    <span className="live">● LIVE</span> {shaderMode === 'godmode' ? 'ALL FEEDS' : 'FEED'}
  </div>
  </>
)}

{(shaderMode === 'nvg' || shaderMode === 'flir' || shaderMode === 'godmode') && (
  <div className="crosshair" />
)}

{shaderMode === 'crt' && !loading && (
  <div className="crosshair" />
)}

  {/* Flight Info Panel */}
      {selectedFlight && (
        <div className="flight-info-panel">
          <div className="flight-info-header">
            <div className="flight-callsign">
              {selectedFlight.isMilitary && <span className="military-badge">MIL</span>}
              {selectedFlight.emergency && selectedFlight.emergency !== 'none' && <span className="emergency-badge">EMG</span>}
              {selectedFlight.callsign || 'UNKNOWN'}
            </div>
            <button className="close-btn" onClick={() => setSelectedFlight(null)}>×</button>
          </div>

          <div className="flight-info-content">
            {/* Flight Route Section */}
            <div className="flight-section">
              <div className="flight-section-title">FLIGHT ROUTE</div>
              <div className="flight-row">
                <span className="label">Airline</span>
                <span className="value">{selectedFlight.airline || 'Unknown'}</span>
              </div>
              <div className="flight-row">
                <span className="label">Flight Number</span>
                <span className="value">{selectedFlight.flightNumber || 'N/A'}</span>
              </div>
              {selectedFlight.operator && (
                <div className="flight-row">
                  <span className="label">Operator</span>
                  <span className="value">{selectedFlight.operator}</span>
                </div>
              )}
              <div className="flight-row route-row">
                <div className="route-airport">
                  <span className="label">Origin</span>
                  <span className="value airport-code">{selectedFlight.origin || '???'}</span>
                  <span className="value city">{selectedFlight.originCity || ''}</span>
                </div>
                <div className="route-arrow">→</div>
                <div className="route-airport">
                  <span className="label">Destination</span>
                  <span className="value airport-code">{selectedFlight.destination || '???'}</span>
                  <span className="value city">{selectedFlight.destinationCity || ''}</span>
                </div>
              </div>
              {selectedFlight.destinationName && (
                <div className="flight-row">
                  <span className="label">Airport Name</span>
                  <span className="value">{selectedFlight.destinationName}</span>
                </div>
              )}
            </div>

            {/* Aircraft Section */}
            <div className="flight-section">
              <div className="flight-section-title">AIRCRAFT</div>
              <div className="flight-row">
                <span className="label">Registration</span>
                <span className="value">{selectedFlight.registration || 'N/A'}</span>
              </div>
              <div className="flight-row">
                <span className="label">Type</span>
                <span className="value">{selectedFlight.aircraftType || 'Unknown'}</span>
              </div>
              <div className="flight-row">
                <span className="label">Description</span>
                <span className="value">{selectedFlight.aircraftDesc || 'N/A'}</span>
              </div>
              {selectedFlight.year && (
                <div className="flight-row">
                  <span className="label">Year</span>
                  <span className="value">{selectedFlight.year}</span>
                </div>
              )}
              {selectedFlight.category && (
                <div className="flight-row">
                  <span className="label">Category</span>
                  <span className="value">{selectedFlight.category}</span>
                </div>
              )}
              <div className="flight-row">
                <span className="label">Squawk</span>
                <span className="value">{selectedFlight.squawk || 'N/A'}</span>
              </div>
            </div>

            {/* Position Section */}
            <div className="flight-section">
              <div className="flight-section-title">POSITION</div>
              <div className="flight-row">
                <span className="label">Latitude</span>
                <span className="value">{selectedFlight.lat?.toFixed(4)}°</span>
              </div>
              <div className="flight-row">
                <span className="label">Longitude</span>
                <span className="value">{selectedFlight.lon?.toFixed(4)}°</span>
              </div>
              <div className="flight-row">
                <span className="label">Altitude</span>
                <span className="value">{selectedFlight.altFeet?.toLocaleString()} ft</span>
              </div>
              {selectedFlight.navAltitudeMcp && (
                <div className="flight-row">
                  <span className="label">MCP Altitude</span>
                  <span className="value">{Math.round(selectedFlight.navAltitudeMcp)} ft</span>
                </div>
              )}
              <div className="flight-row">
                <span className="label">Ground Speed</span>
                <span className="value">{selectedFlight.groundSpeedKnots} kts ({selectedFlight.groundSpeedKmh || Math.round(selectedFlight.groundSpeedKnots * 1.852)} km/h)</span>
              </div>
              <div className="flight-row">
                <span className="label">Heading</span>
                <span className="value">{selectedFlight.track}° {selectedFlight.headingDirection}</span>
              </div>
              {selectedFlight.navHeading && (
                <div className="flight-row">
                  <span className="label">Nav Heading</span>
                  <span className="value">{Math.round(selectedFlight.navHeading)}°</span>
                </div>
              )}
              <div className="flight-row">
                <span className="label">Vertical Speed</span>
                <span className="value">{selectedFlight.verticalSpeedFpm > 0 ? '+' : ''}{selectedFlight.verticalSpeedFpm || 0} ft/min</span>
              </div>
              <div className="flight-row">
                <span className="label">Status</span>
                <span className="value">{selectedFlight.onGround ? '🛫 On Ground' : '✈️ Airborne'}</span>
              </div>
              {selectedFlight.distance > 0 && (
                <div className="flight-row">
                  <span className="label">Distance</span>
                  <span className="value">{Math.round(selectedFlight.distance)} nm to dest</span>
                </div>
              )}
            </div>

            {/* Signal/NAV Section */}
            <div className="flight-section">
              <div className="flight-section-title">SIGNAL / NAV</div>
              <div className="flight-row">
                <span className="label">Position Accuracy</span>
                <span className="value">{selectedFlight.positionAccuracy}</span>
              </div>
              <div className="flight-row">
                <span className="label">NAC_P</span>
                <span className="value">{selectedFlight.nac_p || 0}</span>
              </div>
              <div className="flight-row">
                <span className="label">NIC</span>
                <span className="value">{selectedFlight.nic || 0}</span>
              </div>
              <div className="flight-row">
                <span className="label">Signal Strength</span>
                <span className="value">{selectedFlight.signalStrength}</span>
              </div>
              {selectedFlight.navQnh && (
                <div className="flight-row">
                  <span className="label">QNH</span>
                  <span className="value">{selectedFlight.navQnh} hPa</span>
                </div>
              )}
              <div className="flight-row">
                <span className="label">SIL</span>
                <span className="value">{selectedFlight.sil || 3} ({selectedFlight.silType || 'perhour'})</span>
              </div>
            </div>

            {/* Technical Section */}
            <div className="flight-section">
              <div className="flight-section-title">TECHNICAL</div>
              <div className="flight-row">
                <span className="label">Hex ID</span>
                <span className="value hex-id">{selectedFlight.hex}</span>
              </div>
              <div className="flight-row">
                <span className="label">Messages</span>
                <span className="value">{(selectedFlight.messages || 0).toLocaleString()}</span>
              </div>
              <div className="flight-row">
                <span className="label">Last Seen</span>
                <span className="value">{selectedFlight.seen?.toFixed(1) || 0}s ago</span>
              </div>
              {selectedFlight.airlineCode && (
                <div className="flight-row">
                  <span className="label">Airline Code</span>
                  <span className="value">{selectedFlight.airlineCode}</span>
                </div>
              )}
            </div>

            <div className="flight-actions">
              <button onClick={() => {
                if (viewer && selectedFlight) {
                  viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                      selectedFlight.lon,
                      selectedFlight.lat,
                      selectedFlight.altFeet * 0.3048 + 50000
                    ),
                    duration: 1.5
                  });
                }
              }}>
                📍 Track Flight
              </button>
            </div>
          </div>
        </div>
      )}

  {/* Timeline Scrubber */}
      {timelineMode && availableTimestamps.length > 0 && (
        <div className="timeline-panel">
          <div className="timeline-header">
            <span>4D REPLAY</span>
            <button onClick={() => setTimelineMode(false)}>×</button>
          </div>
          <div className="timeline-controls">
            <span className="timeline-time">
              {new Date(availableTimestamps[currentTimeIndex] || Date.now()).toLocaleTimeString()}
            </span>
            <input 
              type="range" 
              min="0" 
              max={availableTimestamps.length - 1} 
              value={currentTimeIndex}
              onChange={handleTimelineChange}
              className="timeline-slider"
            />
          </div>
        </div>
      )}

<div className="hud-panel">
<div className="hud-title">WORLDVIEW</div>
<div className="hud-subtitle">OSINT Intelligence Platform</div>

<div className="hud-section">
<div className="hud-section-title">ACTIVE: {activeTab.toUpperCase()}</div>
</div>

{activeTab === 'globe' && (
<div className="hud-section">
<div className="hud-section-title">AVIATION</div>
{(['flights', 'satellites', 'gpsJamming', 'maritime', 'noflyzones'] as Array<keyof LayerVisibility>).filter(k => layers.hasOwnProperty(k)).map((key) => (
<div key={key} className={`layer-toggle ${layers[key] ? 'active' : ''}`} onClick={() => handleLayerToggle(key)}>
<input type="checkbox" checked={layers[key]} readOnly />
<label>{key === 'flights' ? '✈️ Flights' : key === 'satellites' ? '🛰️ Satellites' : key === 'gpsJamming' ? '📡 GPS Jam' : key === 'maritime' ? '🚢 Maritime' : '🚫 No-Fly'}</label>
</div>
))}
</div>
)}

{activeTab === 'intel' && (
<div className="hud-section">
<div className="hud-section-title">INTELLIGENCE</div>
{(['intelligence', 'news'] as Array<keyof LayerVisibility>).filter(k => layers.hasOwnProperty(k)).map((key) => (
<div key={key} className={`layer-toggle ${layers[key] ? 'active' : ''}`} onClick={() => handleLayerToggle(key)}>
<input type="checkbox" checked={layers[key]} readOnly />
<label>{key === 'intelligence' ? '🗺️ Country Risk' : '📰 News'}</label>
</div>
))}
</div>
)}

{activeTab === 'finance' && (
<div className="hud-section">
<div className="hud-section-title">MARKETS</div>
{(['finance'] as Array<keyof LayerVisibility>).filter(k => layers.hasOwnProperty(k)).map((key) => (
<div key={key} className={`layer-toggle ${layers[key] ? 'active' : ''}`} onClick={() => handleLayerToggle(key)}>
<input type="checkbox" checked={layers[key]} readOnly />
<label>📈 Stocks & Crypto</label>
</div>
))}
</div>
)}

{activeTab === 'tech' && (
<div className="hud-section">
  <div className="hud-section-title">TECH INFRASTRUCTURE</div>
  {(['cables', 'outages', 'datacenters', 'cloudRegions', 'techHQs', 'startupHubs', 'powerPlants'] as Array<keyof LayerVisibility>).filter(k => layers.hasOwnProperty(k)).map((key) => (
  <div key={key} className={`layer-toggle ${layers[key] ? 'active' : ''}`} onClick={() => handleLayerToggle(key)}>
    <input type="checkbox" checked={layers[key]} readOnly />
    <label>{key === 'cables' ? '🔌 Cables' : key === 'outages' ? '⚠️ Outages' : key === 'datacenters' ? '💾 Datacenters' : key === 'cloudRegions' ? '☁️ Cloud Regions' : key === 'techHQs' ? '🏢 Tech HQs' : key === 'startupHubs' ? '🚀 Startups' : '⚡ Power Plants'}</label>
  </div>
  ))}
</div>
)}

{activeTab === 'hazards' && (
<div className="hud-section">
<div className="hud-section-title">HAZARDS</div>
{(['weather', 'naturalDisasters', 'hackerEvents'] as Array<keyof LayerVisibility>).filter(k => layers.hasOwnProperty(k)).map((key) => (
<div key={key} className={`layer-toggle ${layers[key] ? 'active' : ''}`} onClick={() => handleLayerToggle(key)}>
<input type="checkbox" checked={layers[key]} readOnly />
<label>{key === 'weather' ? '⛈️ Weather' : key === 'naturalDisasters' ? '🌋 Disasters' : '💀 Hacker Events'}</label>
</div>
))}
</div>
)}

<div className="hud-section">
<div className="hud-section-title">DISPLAY MODE</div>
{(['normal', 'dark', 'light', 'nvg', 'flir', 'crt', 'godmode'] as ShaderMode[]).map((mode) => (
<div
  key={mode}
  className={`layer-toggle ${shaderMode === mode ? 'active' : ''}`}
  onClick={() => setShaderMode(mode)}
>
  <input type="radio" checked={shaderMode === mode} readOnly />
  <label>{mode === 'dark' ? '🌙 DARK' : mode === 'light' ? '☀️ LIGHT' : mode === 'godmode' ? '👁️ PANOPTIC' : mode.toUpperCase()}</label>
</div>
))}
</div>

<div className="hud-section">
<div className="hud-section-title">QUICK LOCATIONS</div>
<div className="location-buttons">
<button onClick={() => { if (viewer) { viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(45, 30, 20000000), duration: 2 }); setSelectedFlight(null); } }}>🌍 RESET</button>
<button onClick={() => flyTo(-74.006, 40.7128, 500000)}>NYC</button>
<button onClick={() => flyTo(-0.1276, 51.5074, 500000)}>LONDON</button>
<button onClick={() => flyTo(51.3889, 35.6892, 500000)}>TEHRAN</button>
<button onClick={() => flyTo(139.6917, 35.6895, 500000)}>TOKYO</button>
<button onClick={() => flyTo(56.3, 26.1, 800000)}>HORMUZ</button>
<button onClick={() => flyTo(32.5, 53.0, 2000000)}>IRAN</button>
</div>
</div>

        <div className="hud-section">
          <div className="hud-section-title">4D REPLAY</div>
          <button 
            className={`timeline-btn ${timelineMode ? 'active' : ''}`}
            onClick={() => setTimelineMode(!timelineMode)}
          >
            {timelineMode ? '◼ STOP' : '▶ TIMELINE'}
          </button>
        </div>
      </div>

      <div className="stats-overlay">
        <div className="stat">
          <span className="stat-label">FLIGHTS</span>
          <span className="stat-value">{flightCount.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">SATELLITES</span>
          <span className="stat-value">{satelliteCount.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">SHIPS</span>
          <span className="stat-value">{maritimeCount}</span>
        </div>
{noFlyZoneCount > 0 && (
<div className="stat nofly">
<span className="stat-label">NO-FLY ZONES</span>
<span className="stat-value">{noFlyZoneCount}</span>
</div>
)}
{newsCount > 0 && (
<div className="stat news">
<span className="stat-label">NEWS EVENTS</span>
<span className="stat-value">{newsCount}</span>
</div>
)}
{gpsJammingCount > 0 && (
          <div className="stat gps-jam">
            <span className="stat-label">GPS INTERFERENCE</span>
            <span className="stat-value">{gpsJammingCount}</span>
          </div>
        )}
{trackedSatellite && (
<div className="stat tracking">
<span className="stat-label">TRACKING SAT</span>
<span className="stat-value" title={trackedSatellite}>
{trackedSatellite.length > 12 ? trackedSatellite.substring(0, 9) + '...' : trackedSatellite}
</span>
</div>
)}
</div>

{layers.news && newsCount > 0 && (
<div className="news-panel">
<div className="news-panel-header">
<span>📰 NEWS HEADLINES</span>
<span className="news-count">{newsCount} articles</span>
</div>
<div className="news-panel-body">
<div className="news-articles-container">
<p className="news-loading">Loading news...</p>
</div>
</div>
</div>
)}

{countrySummary && (
<div className="country-panel">
<div className="country-panel-header">
<h2>{countrySummary.name}</h2>
<button onClick={() => setCountrySummary(null)}>✕</button>
</div>
<div className="country-panel-content">
<div className="country-stats">
<div className="stat-item"><span>Capital:</span> {countrySummary.capital}</div>
<div className="stat-item"><span>Population:</span> {countrySummary.population}</div>
<div className="stat-item"><span>GDP:</span> {countrySummary.gdp}</div>
<div className="stat-item"><span>Risk Score:</span> {countrySummary.riskScore}/100</div>
</div>
<div className="country-summary">
<h3>AI Summary</h3>
<p>{countrySummary.summary}</p>
</div>
<div className="country-news">
<h3>Recent News</h3>
<ul>
{countrySummary.news?.map((n: string, i: number) => <li key={i}>{n}</li>)}
</ul>
</div>
<div className="country-cameras">
<h3>Live Cameras</h3>
{countrySummary.youtubeCameras?.map((url: string, i: number) => (
<iframe key={i} src={url} width="100%" height="200" allowFullScreen />
))}
</div>
</div>
</div>
)}
</div>
);
};

export default WorldView;