import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;
app.use(cors());

let flightCache: { data: object; timestamp: number } | null = null;
let satelliteCache: { data: string; timestamp: number } | null = null;
const routeCache: Map<string, { origin: string; destination: string; airline: string; flightNumber: string }> = new Map();
const CACHE_DURATION = 45000;

const AIRLINE_CODES: Record<string, string> = {
  'AAL': 'American Airlines', 'AAR': 'AAR Airlines', 'ABR': 'Abras Air',
  'ACA': 'Air Canada', 'AFR': 'Air France', 'AIC': 'Air India',
  'ANA': 'All Nippon Airways', 'APJ': 'Air Premia', 'BAW': 'British Airways',
  'CAL': 'Air China', 'CFS': 'California Pacific', 'CPA': 'Cathay Pacific',
  'CSN': 'China Southern', 'DAL': 'Delta Air Lines', 'DLH': 'Lufthansa',
  'EJA': 'NetJets', 'ELY': 'El Al', 'ETD': 'Etihad', 'ETH': 'Ethiopian Airlines',
  'EVA': 'EVA Air', 'EXS': 'Jet2', 'FDX': 'FedEx', 'FFT': 'Frontier',
  'FIN': 'Finnair', 'GEC': 'Lufthansa Cargo', 'GFA': 'Gulf Air', 'GWI': 'Germanwings',
  'HAL': 'Hawaiian Airlines', 'IBE': 'Iberia', 'JAI': 'SpiceJet', 'JAL': 'Japan Airlines',
  'JBU': 'JetBlue', 'JIA': 'Jaguar Airlines', 'KAL': 'Korean Air', 'KLM': 'KLM',
  'LAN': 'LATAM', 'LOT': 'LOT Polish', 'MAS': 'Malaysia Airlines', 'MGL': 'Mongolian Airlines',
  'NKS': 'Spirit Airlines', 'NWA': 'Northwest', 'OAW': 'Austrian', 'PAL': 'Philippine Airlines',
  'QFA': 'Qantas', 'QTR': 'Qatar Airways', 'RPA': 'Republic Airways', 'RVR': 'Rover Aviation',
  'SAS': 'Scandinavian Airlines', 'SWA': 'Southwest Airlines', 'SIA': 'Singapore Airlines',
  'SKW': 'SkyWest', 'THA': 'Thai Airways', 'TRA': 'Transavia', 'TSC': 'Air Transat',
  'TAM': 'LATAM Brazil', 'TUI': 'TUI Airways', 'TUR': 'Turkish Airlines', 'TWU': 'T\'way Air',
  'UAE': 'Emirates', 'UAL': 'United Airlines', 'UPS': 'UPS Airlines', 'VIR': 'Virgin Atlantic',
  'VNL': 'Vanilla Air', 'VOI': 'Volaris', 'WJA': 'WestJet', 'WZZ': 'Wizz Air',
  'XTK': 'Tigerair', 'YZR': 'Yangtze River Express', 'ZTH': 'Jetstar',
  'RCH': 'US Air Force', 'CNV': 'Convair', 'JST': 'Jetstar', 'ABX': 'ABX Air',
  'ATN': 'Atlantic Airlines', 'ASQ': 'ExpressJet', 'BOE': 'Boeing', 'BWC': 'Blue Wing',
  'CAT': 'Cathay Dragon', 'CKK': 'China Cargo', 'CQH': 'Spring Airlines', 'CSZ': 'Shenzhen Airlines',
  'DKH': 'Juneyao Airlines', 'DKK': 'Donghai Airlines', 'DKY': 'Colorful Guizhou',
  'DLH': 'Deutsche Lufthansa', 'DSO': 'DAS Air', 'DXH': 'Deer Jet', 'EFT': 'Eigenair',
  'ESR': 'East Air', 'EST': 'Enkor', 'FDB': 'Firefly', 'FFZ': 'Fly for Fun',
  'GIA': 'Garuda Indonesia', 'GJC': 'Global Jet', 'GJS': 'GoJet', 'HLE': 'Hellas',
  'HMY': 'Harmony', 'IBE': 'Iberia', 'IGO': 'IndiGo', 'IGO': 'Indigo',
  'IGO': 'IndiGo', 'INC': 'Air Incheon', 'JAE': 'Jazeera', 'JAT': 'Air Serbia',
  'JAZ': 'Jazz', 'JBU': 'JetBlue', 'JIA': 'Jade Cargo', 'JJA': 'Jin Air',
  'JJP': 'Jetstar Japan', 'JST': 'Jetstar', 'JTR': 'Jet2', 'KAC': 'Kuwait Airways',
  'KAF': 'Korean Air', 'KKA': 'Kam Air', 'KMR': 'KLM Royal Dutch', 'KNE': 'Kanem',
  'KZR': 'KazAir', 'LGI': 'Lion Air', 'LKE': 'Lucky Air', 'LPE': 'LAN Peru',
  'LRC': 'LARCA', 'LVI': 'Livingston', 'LYB': 'Lynden', 'MBD': 'Mandarin',
  'MDT': 'Mandarin', 'MEH': 'Middle East', 'MGK': 'Mahan Air', 'MGL': 'MIAT',
  'MJN': 'Mihin Lanka', 'MPJ': 'M&P', 'MRU': 'Air Mauritius', 'MSR': 'EgyptAir',
  'MZI': 'Manx2', 'NAX': 'Norwegian', 'NLY': 'NLy', 'NRS': 'Nordica',
  'NVR': 'Novair', 'NVR': 'Noveris', 'OAL': 'Oman Air', 'OGH': 'Originair',
  'OKA': 'OKA', 'OLM': 'Olympic', 'OMA': 'Oman Air', 'ONE': 'One Air',
  'OOM': 'OOM', 'OVA': 'Orenair', 'PAC': 'PAC', 'PDV': 'Podebrady',
  'PEV': 'Pioneer', 'PGT': 'Pegasus', 'PLM': 'Polar', 'PNK': 'Peach',
  'PVD': 'Proflight', 'QDA': 'Qantas', 'QEZ': 'EasyJet', 'QFA': 'Qantas',
  'QTR': 'Qatar', 'RAM': 'Royal Air Maroc', 'RBA': 'Royal Brunei',
  'RJA': 'Royal Jordanian', 'RPA': 'Republic', 'RRR': 'RusAir',
  'RSA': 'Rossiya', 'RYR': 'Ryanair', 'SAA': 'South African',
  'SBI': 'S7 Airlines', 'SDM': 'Silver', 'SEJ': 'SpiceJet', 'SFJ': 'SuperJet',
  'SHT': 'Shuttle', 'SIA': 'Singapore', 'SJX': 'Sun Air', 'SKQ': 'SriLankan',
  'SLK': 'SilkAir', 'SNJ': 'Sunrise', 'SPQ': 'Sound Express', 'SRF': 'Surf Air',
  'STK': 'Strike', 'SVR': 'Siberia', 'SWR': 'Swiss', 'SXS': 'Sun Express',
  'SZS': 'Sundance', 'TAF': 'TAF', 'TAP': 'TAP Portugal', 'TBN': 'TBN',
  'TDK': 'Tradewinds', 'TJS': 'Tajik Air', 'TLM': 'Tulum', 'TMA': 'TMA',
  'TNF': 'Trans States', 'TRA': 'Transavia', 'TRY': 'Troy Air', 'TSC': 'Transat',
  'TSK': 'Tassili', 'TSR': 'Trans Service', 'TTI': 'TNT', 'TUA': 'TUI',
  'TUS': 'Tus', 'TVF': 'Travel', 'TVS': 'Tavrey', 'TWY': 'Two', 'TYR': 'Tyrolean',
  'UAE': 'Emirates', 'UAL': 'United', 'UCA': 'UTAir', 'UZB': 'Uzbekistan',
  'VIR': 'Virgin', 'VKG': 'Viking', 'VNL': 'Vanilla', 'VOI': 'Volaris',
  'VTI': 'Victory', 'VVS': 'Vologda', 'WAF': 'Waffles', 'WAZ': 'Wamos',
  'WIF': 'Wideroe', 'WJA': 'WestJet', 'WKT': 'Wikitour', 'WLC': 'World',
  'WZZ': 'Wizz', 'XAX': 'XAX', 'XSR': 'Express', 'YAK': 'Yakutia',
  'YKS': 'Yakutsk', 'YNT': 'Yantai', 'YZR': 'Yangtze', 'ZAH': 'Zagros',
  'ZEE': 'Zee', 'ZLJ': 'Zhongli', 'ZWE': 'ZanAir', 'ZYR': 'ZYR'
};

