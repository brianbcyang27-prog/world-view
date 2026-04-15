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
  const satelliteEntitiesRef = useRef<Cesium.Entity[]>([]);
  const gpsJammingEntitiesRef = useRef<Cesium.Entity[]>([]);
  const maritimeEntitiesRef = useRef<Cesium.Entity[]>([]);
  const noFlyZoneEntitiesRef = useRef<Cesium.Entity[]>([]);
  const orbitPathRef = useRef<Cesium.Entity | null>(null);
  const satellitesDataRef = useRef<SatelliteData[]>([]);

  const [layers, setLayers] = useState<LayerVisibility>({
    flights: true,
    satellites: true,
    gpsJamming: false,
    maritime: false,
    noflyzones: false
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
              const details = props.details ? JSON.parse(props.details as string) : {};
              setSelectedFlight({
                id: entityId,
                hex,
                callsign: props.callsign || 'Unknown',
                registration: props.registration || 'N/A',
                aircraftType: props.aircraftType || 'N/A',
                aircraftDesc: props.aircraftDesc || 'N/A',
                lat: props.lat || 0,
                lon: props.lon || 0,
                altFeet: props.altFeet || 0,
                groundSpeedKnots: props.groundSpeedKnots || 0,
                track: props.track || 0,
                headingDirection: props.headingDirection || 'N',
                onGround: props.onGround || false,
                squawk: props.squawk || 'N/A',
                isMilitary: props.isMilitary || false,
                verticalSpeed: props.verticalSpeed || '0 ft/min',
                positionAccuracy: props.positionAccuracy || 'Unknown',
                signalStrength: props.signalStrength || 'Unknown',
                airline: details.airline || props.airline || 'Unknown',
                flightNumber: details.flightNumber || props.flightNumber || 'N/A',
                origin: details.origin || props.origin || '',
                originCity: details.originCity || props.originCity || '',
                destination: details.destination || props.destination || '',
                destinationCity: details.destinationCity || props.destinationCity || '',
              });
            }
        
        // Fly to the flight
        const props2 = selectedEntity.properties;
        if (props2 && viewer) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              props2.lon as number,
              props2.lat as number,
              (props2.altFeets as number || 10000) * 0.3048 + 100000
            ),
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
            
            const isMilitary = aircraftType.includes('C-') || 
                               aircraftType.includes('KC-') ||
                               aircraftType.includes('F-') || aircraftType.includes('H60') ||
                               flightCallsign.includes('RCH') || flightCallsign.includes('CMV') ||
                               flightCallsign.includes('TALON') || flightCallsign.includes('UGLY') ||
                               flightCallsign.includes('BANZAI') || flightCallsign.includes('EAGLE');

        // Get detailed info from the full data
        const details = data.aircraftDetails?.[hex] || {};
        const airline = details.airline || '';
        const flightNumber = details.flightNumber || '';
        const origin = details.origin || '';
        const originCity = details.originCity || '';
        const destination = details.destination || '';
        const destinationCity = details.destinationCity || '';

        // Update flight history for trail
        const history = newHistory.get(hex) || [];
        history.push({ lat, lon, time: Date.now() });
        // Keep last 20 positions
        if (history.length > 20) history.shift();
        newHistory.set(hex, history);

        // Create flight entity with all data
        const entity = viewer.entities.add({
          id: `flight_${hex}`,
          name: flightCallsign || hex,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          // Main aircraft point
          point: {
            pixelSize: isMilitary ? 8 : 6,
            color: isMilitary ? Cesium.Color.ORANGE : Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1.5e2, 3, 1.5e7, 0.5),
          },
          // Store all data for the info panel
          properties: {
            hex,
            callsign: flightCallsign,
            registration,
            aircraftType,
            aircraftDesc,
            lat,
            lon,
            altFeet: Math.round(alt / 0.3048),
            groundSpeedKnots: Math.round(groundSpeed),
            track: Math.round(track),
            headingDirection: getCardinalDirection(track),
            onGround,
            squawk,
            isMilitary,
            // Additional details
            verticalSpeed: details.baro_rate ? `${details.baro_rate > 0 ? '+' : ''}${Math.round(details.baro_rate * 196.85)} ft/min` : '0 ft/min',
            nacP: details.nac_p || 0,
            positionAccuracy: getPositionAccuracy(details.nac_p, details.nic),
            signalStrength: details.rssi ? `${details.rssi.toFixed(1)} dBm` : 'Unknown',
            airline,
            flightNumber,
            origin,
            originCity,
            destination,
            destinationCity,
            details: JSON.stringify(details),
          },
          description: buildFlightDescription(hex, flightCallsign, registration, aircraftType, aircraftDesc, lat, lon, alt, groundSpeed, track, onGround, isMilitary, airline, flightNumber, origin, originCity, destination, destinationCity)
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

  const buildFlightDescription = (hex: string, callsign: string, registration: string, type: string, desc: string, lat: number, lon: number, alt: number, speed: number, track: number, onGround: boolean, isMilitary: boolean, airline?: string, flightNumber?: string, origin?: string, originCity?: string, destination?: string, destinationCity?: string): string => {
    return `**${callsign || 'Unknown'}** (${hex})

**Flight Info**
Airline: ${airline || 'Unknown'}
Flight Number: ${flightNumber || 'N/A'}
${origin ? `Origin: ${originCity || origin} (${origin})` : ''}
${destination ? `Destination: ${destinationCity || destination} (${destination})` : ''}

**Aircraft**
Type: ${type || 'Unknown'}
Registration: ${registration || 'N/A'}
Description: ${desc || 'N/A'}

**Position**
Latitude: ${lat.toFixed(4)}°
Longitude: ${lon.toFixed(4)}°
Altitude: ${Math.round(alt / 0.3048)} ft
Ground Speed: ${Math.round(speed)} knots
Heading: ${Math.round(track)}° ${getCardinalDirection(track)}
Status: ${onGround ? 'On Ground' : 'Airborne'}

${isMilitary ? '\n**MILITARY AIRCRAFT**' : ''}

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
              {selectedFlight.callsign || 'UNKNOWN'}
            </div>
            <button className="close-btn" onClick={() => setSelectedFlight(null)}>×</button>
          </div>

          <div className="flight-info-content">
            <div className="flight-section">
              <div className="flight-section-title">FLIGHT INFO</div>
              <div className="flight-row">
                <span className="label">Airline</span>
                <span className="value">{selectedFlight.airline || 'Unknown'}</span>
              </div>
              <div className="flight-row">
                <span className="label">Flight Number</span>
                <span className="value">{selectedFlight.flightNumber || 'N/A'}</span>
              </div>
              {selectedFlight.origin && (
                <div className="flight-row">
                  <span className="label">Origin</span>
                  <span className="value">{selectedFlight.originCity || selectedFlight.origin} ({selectedFlight.origin})</span>
                </div>
              )}
              {selectedFlight.destination && (
                <div className="flight-row">
                  <span className="label">Destination</span>
                  <span className="value">{selectedFlight.destinationCity || selectedFlight.destination} ({selectedFlight.destination})</span>
                </div>
              )}
              <div className="flight-row">
                <span className="label">Registration</span>
                <span className="value">{selectedFlight.registration}</span>
              </div>
              <div className="flight-row">
                <span className="label">Aircraft Type</span>
                <span className="value">{selectedFlight.aircraftType}</span>
              </div>
              <div className="flight-row">
                <span className="label">Description</span>
                <span className="value">{selectedFlight.aircraftDesc}</span>
              </div>
              <div className="flight-row">
                <span className="label">Squawk</span>
                <span className="value">{selectedFlight.squawk}</span>
              </div>
            </div>

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
              <div className="flight-row">
                <span className="label">Ground Speed</span>
                <span className="value">{selectedFlight.groundSpeedKnots} knots ({Math.round(selectedFlight.groundSpeedKnots * 1.852)} km/h)</span>
              </div>
              <div className="flight-row">
                <span className="label">Heading</span>
                <span className="value">{selectedFlight.track}° {selectedFlight.headingDirection}</span>
              </div>
              <div className="flight-row">
                <span className="label">Vertical Speed</span>
                <span className="value">{selectedFlight.verticalSpeed}</span>
              </div>
              <div className="flight-row">
                <span className="label">Status</span>
                <span className="value">{selectedFlight.onGround ? 'On Ground' : 'Airborne'}</span>
              </div>
            </div>

            <div className="flight-section">
              <div className="flight-section-title">SIGNAL QUALITY</div>
              <div className="flight-row">
                <span className="label">Position Accuracy</span>
                <span className="value">{selectedFlight.positionAccuracy}</span>
              </div>
              <div className="flight-row">
                <span className="label">Signal Strength</span>
                <span className="value">{selectedFlight.signalStrength}</span>
              </div>
              <div className="flight-row">
                <span className="label">Hex ID</span>
                <span className="value hex-id">{selectedFlight.hex}</span>
              </div>
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
                Track Flight
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
                {key.toUpperCase().replace('GPSJAMMING', 'GPS JAM').replace('NOFLYZONES', 'NO-FLY ZONES')}
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
    </div>
  );
};

export default WorldView;