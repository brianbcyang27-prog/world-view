import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Cesium from 'cesium';
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite';

type ShaderMode = 'normal' | 'nvg' | 'flir' | 'crt' | 'anime';
type LayerVisibility = {
flights: boolean;
satellites: boolean;
gpsJamming: boolean;
maritime: boolean;
noflyzones: boolean;
news: boolean;
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

interface NewsEvent {
lat: number;
lon: number;
name: string;
url: string;
tone: number;
count: number;
}

const API_BASE = 'http://localhost:3001';

const WorldView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  
  const flightEntitiesRef = useRef<Cesium.Entity[]>([]);
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
news: false
});

  const [shaderMode, setShaderMode] = useState<ShaderMode>('normal');
  const [flightCount, setFlightCount] = useState(0);
  const [satelliteCount, setSatelliteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);
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

          // Check if it's a flight
          if (entityId.startsWith('flight_')) {
            const hex = entityId.replace('flight_', '');
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

    const clearFlights = () => {
      flightEntitiesRef.current.forEach(entity => {
        try { viewer.entities.remove(entity); } catch {}
      });
      flightEntitiesRef.current = [];
    };

    if (!layers.flights) {
      clearFlights();
      setFlightCount(0);
      return;
    }

const fetchFlights = async () => {
    setFlightsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/flights`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      clearFlights();

      if (data.states && data.states.length > 0) {
        const validFlights = data.states.filter((state: unknown[]) =>
          state[5] !== null && state[6] !== null &&
          !isNaN(state[5] as number) && !isNaN(state[6] as number)
        );

        const entities: Cesium.Entity[] = [];
        const newHistory = new Map(flightHistory);

        validFlights.forEach((state: unknown[]) => {
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

        // Get detailed info from the full data
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

        // Update flight history for trail
        const history = newHistory.get(hex) || [];
        history.push({ lat, lon, time: Date.now() });
        // Keep last 25 positions for smoother trails
        if (history.length > 25) history.shift();
        newHistory.set(hex, history);

        // Create flight entity with all data
        const entity = viewer.entities.add({
          id: `flight_${hex}`,
          name: flightCallsign || hex,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          // Main aircraft point - larger for military
          point: {
            pixelSize: isMilitary ? 10 : 7,
            color: isMilitary ? Cesium.Color.ORANGE : (details.emergency !== 'none' ? Cesium.Color.RED : Cesium.Color.CYAN),
            outlineColor: isMilitary ? Cesium.Color.DARKORANGE : Cesium.Color.BLACK,
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1.5e2, 3, 1.5e7, 0.5),
          },
          // Store all data for the info panel
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
            // Vertical speed
            verticalSpeed: details.verticalSpeed || `${details.baro_rate > 0 ? '+' : ''}${Math.round((details.baro_rate || 0) * 196.85)} ft/min`,
            verticalSpeedFpm: details.verticalSpeedFpm || Math.round((details.baro_rate || 0) * 196.85),
            // Signal quality
            nac_p: details.nac_p || 0,
            nic: details.nic || 0,
            positionAccuracy: details.positionAccuracy || getPositionAccuracy(details.nac_p, details.nic),
            signalStrength: details.rssi ? `${details.rssi.toFixed(1)} dBm` : 'Unknown',
            rssi: details.rssi || null,
            // Airline info
            airline,
            flightNumber,
            airlineCode,
            // Route info
            origin,
            originCity,
            originCountry,
            originName,
            destination,
            destinationCity,
            destinationCountry,
            destinationName,
            // Additional details
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
        entities.push(entity);

            // Add heading indicator (small triangle pointing direction)
            if (!onGround && groundSpeed > 50) {
              const headingEntity = viewer.entities.add({
                id: `heading_${hex}`,
                position: Cesium.Cartesian3.fromDegrees(lon, lat, alt + 500),
                point: {
                  pixelSize: 3,
                  color: isMilitary ? Cesium.Color.ORANGE.withAlpha(0.7) : Cesium.Color.CYAN.withAlpha(0.7),
                },
              });
              entities.push(headingEntity);
}

        // Add route trail from history
        const historyPoints = newHistory.get(hex);
        if (historyPoints && historyPoints.length > 2) {
          const trailPositions: number[] = [];
          historyPoints.forEach(p => {
            trailPositions.push(p.lon, p.lat, alt);
          });

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
          entities.push(trailEntity);
        }

        // Add predicted route line to destination
        if (destination && !onGround) {
          const destCoords = getAirportCoords(destination);
          if (destCoords) {
            const routePositions = [
              lon, lat, alt,
              destCoords.lon, destCoords.lat, 0
            ];
            const routeEntity = viewer.entities.add({
              id: `route_${hex}`,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights(routePositions),
                width: 2,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.3,
                  color: isMilitary ? Cesium.Color.ORANGE.withAlpha(0.7) : Cesium.Color.LIME.withAlpha(0.7),
                })
              }
            });
            entities.push(routeEntity);

            // Add destination marker
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
            entities.push(destMarker);
          }
        }
      } catch (err) {
            // Skip invalid flights
          }
        });

        flightEntitiesRef.current = entities;
        setFlightHistory(newHistory);
        setFlightCount(validFlights.length);
      }
    } catch (error) {
      console.error('[FLIGHTS] Error:', error);
    } finally {
      setFlightsLoading(false);
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
    const interval = setInterval(fetchFlights, 30000);

    return () => {
      clearInterval(interval);
      clearFlights();
    };
  }, [viewer, layers.flights]);

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
const response = await fetch(`${API_BASE}/api/news/geo?q=conflict protest military disaster&timespan=7d`);
const data = await response.json();

clearNews();

if (data.events && data.events.length > 0) {
const entities: Cesium.Entity[] = [];

data.events.forEach((event: NewsEvent) => {
if (!event.lat || !event.lon) return;

const toneColor = event.tone < -5 ? Cesium.Color.RED :
event.tone < 0 ? Cesium.Color.ORANGE :
event.tone < 5 ? Cesium.Color.YELLOW :
Cesium.Color.GREEN;

const entity = viewer.entities.add({
position: Cesium.Cartesian3.fromDegrees(event.lon, event.lat, 0),
point: {
pixelSize: Math.min(12, 6 + event.count),
color: toneColor.withAlpha(0.8),
outlineColor: Cesium.Color.WHITE,
outlineWidth: 1,
heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
},
description: `**News Event**\n\n${event.name || 'Unknown'}\n\nTone: ${event.tone?.toFixed(1) || 0}\nMentions: ${event.count || 1}\n\n[View Article](${event.url || '#'})`
});
entities.push(entity);
});

newsEntitiesRef.current = entities;
setNewsCount(data.events.length);
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

  // Shader mode effects
  useEffect(() => {
    if (!viewer) return;

    const scene = viewer.scene;
    const imageryLayers = scene.imageryLayers;

    if (imageryLayers.length > 0) {
      switch (shaderMode) {
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
        default:
          imageryLayers.get(0).alpha = 1.0;
          scene.globe.baseColor = Cesium.Color.WHITE;
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
      <div ref={containerRef} className="cesium-viewer" />

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

<div className="crosshair" />

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
          <div className="hud-section-title">INTELLIGENCE LAYERS</div>
          {(Object.keys(layers) as Array<keyof LayerVisibility>).map((key) => (
            <div
              key={key}
              className={`layer-toggle ${layers[key] ? 'active' : ''}`}
              onClick={() => handleLayerToggle(key)}
            >
              <input type="checkbox" checked={layers[key]} readOnly />
              <label>
                {key.toUpperCase().replace('GPSJAMMING', 'GPS JAM').replace('NOFLYZONES', 'NO-FLY ZONES').replace('NEWS', '📰 NEWS')}
                {(key === 'flights' && flightsLoading) && ' ⏳'}
                {(key === 'satellites' && satellitesLoading) && ' ⏳'}
              </label>
            </div>
          ))}
        </div>

        <div className="hud-section">
          <div className="hud-section-title">DISPLAY MODE</div>
          {(['normal', 'nvg', 'flir', 'crt'] as ShaderMode[]).map((mode) => (
            <div
              key={mode}
              className={`layer-toggle ${shaderMode === mode ? 'active' : ''}`}
              onClick={() => setShaderMode(mode)}
            >
              <input type="radio" checked={shaderMode === mode} readOnly />
              <label>{mode.toUpperCase()}</label>
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
<span>📰 NEWS EVENTS</span>
<span className="news-count">{newsCount} events</span>
</div>
<div className="news-panel-body">
<p className="news-info">
Showing geolocated news events from the last 7 days.
Events colored by sentiment: <span style={{color: '#ef4444'}}>negative</span>, <span style={{color: '#f97316'}}>concerning</span>, <span style={{color: '#eab308'}}>neutral</span>, <span style={{color: '#22c55e'}}>positive</span>
</p>
<p className="news-hint">Click on markers to view event details. Toggle NEWS layer to enable/disable.</p>
</div>
</div>
)}
</div>
);
};

export default WorldView;