function parseCallsign(callsign: string): { airline: string; flightNumber: string; airlineName: string } {
  const trimmed = callsign.trim();
  if (!trimmed || trimmed === 'UNKNOWN') {
    return { airline: '', flightNumber: '', airlineName: 'Unknown' };
  }
  const match = trimmed.match(/^([A-Z]{2,3})(\d+[A-Z]*)$/);
  if (match) {
    const airline = match[1];
    const flightNumber = match[2];
    const airlineName = AIRLINE_CODES[airline] || airline;
    return { airline, flightNumber, airlineName };
  }
  return { airline: '', flightNumber: trimmed, airlineName: 'Unknown' };
}

const IATA_AIRPORTS: Record<string, { city: string; name: string }> = {
  'JFK': { city: 'New York', name: 'John F. Kennedy International' },
  'LAX': { city: 'Los Angeles', name: 'Los Angeles International' },
  'ORD': { city: 'Chicago', name: "O'Hare International" },
  'DFW': { city: 'Dallas', name: 'Dallas/Fort Worth International' },
  'DEN': { city: 'Denver', name: 'Denver International' },
  'ATL': { city: 'Atlanta', name: 'Hartsfield-Jackson International' },
  'SFO': { city: 'San Francisco', name: 'San Francisco International' },
  'SEA': { city: 'Seattle', name: 'Seattle-Tacoma International' },
  'MIA': { city: 'Miami', name: 'Miami International' },
  'BOS': { city: 'Boston', name: 'Boston Logan International' },
  'EWR': { city: 'Newark', name: 'Newark Liberty International' },
  'PHX': { city: 'Phoenix', name: 'Phoenix Sky Harbor International' },
  'IAH': { city: 'Houston', name: 'George Bush Intercontinental' },
  'LAS': { city: 'Las Vegas', name: 'Harry Reid International' },
  'MSP': { city: 'Minneapolis', name: 'Minneapolis-Saint Paul International' },
  'DTW': { city: 'Detroit', name: 'Detroit Metropolitan' },
  'PHL': { city: 'Philadelphia', name: 'Philadelphia International' },
  'FLL': { city: 'Fort Lauderdale', name: 'Fort Lauderdale-Hollywood' },
  'BWI': { city: 'Baltimore', name: 'Baltimore/Washington International' },
  'DCA': { city: 'Washington DC', name: 'Ronald Reagan Washington National' },
  'IAD': { city: 'Washington DC', name: 'Washington Dulles International' },
  'SAN': { city: 'San Diego', name: 'San Diego International' },
  'TPA': { city: 'Tampa', name: 'Tampa International' },
  'MDW': { city: 'Chicago', name: 'Chicago Midway International' },
  'LGA': { city: 'New York', name: 'LaGuardia' },
  'SLC': { city: 'Salt Lake City', name: 'Salt Lake City International' },
  'HNL': { city: 'Honolulu', name: 'Honolulu International' },
  'MCO': { city: 'Orlando', name: 'Orlando International' },
  'PDX': { city: 'Portland', name: 'Portland International' },
  'STL': { city: 'St. Louis', name: 'St. Louis Lambert International' },
  'BNA': { city: 'Nashville', name: 'Nashville International' },
  'AUS': { city: 'Austin', name: 'Austin-Bergstrom International' },
  'RDU': { city: 'Raleigh', name: 'Raleigh-Durham International' },
  'SMF': { city: 'Sacramento', name: 'Sacramento International' },
  'CLE': { city: 'Cleveland', name: 'Cleveland Hopkins International' },
  'PIT': { city: 'Pittsburgh', name: 'Pittsburgh International' },
  'CMH': { city: 'Columbus', name: 'John Glenn Columbus International' },
  'IND': { city: 'Indianapolis', name: 'Indianapolis International' },
  'SJC': { city: 'San Jose', name: 'San Jose International' },
  'OAK': { city: 'Oakland', name: 'Oakland International' },
  'MCI': { city: 'Kansas City', name: 'Kansas City International' },
  'CVG': { city: 'Cincinnati', name: 'Cincinnati/Northern Kentucky International' },
  'RSW': { city: 'Fort Myers', name: 'Southwest Florida International' },
  'MEM': { city: 'Memphis', name: 'Memphis International' },
  'SAT': { city: 'San Antonio', name: 'San Antonio International' },
  'PBI': { city: 'West Palm Beach', name: 'Palm Beach International' },
  'JAX': { city: 'Jacksonville', name: 'Jacksonville International' },
  'BDL': { city: 'Hartford', name: 'Bradley International' },
  'OMA': { city: 'Omaha', name: 'Eppley Airfield' },
  'OKC': { city: 'Oklahoma City', name: 'Will Rogers World' },
  'ELP': { city: 'El Paso', name: 'El Paso International' },
  'ABQ': { city: 'Albuquerque', name: 'Albuquerque International Sunport' },
  'BUR': { city: 'Burbank', name: 'Hollywood Burbank Airport' },
  'SNA': { city: 'Orange County', name: 'John Wayne Airport' },
  'LGB': { city: 'Long Beach', name: 'Long Beach Airport' },
  'ONT': { city: 'Ontario', name: 'Ontario International' },
  'LHR': { city: 'London', name: 'London Heathrow' },
  'CDG': { city: 'Paris', name: 'Paris Charles de Gaulle' },
  'FRA': { city: 'Frankfurt', name: 'Frankfurt Airport' },
  'AMS': { city: 'Amsterdam', name: 'Amsterdam Schiphol' },
  'MAD': { city: 'Madrid', name: 'Madrid-Barajas' },
  'MUC': { city: 'Munich', name: 'Munich Airport' },
  'FCO': { city: 'Rome', name: 'Rome Fiumicino' },
  'BCN': { city: 'Barcelona', name: 'Barcelona-El Prat' },
  'LGW': { city: 'London', name: 'London Gatwick' },
  'ZRH': { city: 'Zurich', name: 'Zurich Airport' },
  'VIE': { city: 'Vienna', name: 'Vienna International' },
  'BRU': { city: 'Brussels', name: 'Brussels Airport' },
  'CPH': { city: 'Copenhagen', name: 'Copenhagen Airport' },
  'OSL': { city: 'Oslo', name: 'Oslo Gardermoen' },
  'ARN': { city: 'Stockholm', name: 'Stockholm Arlanda' },
  'HEL': { city: 'Helsinki', name: 'Helsinki Airport' },
  'DUB': { city: 'Dublin', name: 'Dublin Airport' },
  'IST': { city: 'Istanbul', name: 'Istanbul Airport' },
  'DXB': { city: 'Dubai', name: 'Dubai International' },
  'AUH': { city: 'Abu Dhabi', name: 'Abu Dhabi International' },
  'DOH': { city: 'Doha', name: 'Hamad International' },
  'JED': { city: 'Jeddah', name: 'King Abdulaziz International' },
  'RUH': { city: 'Riyadh', name: 'King Khalid International' },
  'CAI': { city: 'Cairo', name: 'Cairo International' },
  'TLV': { city: 'Tel Aviv', name: 'Ben Gurion Airport' },
  'AMM': { city: 'Amman', name: 'Queen Alia International' },
  'BEY': { city: 'Beirut', name: 'Beirut-Rafic Hariri' },
  'KWI': { city: 'Kuwait', name: 'Kuwait International' },
  'BAH': { city: 'Bahrain', name: 'Bahrain International' },
  'MCT': { city: 'Muscat', name: 'Muscat International' },
  'KHI': { city: 'Karachi', name: 'Jinnah International' },
  'DEL': { city: 'Delhi', name: 'Indira Gandhi International' },
  'BOM': { city: 'Mumbai', name: 'Chhatrapati Shivaji' },
  'BLR': { city: 'Bangalore', name: 'Kempegowda International' },
  'MAA': { city: 'Chennai', name: 'Chennai International' },
  'CCU': { city: 'Kolkata', name: 'Netaji Subhas Chandra Bose' },
  'HYD': { city: 'Hyderabad', name: 'Rajiv Gandhi International' },
  'ISB': { city: 'Islamabad', name: 'Islamabad International' },
  'LHE': { city: 'Lahore', name: 'Allama Iqbal International' },
  'DAC': { city: 'Dhaka', name: 'Hazrat Shahjalal International' },
  'KTM': { city: 'Kathmandu', name: 'Tribhuvan International' },
  'CMB': { city: 'Colombo', name: 'Bandaranaike International' },
  'MLE': { city: 'Male', name: 'Velana International' },
  'BKK': { city: 'Bangkok', name: 'Suvarnabhumi Airport' },
  'HKG': { city: 'Hong Kong', name: 'Hong Kong International' },
  'SIN': { city: 'Singapore', name: 'Singapore Changi' },
  'KUL': { city: 'Kuala Lumpur', name: 'Kuala Lumpur International' },
  'CGK': { city: 'Jakarta', name: 'Soekarno-Hatta International' },
  'MNL': { city: 'Manila', name: 'Ninoy Aquino International' },
  'TPE': { city: 'Taipei', name: 'Taiwan Taoyuan' },
  'NRT': { city: 'Tokyo', name: 'Narita International' },
  'HND': { city: 'Tokyo', name: 'Haneda Airport' },
  'KIX': { city: 'Osaka', name: 'Kansai International' },
  'ICN': { city: 'Seoul', name: 'Incheon International' },
  'PVG': { city: 'Shanghai', name: 'Shanghai Pudong' },
  'PEK': { city: 'Beijing', name: 'Beijing Capital' },
  'CAN': { city: 'Guangzhou', name: 'Guangzhou Baiyun' },
  'SZX': { city: 'Shenzhen', name: 'Shenzhen Baoan' },
  'CTU': { city: 'Chengdu', name: 'Chengdu Shuangliu' },
  'CKG': { city: 'Chongqing', name: 'Chongqing Jiangbei' },
  'KMZ': { city: 'Hangzhou', name: 'Hangzhou Xiaoshan' },
  'XIY': { city: 'Xian', name: "Xian Xianyang International" },
  'WUH': { city: 'Wuhan', name: 'Wuhan Tianhe' },
  'NKG': { city: 'Nanjing', name: 'Nanjing Lukou' },
  'SYD': { city: 'Sydney', name: 'Sydney Kingsford Smith' },
  'MEL': { city: 'Melbourne', name: 'Melbourne Airport' },
  'BNE': { city: 'Brisbane', name: 'Brisbane Airport' },
  'PER': { city: 'Perth', name: 'Perth Airport' },
  'AKL': { city: 'Auckland', name: 'Auckland Airport' },
  'GRU': { city: 'Sao Paulo', name: 'Sao Paulo-Guarulhos' },
  'GIG': { city: 'Rio de Janeiro', name: 'Rio de Janeiro-Galeao' },
  'EZE': { city: 'Buenos Aires', name: 'Ministro Pistarini' },
  'SCL': { city: 'Santiago', name: 'Santiago International' },
  'LIM': { city: 'Lima', name: 'Jorge Chavez International' },
  'BOG': { city: 'Bogota', name: 'El Dorado International' },
  'MEX': { city: 'Mexico City', name: 'Mexico City International' },
  'YYZ': { city: 'Toronto', name: 'Toronto Pearson' },
  'YVR': { city: 'Vancouver', name: 'Vancouver International' },
  'YUL': { city: 'Montreal', name: 'Montreal-Trudeau' },
  'YYC': { city: 'Calgary', name: 'Calgary International' },
};

function getAirportInfo(code: string): { city: string; name: string } {
  if (!code || code.length !== 3) return { city: 'Unknown', name: 'Unknown' };
  return IATA_AIRPORTS[code.toUpperCase()] || { city: code, name: code + ' Airport' };
}

async function fetchFlightRoute(hex: string, callsign: string): Promise<{ origin: string; destination: string; airline: string; flightNumber: string }> {
  const cacheKey = `${hex}_${callsign}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }
  const parsed = parseCallsign(callsign);
  const result = {
    origin: '',
    destination: '',
    airline: parsed.airlineName,
    flightNumber: parsed.flightNumber
  };
  routeCache.set(cacheKey, result);
  return result;
}

// Maximum flight tracking using OpenSky Network
app.get('/api/flights', async (req, res) => {
  try {
    if (flightCache && Date.now() - flightCache.timestamp < CACHE_DURATION) {
      res.json(flightCache.data);
      return;
    }

    console.log('[PROXY] Fetching flights from OpenSky Network...');
    
    // Query 6 global bounds from OpenSky for maximum coverage
    const bounds = [
      { lamin: 20, lomax: 60, lomin: -180, lomax: -30 },
      { lamin: 20, lomax: 60, lomin: -30, lomax: 60 },
      { lamin: 20, lomax: 60, lomin: 60, lomax: 180 },
      { lamin: -60, lomax: 20, lomin: -180, lomax: -30 },
      { lamin: -60, lomax: 20, lomin: -30, lomax: 60 },
      { lamin: -60, lomax: 20, lomin: 60, lomax: 180 },
    ];

    const fetchPromises = bounds.map(async (b) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const url = `https://opensky-network.org/api/states/all?lamin=${b.lamin}&lamax=${b.lomax}&lomin=${b.lomin}&lomax=${b.lomax}`;
        const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'WorldView-OSINT/1.0' } });
        clearTimeout(timeout);
        if (!resp.ok) return [];
        const data = await resp.json();
        return data?.states || [];
      } catch { return []; }
    });

    const allStates = await Promise.all(fetchPromises);
    const flights = allStates.flat().filter((f: any) => f && f[0] && f[5] !== null && f[6] !== null);

    // Build aircraftDetails map with enhanced data
    const aircraftDetails: Record<string, any> = {};
    const routePromises: Promise<void>[] = [];

    flights.forEach((flight: any[]) => {
      const hex = flight[0];
      const callsign = (flight[1]?.trim() || 'UNKNOWN');
      const parsed = parseCallsign(callsign);

      aircraftDetails[hex] = {
        hex,
        callsign,
        registration: flight[2] || '',
        lat: flight[6],
        lon: flight[5],
        altBar: flight[7],
        onGround: flight[8],
        groundSpeed: flight[9] || 0,
        track: flight[10] || 0,
        verticalSpeed: flight[11] || 0,
        altGeom: flight[12],
        squawk: flight[14] || '',
        aircraftType: flight[17] || '',
        aircraftDesc: flight[18] || '',
        time: flight[3],
        lastContact: flight[4],
        baro_rate: flight[11] || 0,
        nac_p: flight[17] || 0,
        nic: flight[17] || 0,
        rssi: null,
        airline: parsed.airlineName,
        flightNumber: parsed.flightNumber,
        airlineCode: parsed.airline,
        origin: '',
        originCity: '',
        destination: '',
        destinationCity: '',
      };

      routePromises.push(
        fetchFlightRoute(hex, callsign).then(route => {
          if (route) {
            const originInfo = getAirportInfo(route.origin);
            const destInfo = getAirportInfo(route.destination);
            aircraftDetails[hex].origin = route.origin;
            aircraftDetails[hex].originCity = originInfo.city;
            aircraftDetails[hex].destination = route.destination;
            aircraftDetails[hex].destinationCity = destInfo.city;
          }
        }).catch(() => {})
      );
    });

    await Promise.all(routePromises);

    const result = {
      states: flights,
      time: Date.now() / 1000,
      total: flights.length,
      aircraftDetails
    };

    flightCache = { data: result, timestamp: Date.now() };
    console.log(`[PROXY] Total flights: ${flights.length}`);
    res.json(result);
  } catch (error) {
    console.error('[PROXY] Flight error:', error);
    if (flightCache) res.json(flightCache.data);
    else res.status(503).json({ error: 'Flight data unavailable' });
  }
});

// Get single flight details
app.get('/api/flight/:hex', async (req, res) => {
  const hex = req.params.hex?.toUpperCase();
  if (flightCache?.data?.aircraftDetails?.[hex]) {
    res.json(flightCache.data.aircraftDetails[hex]);
  } else {
    res.status(404).json({ error: 'Flight not found' });
  }
});

// Satellites from CelesTrak
app.get('/api/satellites', async (req, res) => {
  try {
    if (satelliteCache && Date.now() - satelliteCache.timestamp < CACHE_DURATION * 60) {
      res.send(satelliteCache.data);
      return;
    }
    const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', 
      { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    satelliteCache = { data: text, timestamp: Date.now() };
    console.log('[PROXY] Fetched TLE data');
    res.send(text);
  } catch (error) {
    console.error('[PROXY] Satellite error:', error);
    if (satelliteCache) res.send(satelliteCache.data);
    else res.status(503).json({ error: 'Satellite data unavailable' });
  }
});

// GPS Jamming detection
app.get('/api/gps-jamming', async (req, res) => {
  const regions = [
    { lat: 35, lon: 45, range: 200 },
    { lat: 30, lon: 50, range: 200 },
    { lat: 55, lon: 35, range: 200 },
  ];

  const jammingPoints: any[] = [];
  const responses = await Promise.all(
    regions.map(async (r) => {
      try {
        const resp = await fetch(`https://api.airplanes.live/v2/point/${r.lat}/${r.lon}/${r.range}`, 
          { signal: AbortSignal.timeout(5000) });
        return resp.ok ? await resp.json() : null;
      } catch { return null; }
    })
  );

  responses.forEach((data: any) => {
    if (data?.ac) {
      data.ac.forEach((ac: any) => {
        if ((ac.nac_p && ac.nac_p < 8) || (ac.nic && ac.nic < 7)) {
          jammingPoints.push({ lat: ac.lat, lon: ac.lon, intensity: 1, count: 1 });
        }
      });
    }
  });

  res.json({ zones: jammingPoints, timestamp: Date.now() });
});

// Maritime data
app.get('/api/maritime', async (req, res) => {
  const vessels = [
    { mmsi: "456789001", name: "STAVANGER STAR", lat: 26.25, lon: 56.35, speed: 12, heading: 90, type: "Tanker", flag: "Norway" },
    { mmsi: "456789002", name: "PACIFIC KHALIFA", lat: 26.3, lon: 56.4, speed: 10, heading: 270, type: "Tanker", flag: "UAE" },
    { mmsi: "456789003", name: "GROWING POWER", lat: 26.15, lon: 56.25, speed: 8, heading: 45, type: "Tanker", flag: "Iran" },
    { mmsi: "456789004", name: "OCEAN GLORY", lat: 26.4, lon: 56.5, speed: 14, heading: 180, type: "Tanker", flag: "Saudi" },
    { mmsi: "456789005", name: "USS LEYTE", lat: 25.8, lon: 55.3, speed: 15, heading: 90, type: "warship", flag: "USA" },
  ];
  res.json({ vessels, timestamp: Date.now() });
});

// No-fly zones
app.get('/api/noflyzones', async (req, res) => {
  const zones = [
    { id: "IRAN", name: "Iranian Airspace", lat: 32.5, lon: 53.0, radius: 800000, type: "restricted", active: true, level: "closed" },
    { id: "IRQ", name: "Iraqi Airspace", lat: 33.3, lon: 44.3, radius: 400000, type: "restricted", active: true, level: "partial" },
    { id: "ISR", name: "Israeli Airspace", lat: 32.0, lon: 35.0, radius: 300000, type: "restricted", active: true, level: "partial" },
    { id: "BHR", name: "Bahrain FIR", lat: 26.0, lon: 50.6, radius: 150000, type: "caution", active: true, level: "advisory" },
    { id: "KWT", name: "Kuwait Airspace", lat: 29.3, lon: 47.5, radius: 120000, type: "restricted", active: true, level: "closed" },
    { id: "UKR", name: "Ukrainian Airspace", lat: 48.5, lon: 32.5, radius: 600000, type: "danger", active: true, level: "closed" },
    { id: "REDSEA", name: "Red Sea Danger Zone", lat: 15.0, lon: 42.5, radius: 400000, type: "danger", active: true, level: "advisory" },
  ];
  res.json({ zones, timestamp: Date.now() });
});

// Timeline
app.get('/api/timeline/:hours', async (req, res) => {
  const hours = Math.min(parseInt(req.params.hours) || 1, 24);
  const timestamps: number[] = [];
  const now = Date.now();
  for (let i = hours * 12; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }
  res.json({ timestamps, timestamp: now });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('[PROXY] OpenSky Network - Maximum global flight coverage');
});