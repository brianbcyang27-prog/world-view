import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;
app.use(cors());

let flightCache: { data: object; timestamp: number } | null = null;
let satelliteCache: { data: string; timestamp: number } | null = null;
const routeCache: Map<string, any> = new Map();
const aircraftInfoCache: Map<string, any> = new Map();
const CACHE_DURATION = 45000;

const ROUTES_CACHE: Map<string, { origin: string; destination: string }[]> = new Map();
let routesLoaded = false;

async function loadRoutesDatabase(): Promise<void> {
if (routesLoaded) return;
try {
const resp = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat');
const text = await resp.text();
const lines = text.split('\n');
lines.forEach(line => {
const parts = line.split(',');
if (parts.length >= 4) {
const airline = parts[0];
const origin = parts[2];
const dest = parts[4];
const key = `${airline}:${origin}:${dest}`;
if (!ROUTES_CACHE.has(airline)) {
ROUTES_CACHE.set(airline, []);
}
const routes = ROUTES_CACHE.get(airline)!;
if (!routes.some(r => r.origin === origin && r.destination === dest)) {
routes.push({ origin, destination: dest });
}
}
});
routesLoaded = true;
console.log('[PROXY] Loaded routes database:', ROUTES_CACHE.size, 'airlines');
} catch (e) {
console.error('[PROXY] Failed to load routes:', e);
}
}

function findRouteForCallsign(callsign: string): { origin: string; destination: string } {
const parsed = parseCallsign(callsign);
if (!parsed.airline) return { origin: '', destination: '' };

const routes = ROUTES_CACHE.get(parsed.airline);
if (routes && routes.length > 0) {
const hash = Math.abs(hashCode(callsign)) % routes.length;
return routes[hash];
}
return { origin: '', destination: '' };
}

function hashCode(str: string): number {
let hash = 0;
for (let i = 0; i < str.length; i++) {
hash = ((hash << 5) - hash) + str.charCodeAt(i);
hash |= 0;
}
return hash;
}

const AIRLINE_CODES: Record<string, string> = {
  'AAL': 'American Airlines', 'ACA': 'Air Canada', 'AFR': 'Air France', 'AIC': 'Air India',
  'ANA': 'All Nippon Airways', 'BAW': 'British Airways', 'CAL': 'Air China', 'CPA': 'Cathay Pacific',
  'CSN': 'China Southern', 'DAL': 'Delta Air Lines', 'DLH': 'Lufthansa', 'ETD': 'Etihad Airways',
  'ETH': 'Ethiopian Airlines', 'EVA': 'EVA Air', 'EXS': 'Jet2.com', 'FDX': 'FedEx Express',
  'FFT': 'Frontier Airlines', 'FIN': 'Finnair', 'GFA': 'Gulf Air', 'HAL': 'Hawaiian Airlines',
  'IBE': 'Iberia', 'JAL': 'Japan Airlines', 'JBU': 'JetBlue Airways', 'KAL': 'Korean Air',
  'KLM': 'KLM Royal Dutch', 'LAN': 'LATAM Airlines', 'LOT': 'LOT Polish Airlines',
  'MAS': 'Malaysia Airlines', 'NKS': 'Spirit Airlines', 'OAW': 'Austrian Airlines',
  'PAL': 'Philippine Airlines', 'QFA': 'Qantas', 'QTR': 'Qatar Airways', 'SAS': 'Scandinavian Airlines',
  'SWA': 'Southwest Airlines', 'SIA': 'Singapore Airlines', 'SKW': 'SkyWest Airlines',
  'THA': 'Thai Airways International', 'TRA': 'Transavia', 'TSC': 'Air Transat',
  'TUI': 'TUI Airways', 'TUR': 'Turkish Airlines', 'UAE': 'Emirates', 'UAL': 'United Airlines',
  'UPS': 'UPS Airlines', 'VIR': 'Virgin Atlantic', 'VOI': 'Volaris', 'WJA': 'WestJet',
  'WZZ': 'Wizz Air', 'RYR': 'Ryanair', 'EZY': 'easyJet', 'ASA': 'Alaska Airlines',
  'ASA': 'Alaska Airlines', 'JAI': 'SpiceJet', 'IGO': 'IndiGo', 'GIA': 'Garuda Indonesia',
  'MSR': 'EgyptAir', 'RAM': 'Royal Air Maroc', 'SAA': 'South African Airways',
  'AVA': 'Avianca', 'TAM': 'LATAM Brazil', 'IBE': 'Iberia', 'AFL': 'Aeroflot',
  'BAW': 'British Airways', 'KLM': 'KLM', 'AFR': 'Air France', 'DLH': 'Lufthansa',
  'SWR': 'Swiss International', 'AUA': 'Austrian', 'BEL': 'Brussels Airlines',
  'TAP': 'TAP Air Portugal', 'FIN': 'Finnair', 'SAS': 'SAS Scandinavian',
  'NVG': 'Norse Atlantic', 'NAX': 'Norwegian Air Shuttle', 'IAE': 'Iberia Express',
  'VLG': 'Vueling', 'GEC': 'Lufthansa Cargo', 'CRL': 'China Airlines',
  'CES': 'China Eastern', 'CSZ': 'Shenzhen Airlines', 'CKK': 'China Cargo',
  'CDG': 'Shandong Airlines', 'CQH': 'Spring Airlines', 'DKH': 'Juneyao Air',
  'OKA': 'Okay Airways', 'TJB': 'Tianjin Airlines', 'UQW': 'Urumqi Air',
  'CXA': 'Xiamen Airlines', 'FZA': 'Fuji Dream Airlines', 'APJ': 'Peach Aviation',
  'JJP': 'Jetstar Japan', 'JJA': 'Jin Air', 'TWB': 'T\'way Air', 'ABL': 'Air Busan',
  'ASV': 'Air Seoul', 'KOR': 'Korean Air', 'AAR': 'Asiana Airlines', 'JNA': 'Jeju Air',
  'RCH': 'US Air Force', 'CMV': 'US Military', 'TALON': 'US Military', 'UGLY': 'US Military',
  'BANZAI': 'US Military', 'EAGLE': 'US Military', 'REACH': 'US Military',
  'VIP': 'VIP Flight', 'TT': 'Test Flight', 'CFE': 'British CityFlyer', 'BCS': 'DHL',
  'GTI': 'Atlas Air', 'NJE': 'NetJets Europe', 'EJA': 'NetJets', 'NKS': 'Spirit',
  'SY': 'Sun Country', 'F9': 'Frontier', 'B6': 'JetBlue', 'NK': 'Spirit',
  'WN': 'Southwest', 'AA': 'American Airlines', 'UA': 'United Airlines', 'DL': 'Delta',
  'AS': 'Alaska Airlines', 'HA': 'Hawaiian Airlines', 'F9': 'Frontier', 'G4': 'Allegiant',
  'AM': 'Aeromexico', 'Y4': 'Volaris', 'YV': 'Volaris', '4O': 'VivaAerobus',
  'Q9': 'Magnicharters', 'VB': 'VivaAerobus', 'YQ': 'Aeromar', 'QA': 'Quantas'
};

const AIRLINE_ROUTES: Record<string, { hubs: string[]; commonRoutes: string[] }> = {
  'UAL': { hubs: ['ORD', 'DEN', 'IAH', 'SFO', 'EWR', 'IAD'], commonRoutes: ['LAX', 'ATL', 'DFW', 'MIA', 'BOS', 'SEA'] },
  'DAL': { hubs: ['ATL', 'DTW', 'MSP', 'LAX', 'SEA', 'JFK', 'SLC'], commonRoutes: ['LAX', 'SFO', 'ORD', 'DFW', 'MIA', 'BOS'] },
  'AAL': { hubs: ['DFW', 'CLT', 'ORD', 'PHX', 'PHL', 'MIA', 'LAX', 'DCA'], commonRoutes: ['LAX', 'JFK', 'BOS', 'ORD', 'MIA'] },
  'SWA': { hubs: ['DAL', 'HOU', 'PHX', 'BW', 'MDW', 'DEN', 'LAS', 'OAK'], commonRoutes: ['LAX', 'LAS', 'PHX', 'DEN', 'OAK'] },
  'JBU': { hubs: ['JFK', 'BOS', 'FLL', 'LAX', 'SJU'], commonRoutes: ['LAX', 'SFO', 'SEA', 'MCO', 'LAS'] },
  'UAE': { hubs: ['DXB'], commonRoutes: ['LHR', 'JFK', 'LAX', 'SYD', 'HKG', 'BKK', 'SIN', 'DEL'] },
  'QTR': { hubs: ['DOH'], commonRoutes: ['LHR', 'JFK', 'LAX', 'SYD', 'BKK', 'SIN', 'DEL'] },
  'ETD': { hubs: ['AUH'], commonRoutes: ['LHR', 'JFK', 'LAX', 'BKK', 'SIN', 'DEL', 'SYD'] },
  'BAW': { hubs: ['LHR', 'LGW'], commonRoutes: ['JFK', 'LAX', 'DXB', 'HKG', 'SIN', 'BOM', 'DEL'] },
  'DLH': { hubs: ['FRA', 'MUC'], commonRoutes: ['JFK', 'LAX', 'BKK', 'SIN', 'HKG', 'DEL', 'TLV'] },
  'AFR': { hubs: ['CDG', 'ORY'], commonRoutes: ['JFK', 'LAX', 'DXB', 'BKK', 'SIN', 'HKG', 'DEL'] },
  'KLM': { hubs: ['AMS'], commonRoutes: ['JFK', 'LAX', 'DXB', 'BKK', 'SIN', 'HKG', 'DEL', 'JNB'] },
  'SIA': { hubs: ['SIN'], commonRoutes: ['LHR', 'SYD', 'HKG', 'DXB', 'BKK', 'DEL', 'MEL', 'LAX'] },
  'TUR': { hubs: ['IST'], commonRoutes: ['JFK', 'LAX', 'DXB', 'BKK', 'SIN', 'DEL', 'LHR', 'CDG'] },
  'ANA': { hubs: ['HND', 'NRT'], commonRoutes: ['LAX', 'SFO', 'JFK', 'HKG', 'SIN', 'BKK', 'SYD'] },
  'JAL': { hubs: ['HND', 'NRT', 'KIX'], commonRoutes: ['LAX', 'SFO', 'JFK', 'HKG', 'SIN', 'BKK', 'SYD'] },
  'CPA': { hubs: ['HKG'], commonRoutes: ['LAX', 'SFO', 'JFK', 'LHR', 'SYD', 'SIN', 'BKK', 'DEL'] },
  'KAL': { hubs: ['ICN'], commonRoutes: ['LAX', 'SFO', 'JFK', 'LHR', 'SYD', 'SIN', 'BKK', 'DEL'] },
  'THA': { hubs: ['BKK'], commonRoutes: ['LHR', 'SYD', 'HKG', 'SIN', 'DXB', 'DEL', 'LAX', 'NRT'] },
  'MAS': { hubs: ['KUL'], commonRoutes: ['SYD', 'LHR', 'HKG', 'SIN', 'BKK', 'DXB', 'DEL', 'NRT'] },
  'IBE': { hubs: ['MAD'], commonRoutes: ['JFK', 'LAX', 'MIA', 'LHR', 'CDG', 'FCO', 'BCN'] },
  'VIR': { hubs: ['LHR', 'MAN'], commonRoutes: ['JFK', 'LAX', 'SFO', 'MIA', 'BOS', 'LAS'] },
  'AIR': { hubs: ['DEL', 'BOM', 'BLR'], commonRoutes: ['DXB', 'LHR', 'SIN', 'BKK', 'HKG', 'SYD', 'JFK'] },
  'AIC': { hubs: ['DEL', 'BOM', 'BLR', 'MAA', 'CCU'], commonRoutes: ['DXB', 'LHR', 'SIN', 'BKK', 'JFK', 'SFO'] },
};

function parseCallsign(callsign: string): { airline: string; flightNumber: string; airlineName: string } {
  const trimmed = callsign.trim();
  if (!trimmed || trimmed === 'UNKNOWN') return { airline: '', flightNumber: '', airlineName: 'Unknown' };
  
  const match = trimmed.match(/^([A-Z]{2,3})(\d+[A-Z]*)$/i);
  if (match) {
    const airline = match[1].toUpperCase();
    const flightNumber = match[2];
    const airlineName = AIRLINE_CODES[airline] || airline;
    return { airline, flightNumber, airlineName };
  }
  return { airline: '', flightNumber: trimmed, airlineName: 'Private/General Aviation' };
}

function getCardinalDirection(heading: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(heading / 22.5) % 16];
}

const IATA_AIRPORTS: Record<string, { city: string; name: string; country: string }> = {
  'JFK': { city: 'New York', name: 'John F. Kennedy International', country: 'USA' },
  'LAX': { city: 'Los Angeles', name: 'Los Angeles International', country: 'USA' },
  'ORD': { city: 'Chicago', name: "O'Hare International", country: 'USA' },
  'DFW': { city: 'Dallas', name: 'Dallas/Fort Worth International', country: 'USA' },
  'DEN': { city: 'Denver', name: 'Denver International', country: 'USA' },
  'ATL': { city: 'Atlanta', name: 'Hartsfield-Jackson International', country: 'USA' },
  'SFO': { city: 'San Francisco', name: 'San Francisco International', country: 'USA' },
  'SEA': { city: 'Seattle', name: 'Seattle-Tacoma International', country: 'USA' },
  'MIA': { city: 'Miami', name: 'Miami International', country: 'USA' },
  'BOS': { city: 'Boston', name: 'Boston Logan International', country: 'USA' },
  'EWR': { city: 'Newark', name: 'Newark Liberty International', country: 'USA' },
  'PHX': { city: 'Phoenix', name: 'Phoenix Sky Harbor International', country: 'USA' },
  'IAH': { city: 'Houston', name: 'George Bush Intercontinental', country: 'USA' },
  'LAS': { city: 'Las Vegas', name: 'Harry Reid International', country: 'USA' },
  'MSP': { city: 'Minneapolis', name: 'Minneapolis-Saint Paul International', country: 'USA' },
  'DTW': { city: 'Detroit', name: 'Detroit Metropolitan', country: 'USA' },
  'PHL': { city: 'Philadelphia', name: 'Philadelphia International', country: 'USA' },
  'FLL': { city: 'Fort Lauderdale', name: 'Fort Lauderdale-Hollywood', country: 'USA' },
  'BWI': { city: 'Baltimore', name: 'Baltimore/Washington International', country: 'USA' },
  'DCA': { city: 'Washington DC', name: 'Ronald Reagan Washington National', country: 'USA' },
  'IAD': { city: 'Washington DC', name: 'Washington Dulles International', country: 'USA' },
  'SAN': { city: 'San Diego', name: 'San Diego International', country: 'USA' },
  'TPA': { city: 'Tampa', name: 'Tampa International', country: 'USA' },
  'MDW': { city: 'Chicago', name: 'Chicago Midway International', country: 'USA' },
  'LGA': { city: 'New York', name: 'LaGuardia', country: 'USA' },
  'SLC': { city: 'Salt Lake City', name: 'Salt Lake City International', country: 'USA' },
  'HNL': { city: 'Honolulu', name: 'Daniel K. Inouye International', country: 'USA' },
  'MCO': { city: 'Orlando', name: 'Orlando International', country: 'USA' },
  'PDX': { city: 'Portland', name: 'Portland International', country: 'USA' },
  'STL': { city: 'St. Louis', name: 'St. Louis Lambert International', country: 'USA' },
  'BNA': { city: 'Nashville', name: 'Nashville International', country: 'USA' },
  'AUS': { city: 'Austin', name: 'Austin-Bergstrom International', country: 'USA' },
  'RDU': { city: 'Raleigh', name: 'Raleigh-Durham International', country: 'USA' },
  'SMF': { city: 'Sacramento', name: 'Sacramento International', country: 'USA' },
  'CLE': { city: 'Cleveland', name: 'Cleveland Hopkins International', country: 'USA' },
  'PIT': { city: 'Pittsburgh', name: 'Pittsburgh International', country: 'USA' },
  'CMH': { city: 'Columbus', name: 'John Glenn Columbus International', country: 'USA' },
  'IND': { city: 'Indianapolis', name: 'Indianapolis International', country: 'USA' },
  'SJC': { city: 'San Jose', name: 'San Jose International', country: 'USA' },
  'OAK': { city: 'Oakland', name: 'Oakland International', country: 'USA' },
  'MCI': { city: 'Kansas City', name: 'Kansas City International', country: 'USA' },
  'CVG': { city: 'Cincinnati', name: 'Cincinnati/Northern Kentucky International', country: 'USA' },
  'RSW': { city: 'Fort Myers', name: 'Southwest Florida International', country: 'USA' },
  'MEM': { city: 'Memphis', name: 'Memphis International', country: 'USA' },
  'SAT': { city: 'San Antonio', name: 'San Antonio International', country: 'USA' },
  'PBI': { city: 'West Palm Beach', name: 'Palm Beach International', country: 'USA' },
  'JAX': { city: 'Jacksonville', name: 'Jacksonville International', country: 'USA' },
  'BDL': { city: 'Hartford', name: 'Bradley International', country: 'USA' },
  'OMA': { city: 'Omaha', name: 'Eppley Airfield', country: 'USA' },
  'OKC': { city: 'Oklahoma City', name: 'Will Rogers World', country: 'USA' },
  'ELP': { city: 'El Paso', name: 'El Paso International', country: 'USA' },
  'ABQ': { city: 'Albuquerque', name: 'Albuquerque International Sunport', country: 'USA' },
  'BUR': { city: 'Burbank', name: 'Hollywood Burbank Airport', country: 'USA' },
  'SNA': { city: 'Orange County', name: 'John Wayne Airport', country: 'USA' },
  'LGB': { city: 'Long Beach', name: 'Long Beach Airport', country: 'USA' },
  'ONT': { city: 'Ontario', name: 'Ontario International', country: 'USA' },
  'LHR': { city: 'London', name: 'London Heathrow', country: 'United Kingdom' },
  'CDG': { city: 'Paris', name: 'Paris Charles de Gaulle', country: 'France' },
  'FRA': { city: 'Frankfurt', name: 'Frankfurt Airport', country: 'Germany' },
  'AMS': { city: 'Amsterdam', name: 'Amsterdam Schiphol', country: 'Netherlands' },
  'MAD': { city: 'Madrid', name: 'Madrid-Barajas', country: 'Spain' },
  'MUC': { city: 'Munich', name: 'Munich Airport', country: 'Germany' },
  'FCO': { city: 'Rome', name: 'Rome Fiumicino', country: 'Italy' },
  'BCN': { city: 'Barcelona', name: 'Barcelona-El Prat', country: 'Spain' },
  'LGW': { city: 'London', name: 'London Gatwick', country: 'United Kingdom' },
  'ZRH': { city: 'Zurich', name: 'Zurich Airport', country: 'Switzerland' },
  'VIE': { city: 'Vienna', name: 'Vienna International', country: 'Austria' },
  'BRU': { city: 'Brussels', name: 'Brussels Airport', country: 'Belgium' },
  'CPH': { city: 'Copenhagen', name: 'Copenhagen Airport', country: 'Denmark' },
  'OSL': { city: 'Oslo', name: 'Oslo Gardermoen', country: 'Norway' },
  'ARN': { city: 'Stockholm', name: 'Stockholm Arlanda', country: 'Sweden' },
  'HEL': { city: 'Helsinki', name: 'Helsinki Airport', country: 'Finland' },
  'DUB': { city: 'Dublin', name: 'Dublin Airport', country: 'Ireland' },
  'IST': { city: 'Istanbul', name: 'Istanbul Airport', country: 'Turkey' },
  'DXB': { city: 'Dubai', name: 'Dubai International', country: 'UAE' },
  'AUH': { city: 'Abu Dhabi', name: 'Abu Dhabi International', country: 'UAE' },
  'DOH': { city: 'Doha', name: 'Hamad International', country: 'Qatar' },
  'JED': { city: 'Jeddah', name: 'King Abdulaziz International', country: 'Saudi Arabia' },
  'RUH': { city: 'Riyadh', name: 'King Khalid International', country: 'Saudi Arabia' },
  'CAI': { city: 'Cairo', name: 'Cairo International', country: 'Egypt' },
  'TLV': { city: 'Tel Aviv', name: 'Ben Gurion Airport', country: 'Israel' },
  'AMM': { city: 'Amman', name: 'Queen Alia International', country: 'Jordan' },
  'BEY': { city: 'Beirut', name: 'Beirut-Rafic Hariri', country: 'Lebanon' },
  'KWI': { city: 'Kuwait', name: 'Kuwait International', country: 'Kuwait' },
  'BAH': { city: 'Bahrain', name: 'Bahrain International', country: 'Bahrain' },
  'MCT': { city: 'Muscat', name: 'Muscat International', country: 'Oman' },
  'KHI': { city: 'Karachi', name: 'Jinnah International', country: 'Pakistan' },
  'DEL': { city: 'Delhi', name: 'Indira Gandhi International', country: 'India' },
  'BOM': { city: 'Mumbai', name: 'Chhatrapati Shivaji', country: 'India' },
  'BLR': { city: 'Bangalore', name: 'Kempegowda International', country: 'India' },
  'MAA': { city: 'Chennai', name: 'Chennai International', country: 'India' },
  'CCU': { city: 'Kolkata', name: 'Netaji Subhas Chandra Bose', country: 'India' },
  'HYD': { city: 'Hyderabad', name: 'Rajiv Gandhi International', country: 'India' },
  'ISB': { city: 'Islamabad', name: 'Islamabad International', country: 'Pakistan' },
  'LHE': { city: 'Lahore', name: 'Allama Iqbal International', country: 'Pakistan' },
  'DAC': { city: 'Dhaka', name: 'Hazrat Shahjalal International', country: 'Bangladesh' },
  'KTM': { city: 'Kathmandu', name: 'Tribhuvan International', country: 'Nepal' },
  'CMB': { city: 'Colombo', name: 'Bandaranaike International', country: 'Sri Lanka' },
  'MLE': { city: 'Male', name: 'Velana International', country: 'Maldives' },
  'BKK': { city: 'Bangkok', name: 'Suvarnabhumi Airport', country: 'Thailand' },
  'HKG': { city: 'Hong Kong', name: 'Hong Kong International', country: 'Hong Kong' },
  'SIN': { city: 'Singapore', name: 'Singapore Changi', country: 'Singapore' },
  'KUL': { city: 'Kuala Lumpur', name: 'Kuala Lumpur International', country: 'Malaysia' },
  'CGK': { city: 'Jakarta', name: 'Soekarno-Hatta International', country: 'Indonesia' },
  'MNL': { city: 'Manila', name: 'Ninoy Aquino International', country: 'Philippines' },
  'TPE': { city: 'Taipei', name: 'Taiwan Taoyuan', country: 'Taiwan' },
  'NRT': { city: 'Tokyo', name: 'Narita International', country: 'Japan' },
  'HND': { city: 'Tokyo', name: 'Haneda Airport', country: 'Japan' },
  'KIX': { city: 'Osaka', name: 'Kansai International', country: 'Japan' },
  'ICN': { city: 'Seoul', name: 'Incheon International', country: 'South Korea' },
  'PVG': { city: 'Shanghai', name: 'Shanghai Pudong', country: 'China' },
  'PEK': { city: 'Beijing', name: 'Beijing Capital', country: 'China' },
  'CAN': { city: 'Guangzhou', name: 'Guangzhou Baiyun', country: 'China' },
  'SZX': { city: 'Shenzhen', name: 'Shenzhen Baoan', country: 'China' },
  'CTU': { city: 'Chengdu', name: 'Chengdu Shuangliu', country: 'China' },
  'CKG': { city: 'Chongqing', name: 'Chongqing Jiangbei', country: 'China' },
  'HGH': { city: 'Hangzhou', name: 'Hangzhou Xiaoshan', country: 'China' },
  'XIY': { city: 'Xian', name: "Xian Xianyang International", country: 'China' },
  'WUH': { city: 'Wuhan', name: 'Wuhan Tianhe', country: 'China' },
  'NKG': { city: 'Nanjing', name: 'Nanjing Lukou', country: 'China' },
  'SYD': { city: 'Sydney', name: 'Sydney Kingsford Smith', country: 'Australia' },
  'MEL': { city: 'Melbourne', name: 'Melbourne Airport', country: 'Australia' },
  'BNE': { city: 'Brisbane', name: 'Brisbane Airport', country: 'Australia' },
  'PER': { city: 'Perth', name: 'Perth Airport', country: 'Australia' },
  'AKL': { city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand' },
  'GRU': { city: 'Sao Paulo', name: 'Sao Paulo-Guarulhos', country: 'Brazil' },
  'GIG': { city: 'Rio de Janeiro', name: 'Rio de Janeiro-Galeao', country: 'Brazil' },
  'EZE': { city: 'Buenos Aires', name: 'Ministro Pistarini', country: 'Argentina' },
  'SCL': { city: 'Santiago', name: 'Santiago International', country: 'Chile' },
  'LIM': { city: 'Lima', name: 'Jorge Chavez International', country: 'Peru' },
  'BOG': { city: 'Bogota', name: 'El Dorado International', country: 'Colombia' },
  'MEX': { city: 'Mexico City', name: 'Mexico City International', country: 'Mexico' },
  'YYZ': { city: 'Toronto', name: 'Toronto Pearson', country: 'Canada' },
  'YVR': { city: 'Vancouver', name: 'Vancouver International', country: 'Canada' },
  'YUL': { city: 'Montreal', name: 'Montreal-Trudeau', country: 'Canada' },
  'YYC': { city: 'Calgary', name: 'Calgary International', country: 'Canada' },
};

function getAirportInfo(code: string): { city: string; name: string; country: string } {
  if (!code || code.length !== 3) return { city: 'Unknown', name: 'Unknown', country: 'Unknown' };
  return IATA_AIRPORTS[code.toUpperCase()] || { city: code, name: code + ' Airport', country: 'Unknown' };
}

function estimateRoute(airline: string, lat: number, lon: number, flightNumber?: string): { origin: string; destination: string } {
if (airline && ROUTES_CACHE.has(airline)) {
const routes = ROUTES_CACHE.get(airline)!;
const idx = Math.abs(Math.floor(lat * 100 + lon)) % routes.length;
return routes[idx];
}
const routeInfo = AIRLINE_ROUTES[airline];
if (routeInfo) {
const now = Date.now();
const hash = Math.abs(lat * 1000 + lon * 100 + now % 86400) % routeInfo.hubs.length;
const hash2 = Math.abs(lat * 500 + lon * 50 + (now % 43200)) % routeInfo.commonRoutes.length;

const origin = routeInfo.hubs[hash % routeInfo.hubs.length];
const destination = routeInfo.commonRoutes[hash2 % routeInfo.commonRoutes.length];

if (origin === destination) {
return { origin, destination: routeInfo.commonRoutes[(hash2 + 1) % routeInfo.commonRoutes.length] };
}
return { origin, destination };
}

if (flightNumber && flightNumber.length >= 3) {
for (const [code, routes] of ROUTES_CACHE.entries()) {
if (routes.length > 0) {
const idx = Math.abs(flightNumber.charCodeAt(0) * 31 + flightNumber.charCodeAt(flightNumber.length - 1)) % routes.length;
return routes[idx];
}
}
}

return { origin: '', destination: '' };
}

async function fetchAircraftInfo(hex: string): Promise<any> {
  if (aircraftInfoCache.has(hex)) {
    return aircraftInfoCache.get(hex);
  }
  
  try {
    const resp = await fetch(`https://api.planespotters.net/pub/api/hex/${hex}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.aircraft) {
        const info = {
          type: data.aircraft?.typecode || '',
          registration: data.aircraft?.registration || '',
          airline: data.aircraft?.airline?.name || '',
          operator: data.aircraft?.operator || '',
          icaoType: data.aircraft?.icao_type || '',
          country: data.aircraft?.country || '',
          photo: data.aircraft?.photo?.url || null
        };
        aircraftInfoCache.set(hex, info);
        return info;
      }
    }
  } catch {}
  
  return null;
}

async function enrichFlightData(flight: any[]): Promise<any> {
  const hex = flight[0] as string;
  const callsign = (flight[1]?.trim() || 'UNKNOWN');
  const parsed = parseCallsign(callsign);
  const lat = flight[6] as number;
  const lon = flight[5] as number;
  
  const route = estimateRoute(parsed.airline, lat, lon, parsed.flightNumber);
  const aircraftInfo = await fetchAircraftInfo(hex);
  
  const originInfo = getAirportInfo(route.origin);
  const destInfo = getAirportInfo(route.destination);
  
  return {
    hex,
    callsign,
    registration: flight[2] || aircraftInfo?.registration || '',
    lat,
    lon,
    altBar: flight[7],
    onGround: flight[8] || false,
    groundSpeed: flight[9] || 0,
    track: flight[10] || 0,
    verticalSpeed: flight[11] || 0,
    altGeom: flight[12],
    squawk: flight[14] || '',
    aircraftType: aircraftInfo?.type || flight[17] || '',
    aircraftDesc: aircraftInfo?.icaoType || flight[18] || '',
    time: flight[3],
    lastContact: flight[4],
    baro_rate: flight[11] || 0,
    nac_p: flight[17] || 0,
    nic: flight[17] || 0,
    rssi: null,
    airline: aircraftInfo?.airline || parsed.airlineName,
    flightNumber: parsed.flightNumber,
    airlineCode: parsed.airline,
    origin: route.origin,
    originCity: originInfo.city,
    originCountry: originInfo.country,
    originName: originInfo.name,
    destination: route.destination,
    destinationCity: destInfo.city,
    destinationCountry: destInfo.country,
    destinationName: destInfo.name,
    operator: aircraftInfo?.operator || '',
    country: aircraftInfo?.country || '',
    photo: aircraftInfo?.photo || null,
  };
}

app.get('/api/flights', async (req, res) => {
  try {
    if (flightCache && Date.now() - flightCache.timestamp < CACHE_DURATION) {
      res.json(flightCache.data);
      return;
    }

console.log('[PROXY] Fetching flights...');

    // Try airplanes.live API - maximum global coverage with 12+ regions
    const regions = [
      { lat: 40, lon: -100, range: 300 }, // Central US
      { lat: 35, lon: -120, range: 250 }, // West US
      { lat: 40, lon: -75, range: 250 },  // East US
      { lat: 40, lon: -80, range: 200 },  // Southeast US
      { lat: 55, lon: -130, range: 250 }, // Pacific Northwest
      { lat: 25, lon: -80, range: 250 },  // Caribbean/Florida
      { lat: 51, lon: 10, range: 300 },   // Central Europe
      { lat: 48, lon: 2, range: 250 },    // France/UK
      { lat: 52, lon: 20, range: 250 },   // Eastern Europe
      { lat: 45, lon: -5, range: 250 },   // Atlantic/Western Europe
      { lat: 30, lon: 35, range: 250 },   // Red Sea/Middle East
      { lat: 24, lon: 54, range: 280 },   // Gulf/Arabian Sea
      { lat: 28, lon: 77, range: 280 },   // India
      { lat: 35, lon: 105, range: 280 },  // China
      { lat: 37, lon: 140, range: 280 },  // Japan/Korea
      { lat: 25, lon: 121, range: 250 },  // Taiwan/South China Sea
      { lat: 1, lon: 104, range: 280 },   // Southeast Asia (Singapore)
      { lat: -33, lon: 151, range: 280 }, // Australia
      { lat: -23, lon: -46, range: 280 }, // Brazil/South America
      { lat: 35, lon: -105, range: 300 }, // Mexico/Central America
      { lat: 64, lon: -150, range: 280 }, // Alaska
      { lat: 22, lon: 114, range: 250 },  // Hong Kong/South China
      { lat: 36, lon: 70, range: 280 },   // Afghanistan/Pakistan
    ];

    const allAircraft: any[] = [];

    await Promise.all(regions.map(async (r) => {
      try {
        const resp = await fetch(`https://api.airplanes.live/v2/point/${r.lat}/${r.lon}/${r.range}`, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'WorldView-OSINT/1.0' }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ac) {
            allAircraft.push(...data.ac);
          }
        }
      } catch (e) {
        console.log(`[PROXY] Region fetch error:`, e);
      }
    }));

    console.log(`[PROXY] Got ${allAircraft.length} aircraft from airplanes.live`);

    // Convert to OpenSky-style format for compatibility
    const flights: any[] = [];
    const aircraftDetails: Record<string, any> = {};

allAircraft.forEach((ac: any) => {
  if (!ac.hex || ac.lat === null || ac.lon === null) return;

  const hex = ac.hex.toUpperCase();
  const callsign = ac.flight?.trim() || '';
  const parsed = parseCallsign(callsign);
  const isOnGround = ac.alt_baro === 'ground' || ac.gnd === true;
  const altitudeBar = typeof ac.alt_baro === 'number' ? ac.alt_baro : (isOnGround ? 0 : 0);
  const altitudeGeom = typeof ac.alt_geom === 'number' ? ac.alt_geom : altitudeBar;

  flights.push([
    hex,                    // 0: icao24
    callsign,               // 1: callsign
    ac.r || ac.country || '', // 2: registration/country
    ac.seen_pos || 0,       // 3: time_position
    ac.seen || 0,           // 4: last_contact
    ac.lon,                 // 5: lon
    ac.lat,                 // 6: lat
    altitudeBar,            // 7: altitude (always number)
    isOnGround,             // 8: on ground
    ac.gs || 0,             // 9: velocity
    ac.track || 0,          // 10: true_track
    ac.baro_rate || 0,      // 11: vertical rate
    altitudeGeom,           // 12: geo altitude
    ac.squawk || '',        // 13: squawk
    ac.squawk || '',        // 14: squawk (alternative)
    ac.spi || false,        // 15: spi
    altitudeBar,            // 16: position source
    ac.t || '',             // 17: aircraft type
    ac.desc || '',          // 18: aircraft desc
]);

const aircraftType = (ac.t || '').toUpperCase();
const isCommercialAircraft = /^(A20N|A319|A320|A321|A30N|A310|A330|A340|A350|A380|B37M|B38M|B39M|B737|B738|B739|B744|B747|B748|B749|B752|B753|B762|B763|B764|B772|B773|B788|B789|C-17|C-130|CRJ1|CRJ2|CRJ7|CRJ9|E190|E195|EJET)$/.test(aircraftType);

let route = estimateRoute(parsed.airline, ac.lat, ac.lon, parsed.flightNumber);

if ((!route.origin || !route.destination) && isCommercialAircraft && parsed.flightNumber) {
const allRoutes: {origin: string; destination: string}[] = [];
for (const [, routes] of ROUTES_CACHE.entries()) {
allRoutes.push(...routes);
}
if (allRoutes.length > 0) {
const idx = Math.abs(Math.floor(ac.lat * 100 + ac.lon * 10 + parsed.flightNumber.charCodeAt(0))) % allRoutes.length;
route = allRoutes[idx];
}
}

const originInfo = getAirportInfo(route.origin);
const destInfo = getAirportInfo(route.destination);

aircraftDetails[hex] = {
    hex,
    callsign,
    registration: ac.r || '',
    lat: ac.lat,
    lon: ac.lon,
    altBar: altitudeBar,
    altGeom: altitudeGeom,
    onGround: isOnGround,
    groundSpeed: ac.gs || 0,
    groundSpeedKmh: ac.gs ? Math.round(ac.gs * 1.852) : 0,
    track: ac.track || 0,
    trackDirection: getCardinalDirection(ac.track || 0),
    verticalSpeed: ac.baro_rate || 0,
    verticalSpeedFpm: ac.baro_rate ? Math.round(ac.baro_rate * 196.85) : 0,
    squawk: ac.squawk || '',
    aircraftType: ac.t || '',
    aircraftDesc: ac.desc || '',
    baro_rate: ac.baro_rate || 0,
    nac_p: ac.nac_p || 10,
    nic: ac.nic || 8,
    rssi: ac.rssi || null,
    alert: ac.alert || false,
    emergency: ac.emergency || 'none',
    navAltitudeMcp: ac.nav_altitude_mcp || null,
    navHeading: ac.nav_heading || null,
    navQnh: ac.nav_qnh || null,
    messages: ac.messages || 0,
    seenPos: ac.seen_pos || 0,
    seen: ac.seen || 0,
    dst: ac.dst || 0,
    dir: ac.dir || 0,
    operator: ac.ownOp || '',
    year: ac.year || '',
    category: ac.category || '',
    version: ac.version || 2,
    sil: ac.sil || 3,
    silType: ac.sil_type || 'perhour',
    gva: ac.gva || 2,
    sda: ac.sda || 2,
    airline: parsed.airlineName,
    flightNumber: parsed.flightNumber,
    airlineCode: parsed.airline,
    origin: route.origin,
    originCity: originInfo.city,
    originCountry: originInfo.country,
    originName: originInfo.name,
    destination: route.destination,
    destinationCity: destInfo.city,
    destinationCountry: destInfo.country,
    destinationName: destInfo.name,
    distance: ac.dst || 0,
    direction: ac.dir || 0,
    dbFlags: ac.dbFlags,
    mil: (ac.dbFlags && (ac.dbFlags & 1)) || ac.t?.includes('C-') || ac.t?.includes('F-') || callsign.includes('RCH') || callsign.includes('CMV'),
    country: ac.country || '',
    type: ac.type || 'adsb_icao',
  };
});

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

app.get('/api/flight/:hex', async (req, res) => {
  const hex = req.params.hex?.toUpperCase();
  if (flightCache?.data?.aircraftDetails?.[hex]) {
    res.json(flightCache.data.aircraftDetails[hex]);
  } else {
    const info = await fetchAircraftInfo(hex);
    if (info) res.json(info);
    else res.status(404).json({ error: 'Flight not found' });
  }
});

app.get('/api/satellites', async (req, res) => {
try {
if (satelliteCache && Date.now() - satelliteCache.timestamp < CACHE_DURATION * 60) {
res.send(satelliteCache.data);
return;
}
// Try multiple TLE sources
const tleUrls = [
'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
];

let lastError: Error | null = null;
for (const url of tleUrls) {
try {
const response = await fetch(url, {
signal: AbortSignal.timeout(30000),
headers: { 'User-Agent': 'WorldView-OSINT/1.0' }
});
if (response.ok) {
const text = await response.text();
satelliteCache = { data: text, timestamp: Date.now() };
console.log('[PROXY] Fetched TLE data from:', url);
res.send(text);
return;
}
} catch (e) {
lastError = e as Error;
console.log('[PROXY] TLE source failed:', url, e);
}
}
// Return cached data if available
if (satelliteCache) {
console.log('[PROXY] Returning cached TLE data');
res.send(satelliteCache.data);
} else {
throw lastError || new Error('All TLE sources failed');
}
} catch (error) {
console.error('[PROXY] Satellite error:', error);
if (satelliteCache) res.send(satelliteCache.data);
else res.status(503).json({ error: 'Satellite data unavailable - CelesTrak timeout. Try again later.' });
}
});

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
        const resp = await fetch(`https://api.airplanes.live/v2/point/${r.lat}/${r.lon}/${r.range}`, {
          signal: AbortSignal.timeout(5000)
        });
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

app.get('/api/timeline/:hours', async (req, res) => {
  const hours = Math.min(parseInt(req.params.hours) || 1, 24);
  const timestamps: number[] = [];
  const now = Date.now();
  for (let i = hours * 12; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }
  res.json({ timestamps, timestamp: now });
});

app.get('/api/news', async (req, res) => {
try {
const query = req.query.q as string || '';
const mode = req.query.mode as string || 'artlist';
const timespan = req.query.timespan as string || '24h';
const format = req.query.format as string || 'json';

const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query || 'world news')}&mode=${mode}&timespan=${timespan}&format=${format}&maxrecords=50`;

const response = await fetch(gdeltUrl, {
signal: AbortSignal.timeout(30000),
headers: { 'User-Agent': 'WorldView-OSINT/1.0' }
});

if (!response.ok) throw new Error(`GDELT error: ${response.status}`);
const data = await response.json();

const articles = (data.articles || []).map((article: any) => ({
url: article.url,
title: article.title,
source: article.domain || new URL(article.url).hostname,
pubDate: article.seendate || article.pubdate,
language: article.sourcecollections?.[0]?.source?.language || 'en',
theme: article.themes?.[0]?.split(',')[0] || 'general',
tone: article.tone ? parseFloat(article.tone.split(',')[0]) : 0,
lat: null,
lon: null
}));

res.json({ articles, timestamp: Date.now(), total: articles.length });
} catch (error) {
console.error('[PROXY] News error:', error);
res.status(503).json({ error: 'News data unavailable', articles: [] });
}
});

app.get('/api/news/geo', async (req, res) => {
  const fallbackArticles = [
    { url: 'https://www.reuters.com/world', title: 'Global Political Updates - Latest developments worldwide', source: 'Reuters', pubDate: new Date().toISOString(), language: 'en', lat: 40.7, lon: -74.0 },
    { url: 'https://www.bbc.com/news', title: 'International News - Breaking news from around the world', source: 'BBC News', pubDate: new Date().toISOString(), language: 'en', lat: 51.5, lon: -0.1 },
    { url: 'https://www.aljazeera.com', title: 'Middle East Crisis Updates - Ongoing regional conflicts', source: 'Al Jazeera', pubDate: new Date().toISOString(), language: 'en', lat: 25.3, lon: 55.3 },
    { url: 'https://www.apnews.com', title: 'Asia Pacific News - Economic and political updates', source: 'AP News', pubDate: new Date().toISOString(), language: 'en', lat: 35.7, lon: 139.7 },
    { url: 'https://www.france24.com', title: 'European Affairs - EU policy and security updates', source: 'France 24', pubDate: new Date().toISOString(), language: 'en', lat: 48.9, lon: 2.3 },
    { url: 'https://www.dw.com', title: 'Germany News - Economic and environmental policy', source: 'DW', pubDate: new Date().toISOString(), language: 'en', lat: 52.5, lon: 13.4 },
    { url: 'https://www.theguardian.com', title: 'UK Politics - Latest from Westminster and beyond', source: 'The Guardian', pubDate: new Date().toISOString(), language: 'en', lat: 51.5, lon: -0.1 },
    { url: 'https://www.cnn.com', title: 'US News - Political and economic developments', source: 'CNN', pubDate: new Date().toISOString(), language: 'en', lat: 33.7, lon: -84.4 },
    { url: 'https://www.scmp.com', title: 'China News - Economic reforms and trade updates', source: 'SCMP', pubDate: new Date().toISOString(), language: 'en', lat: 31.2, lon: 121.5 },
    { url: 'https://www.theage.com', title: 'Australia News - Pacific region updates', source: 'The Age', pubDate: new Date().toISOString(), language: 'en', lat: -37.8, lon: 144.9 },
    { url: 'https://www.thehindu.com', title: 'India News - Regional developments and economy', source: 'The Hindu', pubDate: new Date().toISOString(), language: 'en', lat: 12.9, lon: 77.6 },
    { url: 'https://www.pravda.com.ua', title: 'Ukraine Conflict Updates - Latest war news', source: 'Ukrainska Pravda', pubDate: new Date().toISOString(), language: 'en', lat: 50.4, lon: 30.5 },
    { url: 'https://www.ynetnews.com', title: 'Middle East Updates - Israel and regional news', source: 'Ynet', pubDate: new Date().toISOString(), language: 'en', lat: 32.1, lon: 34.8 },
    { url: 'https://www.taipeitimes.com', title: 'Taiwan Strait Updates - Regional tensions', source: 'Taipei Times', pubDate: new Date().toISOString(), language: 'en', lat: 25.0, lon: 121.6 },
    { url: 'https://www.arabnews.com', title: 'Gulf Region News - Energy and politics', source: 'Arab News', pubDate: new Date().toISOString(), language: 'en', lat: 26.4, lon: 50.1 },
    { url: 'https://www.bloomberg.com', title: 'Global Markets - Financial news and analysis', source: 'Bloomberg', pubDate: new Date().toISOString(), language: 'en', lat: 40.7, lon: -74.0 },
    { url: 'https://www.ft.com', title: 'World Economy - Trade and finance updates', source: 'Financial Times', pubDate: new Date().toISOString(), language: 'en', lat: 51.5, lon: -0.1 },
    { url: 'https://www.nature.com', title: 'Climate Update - Environmental research and news', source: 'Nature', pubDate: new Date().toISOString(), language: 'en', lat: 51.5, lon: -0.1 },
    { url: 'https://www.science.org', title: 'Technology News - AI and innovation updates', source: 'Science', pubDate: new Date().toISOString(), language: 'en', lat: 38.9, lon: -77.0 },
    { url: 'https://www.wired.com', title: 'Cybersecurity News - Latest threats and defense', source: 'Wired', pubDate: new Date().toISOString(), language: 'en', lat: 37.8, lon: -122.4 }
  ];

  try {
    const query = req.query.q as string || 'conflict protest military disaster';
    const timespan = req.query.timespan as string || '24h';

    const docUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&timespan=${timespan}&maxrecords=50`;

    console.log('[PROXY] Fetching news from GDELT...');

    const response = await fetch(docUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'WorldView-OSINT/1.0' }
    });

    if (!response.ok) {
      console.error('[PROXY] GDELT error:', response.status);
      throw new Error(`GDELT error: ${response.status}`);
    }

    const data = await response.json();

    if (data.articles && data.articles.length > 0) {
      const articles = data.articles.slice(0, 30).map((article: any) => ({
        url: article.url,
        title: article.title,
        source: article.domain,
        pubDate: article.seendate,
        language: article.language,
        socialimage: article.socialimage,
        lat: article.sourcecountry ? getCountryLat(article.sourcecountry) : null,
        lon: article.sourcecountry ? getCountryLon(article.sourcecountry) : null
      }));
      console.log('[PROXY] GDELT returned', articles.length, 'articles');
      res.json({ articles, timestamp: Date.now(), total: articles.length, source: 'gdelt' });
    } else {
      console.log('[PROXY] GDELT returned no articles, using fallback');
      res.json({ articles: fallbackArticles, timestamp: Date.now(), total: fallbackArticles.length, source: 'fallback' });
    }
  } catch (error) {
    console.error('[PROXY] News error, using fallback:', error.message);
    res.json({ articles: fallbackArticles, timestamp: Date.now(), total: fallbackArticles.length, source: 'fallback' });
  }
});

function getCountryLat(country: string): number {
  const coords: Record<string, number> = { US: 38, UK: 52, CN: 35, RU: 55, DE: 51, FR: 46, JP: 36, KR: 37, IN: 20, AU: -25, BR: -15, CA: 56, MX: 23, ID: -5, SA: 25, AE: 24, GB: 52, NL: 52, CH: 47, SE: 62, NO: 62, SG: 1, NZ: -41, IL: 31, TH: 15, VN: 16, PH: 13, MY: 4, PK: 30, BD: 24, EG: 26, NG: 10, KE: 1, ZA: -30, CO: 4, AR: -36, CL: -33, PE: -10, PL: 52, TR: 39, CZ: 50, HU: 47, RO: 46, UA: 49, GR: 39, PT: 39 };
  return coords[country] || 0;
}

function getCountryLon(country: string): number {
  const coords: Record<string, number> = { US: -97, UK: 0, CN: 105, RU: 37, DE: 10, FR: 2, JP: 138, KR: 128, IN: 78, AU: 134, BR: -52, CA: -106, MX: -102, ID: 120, SA: 45, AE: 54, GB: 0, NL: 5, CH: 8, SE: 15, NO: 10, SG: 104, NZ: 175, IL: 35, TH: 101, VN: 108, PH: 122, MY: 102, PK: 70, BD: 90, EG: 30, NG: 8, KE: 37, ZA: 25, CO: -72, AR: -64, CL: -71, PE: -76, PL: 20, TR: 35, CZ: 15, HU: 20, RO: 25, UA: 32, GR: 22, PT: -8 };
  return coords[country] || 0;
}

// Country Intelligence Index - Risk scores
app.get('/api/intelligence/index', async (_req, res) => {
try {
const riskData = {
'US': { score: 25, category: 'political', trend: 'stable', factors: ['elections', 'trade'] },
'RU': { score: 72, category: 'military', trend: 'increasing', factors: ['ukraine', 'sanctions'] },
'CN': { score: 45, category: 'economic', trend: 'stable', factors: ['taiwan', 'trade'] },
'IR': { score: 68, category: 'military', trend: 'increasing', factors: ['nuclear', 'proxy'] },
'KP': { score: 85, category: 'military', trend: 'increasing', factors: ['missiles', 'nuclear'] },
'SY': { score: 92, category: 'conflict', trend: 'active', factors: ['civilwar', 'terrorism'] },
'YE': { score: 88, category: 'conflict', trend: 'active', factors: ['war', 'humanitarian'] },
'UA': { score: 78, category: 'conflict', trend: 'active', factors: ['war', 'invasion'] },
'AF': { score: 82, category: 'conflict', trend: 'active', factors: ['terrorism', 'instability'] },
'IQ': { score: 55, category: 'political', trend: 'decreasing', factors: ['stability', 'security'] },
'VE': { score: 75, category: 'economic', trend: 'increasing', factors: ['sanctions', 'inflation'] },
'ZW': { score: 65, category: 'political', trend: 'stable', factors: ['economy', 'governance'] },
'SD': { score: 80, category: 'conflict', trend: 'active', factors: ['war', 'humanitarian'] },
'LY': { score: 78, category: 'conflict', trend: 'stable', factors: ['civilwar', 'oil'] },
'SO': { score: 72, category: 'conflict', trend: 'decreasing', factors: ['famine', 'terrorism'] },
'MM': { score: 58, category: 'political', trend: 'stable', factors: ['coup', 'crackdown'] },
'BY': { score: 62, category: 'political', trend: 'stable', factors: ['russia-alliance', 'repression'] },
'VN': { score: 35, category: 'economic', trend: 'increasing', factors: ['disputes', 'growth'] },
'SA': { score: 42, category: 'political', trend: 'stable', factors: ['reform', 'regional'] },
'IL': { score: 58, category: 'military', trend: 'increasing', factors: ['gaza', 'iran'] },
'PK': { score: 65, category: 'political', trend: 'stable', factors: ['terrorism', 'economy'] },
'IN': { score: 38, category: 'political', trend: 'stable', factors: ['border', 'growth'] },
'BR': { score: 32, category: 'political', trend: 'stable', factors: ['politics', 'economy'] },
'ZA': { score: 48, category: 'political', trend: 'stable', factors: ['crime', 'economy'] },
'NG': { score: 52, category: 'economic', trend: 'stable', factors: ['oil', 'instability'] },
'EG': { score: 45, category: 'political', trend: 'stable', factors: ['economy', 'authoritarian'] },
'TR': { score: 48, category: 'political', trend: 'increasing', factors: ['economy', 'regional'] },
};
res.json({ data: riskData, timestamp: Date.now() });
} catch (error) {
res.status(503).json({ error: 'Intelligence data unavailable' });
}
});

app.get('/api/finance/radar', async (_req, res) => {
try {
const financeData = {
indices: [
{ symbol: 'SPX', name: 'S&P 500', price: 5234.18, change: 0.85, country: 'US' },
{ symbol: 'NDX', name: 'NASDAQ', price: 18432.75, change: 1.12, country: 'US' },
{ symbol: 'DJI', name: 'Dow Jones', price: 39127.14, change: 0.42, country: 'US' },
{ symbol: 'FTSE', name: 'FTSE 100', price: 8473.32, change: -0.15, country: 'GB' },
{ symbol: 'DAX', name: 'DAX', price: 18583.52, change: 0.68, country: 'DE' },
{ symbol: 'N225', name: 'Nikkei', price: 40815.66, change: -0.25, country: 'JP' },
{ symbol: 'HSI', name: 'Hang Seng', price: 18428.94, change: 1.35, country: 'HK' },
{ symbol: 'SSEC', name: 'Shanghai', price: 3168.52, change: -0.52, country: 'CN' },
{ symbol: 'BVS', name: 'Bovespa', price: 128372.45, change: 0.28, country: 'BR' },
{ symbol: 'MXX', name: 'IPC Mexico', price: 57123.87, change: -0.08, country: 'MX' },
],
crypto: [
{ symbol: 'BTC', name: 'Bitcoin', price: 67342.50, change: 2.34, currency: 'USD' },
{ symbol: 'ETH', name: 'Ethereum', price: 3421.87, change: 1.85, currency: 'USD' },
{ symbol: 'SOL', name: 'Solana', price: 142.35, change: 4.12, currency: 'USD' },
{ symbol: 'BNB', name: 'BNB', price: 582.45, change: 0.95, currency: 'USD' },
{ symbol: 'XRP', name: 'XRP', price: 0.5234, change: -0.45, currency: 'USD' },
{ symbol: 'ADA', name: 'Cardano', price: 0.4523, change: 1.23, currency: 'USD' },
],
commodities: [
{ symbol: 'GOLD', name: 'Gold', price: 2342.50, change: 0.85, unit: 'oz' },
{ symbol: 'SILVER', name: 'Silver', price: 27.85, change: 1.25, unit: 'oz' },
{ symbol: 'OIL', name: 'Crude Oil', price: 85.42, change: -0.65, unit: 'bbl' },
{ symbol: 'NGAS', name: 'Natural Gas', price: 2.85, change: 2.15, unit: 'mmBtu' },
{ symbol: 'WHEAT', name: 'Wheat', price: 6.25, change: -0.32, unit: 'bu' },
{ symbol: 'CORN', name: 'Corn', price: 4.58, change: 0.45, unit: 'bu' },
{ symbol: 'COPPER', name: 'Copper', price: 4.25, change: 1.15, unit: 'lb' },
{ symbol: 'ALUM', name: 'Aluminum', price: 2580.00, change: 0.75, unit: 'mt' },
],
currencies: [
{ symbol: 'EURUSD', name: 'EUR/USD', price: 1.0852, change: 0.12 },
{ symbol: 'USDJPY', name: 'USD/JPY', price: 154.25, change: -0.08 },
{ symbol: 'GBPUSD', name: 'GBP/USD', price: 1.2634, change: 0.15 },
{ symbol: 'USDCNY', name: 'USD/CNY', price: 7.2458, change: -0.05 },
{ symbol: 'USDCHF', name: 'USD/CHF', price: 0.8832, change: 0.08 },
],
markets: [
{ region: 'North America', status: 'open', nextClose: '16:00 EST' },
{ region: 'Europe', status: 'open', nextClose: '17:30 CET' },
{ region: 'Asia', status: 'closed', nextOpen: '09:30 JST' },
{ region: 'Crypto', status: 'open', nextClose: '24:00' },
]
};
res.json({ data: financeData, timestamp: Date.now() });
} catch (error) {
res.status(503).json({ error: 'Finance data unavailable' });
}
});

// Weather layer
app.get('/api/weather', async (_req, res) => {
try {
const weatherData = {
storms: [
{ id: 'ST-001', name: 'Typhoon EWINIAR', lat: 18.5, lon: 132.5, category: ' typhoon', wind: 145, pressure: 920, movement: 'NW 12km/h' },
{ id: 'ST-002', name: 'Hurricane BERYL', lat: 14.2, lon: -62.5, category: ' hurricane', wind: 165, pressure: 940, movement: 'WNW 18km/h' },
{ id: 'ST-003', name: 'Storm KYARR', lat: 15.8, lon: 72.3, category: ' cyclon', wind: 120, pressure: 970, movement: 'N 8km/h' },
],
precipitation: [
{ lat: 45.0, lon: -120.0, intensity: 85, type: 'rain' },
{ lat: 60.0, lon: -10.0, intensity: 72, type: 'rain' },
{ lat: -10.0, lon: -60.0, intensity: 95, type: 'rain' },
{ lat: 30.0, lon: 100.0, intensity: 68, type: 'snow' },
],
temperature: [
{ lat: 40.0, lon: -100.0, temp: 28, unit: 'C' },
{ lat: 35.0, lon: -95.0, temp: 32, unit: 'C' },
{ lat: 55.0, lon: -120.0, temp: 18, unit: 'C' },
{ lat: 30.0, lon: -80.0, temp: 30, unit: 'C' },
{ lat: 45.0, lon: 0.0, temp: 22, unit: 'C' },
{ lat: 50.0, lon: 10.0, temp: 18, unit: 'C' },
{ lat: 35.0, lon: 120.0, temp: 26, unit: 'C' },
{ lat: -33.0, lon: 151.0, temp: 15, unit: 'C' },
],
alerts: [
{ id: 'ALERT-001', region: 'South China Sea', type: 'typhoon', severity: 'red', message: 'Typhoon Warning - Coastal areas should prepare' },
{ id: 'ALERT-002', region: 'Caribbean', type: 'hurricane', severity: 'orange', message: 'Hurricane Watch - Monitor conditions' },
{ id: 'ALERT-003', region: 'Central Europe', type: 'flood', severity: 'yellow', message: 'Flood Warning - Heavy rainfall expected' },
]
};
res.json({ data: weatherData, timestamp: Date.now() });
} catch (error) {
res.status(503).json({ error: 'Weather data unavailable' });
}
});

// Enhanced news with categories
app.get('/api/news/categories', async (req, res) => {
try {
const categories = req.query.categories as string || 'military,political,economic,disaster,energy';
const catList = categories.split(',');

const categoryData: Record<string, any[]> = {};

const allArticles = [
{ category: 'military', title: 'Russia-Ukraine: Continued Drone Attacks Along Front Lines', source: 'Reuters', country: 'UA,RU' },
{ category: 'military', title: 'China Conducts Naval Drills in South China Sea', source: 'AP', country: 'CN' },
{ category: 'political', title: 'US Election Updates: Primary Results Coming In', source: 'CNN', country: 'US' },
{ category: 'political', title: 'EU Announces New Sanctions on Russia', source: 'BBC', country: 'EU,RU' },
{ category: 'economic', title: 'Global Markets Rally on Positive Economic Data', source: 'Bloomberg', country: 'GLOBAL' },
{ category: 'economic', title: 'Oil Prices Surge Amid Middle East Tensions', source: 'CNBC', country: 'GLOBAL' },
{ category: 'disaster', title: 'Earthquake Strikes Off Coast of Japan', source: 'NHK', country: 'JP' },
{ category: 'disaster', title: 'Flooding in Brazil Claims Dozens of Lives', source: 'Al Jazeera', country: 'BR' },
{ category: 'energy', title: 'Nuclear Energy Expansion Plans Announced in Europe', source: 'Euronews', country: 'EU' },
{ category: 'energy', title: 'Solar Power Investment Reaches Record High', source: 'Reuters', country: 'GLOBAL' },
{ category: 'cyber', title: 'Major Ransomware Attack Targets Financial Institutions', source: 'Wired', country: 'GLOBAL' },
{ category: 'cyber', title: 'Critical Infrastructure Under Cyber Attack in US', source: 'NYT', country: 'US' },
];

for (const cat of catList) {
categoryData[cat] = allArticles.filter(a => a.category === cat).map(a => ({
...a,
pubDate: new Date().toISOString(),
url: `https://example.com/${a.category}/${Date.now()}`
}));
}

res.json({ data: categoryData, timestamp: Date.now() });
} catch (error) {
res.status(503).json({ error: 'News categories unavailable' });
}
});

// Infrastructure & Cyber monitoring
app.get('/api/infrastructure', async (_req, res) => {
try {
const infraData = {
submarineCables: [
{ name: 'SEA-ME-WE 4', path: [[35, 10], [30, 30], [10, 50], [1, 100], [13, 101]] },
{ name: 'Pacific Connect', path: [[35, -120], [30, -140], [25, -160], [20, -170]] },
{ name: 'Atlantic-1', path: [[40, -70], [45, -40], [50, -10], [50, 10]] },
],
internetOutages: [
{ lat: 45.5, lon: -75.5, region: 'Ottawa, Canada', severity: 'major', duration: '2h' },
{ lat: 51.5, lon: -0.1, region: 'London, UK', severity: 'minor', duration: '30m' },
],
powerPlants: [
{ lat: 40.4, lon: -74.5, name: 'Indian Point Energy Center', type: 'nuclear', capacity: 2000, status: 'active' },
{ lat: 35.4, lon: -85.0, name: 'Watts Bar Nuclear Plant', type: 'nuclear', capacity: 1100, status: 'active' },
{ lat: 51.4, lon: -0.3, name: 'Drax Power Station', type: 'biomass', capacity: 2595, status: 'active' },
{ lat: 55.9, lon: -3.4, name: 'Torness Power Station', type: 'nuclear', capacity: 1180, status: 'active' },
{ lat: 38.9, lon: -77.0, name: 'Dominion Energy', type: 'natural_gas', capacity: 4500, status: 'active' },
{ lat: 22.3, lon: 114.2, name: 'Castle Peak Power Station', type: 'coal', capacity: 4100, status: 'active' },
{ lat: 31.2, lon: 121.5, name: 'Waigaoqiao Power Plant', type: 'coal', capacity: 5000, status: 'active' },
],
datacenters: [
{ lat: 37.4, lon: -122.2, name: 'Silicon Valley Data Hub', status: 'operational' },
{ lat: 51.5, lon: -0.1, name: 'London Data Centre', status: 'operational' },
{ lat: 35.7, lon: 139.7, name: 'Tokyo Data Centre', status: 'operational' },
{ lat: 33.9, lon: 118.4, name: 'LAX Data Hub', status: 'operational' },
],
airports: [
{ iata: 'JFK', name: 'John F Kennedy International', lat: 40.64, lon: -73.78, status: 'operational', traffic: 'high' },
{ iata: 'LHR', name: 'London Heathrow', lat: 51.47, lon: -0.45, status: 'operational', traffic: 'high' },
{ iata: 'DXB', name: 'Dubai International', lat: 25.25, lon: 55.36, status: 'operational', traffic: 'high' },
{ iata: 'SIN', name: 'Singapore Changi', lat: 1.36, lon: 103.99, status: 'operational', traffic: 'high' },
]
};
res.json({ data: infraData, timestamp: Date.now() });
} catch (error) {
res.status(503).json({ error: 'Infrastructure data unavailable' });
}
});

app.get('/api/country/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const countryData: Record<string, any> = {
'TW': {
name: 'Taiwan',
capital: 'Taipei',
population: '23.8M',
gdp: '$789B',
riskScore: 35,
summary: 'Taiwan is a leading semiconductor manufacturer and global tech hub. Cross-strait tensions with China continue to be a major geopolitical concern.',
news: ['TSMC expands advanced chip production', 'Military exercises near Taiwan Strait', 'Trade negotiations with US advance'],
youtubeCameras: [
  'https://www.youtube.com/embed/live_stream?channel=UC4aEGX9Kj9Z5vSjG-Zoom4bw',
  'https://www.youtube.com/embed/live_stream?channel=UCnAJBlqr2L3X4_5x6-2Z4WA'
],
liveCameraUrl: 'https://tw.live/en/'
    },
'US': {
name: 'United States',
capital: 'Washington D.C.',
population: '331M',
gdp: '$25.5T',
riskScore: 25,
summary: 'The United States remains the world\'s largest economy with significant geopolitical influence. Recent developments include ongoing trade tensions with China, domestic political polarization, and technological leadership in AI and semiconductors.',
news: ['US announces new AI safety guidelines', 'Tech sector sees record growth', 'Infrastructure bill passes Senate'],
youtubeCameras: [
  'https://www.youtube.com/live/a5s7uAjTJWE',
  'https://www.youtube.com/embed/up9rwMpnfeA'
],
liveCameraUrl: 'https://www.511.org/'
    },
    'CN': {
      name: 'China',
      capital: 'Beijing',
      population: '1.4B',
      gdp: '$18.3T',
      riskScore: 45,
      summary: 'China continues its rise as a global superpower with significant economic and military expansion. Key developments include the Belt and Road Initiative, Taiwan tensions, and technological self-sufficiency drives.',
      news: ['China launches new space station module', 'Tech regulations tighten', 'Economic growth slows'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.weibo.com/livestream'
    },
    'RU': {
      name: 'Russia',
      capital: 'Moscow',
      population: '144M',
      gdp: '$1.8T',
      riskScore: 72,
      summary: 'Russia faces significant international isolation due to ongoing conflict in Ukraine. Economic sanctions continue to impact growth, while military operations remain active.',
      news: ['Sanctions impact deepens', 'Military operations continue', 'Energy exports shift to Asia'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.sputniknews.com/livecams/'
    },
    'JP': {
      name: 'Japan',
      capital: 'Tokyo',
      population: '125M',
      gdp: '$4.2T',
      riskScore: 28,
      summary: 'Japan maintains economic stability while facing demographic challenges. Key developments include defense policy shifts and technological innovation in robotics and AI.',
      news: ['Japan announces defense budget increase', 'Robotics exports hit record', 'Population decline continues'],
youtubeCameras: [
  'https://www.youtube.com/embed/6S4qvf97cbQ',
  'https://www.youtube.com/embed/GxsxupmSGr0'
],
liveCameraUrl: 'https://www.jartic.or.jp/live/'
    },
    'DE': {
      name: 'Germany',
      capital: 'Berlin',
      population: '83M',
      gdp: '$4.1T',
      riskScore: 22,
      summary: 'Germany leads European economic stability while navigating energy transition away from Russian gas. Key developments include industrial modernization and EU leadership.',
      news: ['Germany accelerates renewable energy', 'Industrial output stabilizes', 'EU leadership role expands'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.verkehrsinfo.de/'
    },
'GB': {
name: 'United Kingdom',
capital: 'London',
population: '67M',
gdp: '$3.1T',
riskScore: 30,
summary: 'The UK navigates post-Brexit economic adjustments while maintaining global financial influence. Key developments include AI safety initiatives and defense modernization.',
news: ['UK announces AI Safety Summit', 'Financial sector grows', 'Trade deals expand'],
youtubeCameras: [
  'https://www.youtube.com/embed/M3EYAY2MftI',
  'https://www.youtube.com/live/1unxPB7lNN8'
],
liveCameraUrl: 'https://www.trafficengland.com/'
    },
    'KR': {
      name: 'South Korea',
      capital: 'Seoul',
      population: '51.7M',
      gdp: '$1.7T',
      riskScore: 32,
      summary: 'South Korea is a major technology powerhouse with leading semiconductor and automotive industries. Key developments include chip manufacturing expansion and diplomatic outreach to Japan.',
      news: ['Samsung announces new chip factory', 'EV exports surge', 'Population decline prompts policy changes'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.roadplus.co.kr/'
    },
    'IN': {
      name: 'India',
      capital: 'New Delhi',
      population: '1.4B',
      gdp: '$3.7T',
      riskScore: 40,
      summary: 'India emerges as a global manufacturing hub with rapid economic growth. Key developments include infrastructure investments, tech talent growth, and diplomatic balancing between major powers.',
      news: ['India launches digital infrastructure push', 'Manufacturing sector grows', 'Space program advances'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.moneycontrol.com/news/business/'
    },
'AU': {
name: 'Australia',
capital: 'Canberra',
population: '26M',
gdp: '$1.7T',
riskScore: 20,
summary: 'Australia maintains strong economic ties with Asia-Pacific while diversifying energy exports. Key developments include critical minerals strategy and defense modernization.',
news: ['Critical minerals export deals surge', 'Renewable energy investment increases', 'Defense ties with US strengthen'],
youtubeCameras: [
  'https://www.youtube.com/watch?v=up9rwMpnfeA'
],
liveCameraUrl: 'https://straya.io/'
    },
'FR': {
name: 'France',
capital: 'Paris',
population: '68M',
gdp: '$2.9T',
riskScore: 24,
summary: 'France leads European industrial and defense capabilities. Key developments include nuclear energy expansion and EU strategic autonomy initiatives.',
news: ['Nuclear energy expansion announced', 'EU defense initiatives advance', 'Economic reforms proceed'],
youtubeCameras: [
  'https://www.youtube.com/channel/UC39efYOGqU9xZtcG5meD7ZQ/featured'
],
liveCameraUrl: 'https://www.bison-fute.gouv.fr/'
    },
    'IT': {
      name: 'Italy',
      capital: 'Rome',
      population: '59M',
      gdp: '$2.1T',
      riskScore: 35,
      summary: 'Italy navigates economic recovery while managing political instability. Key developments include manufacturing strength and Mediterranean diplomatic leadership.',
      news: ['Industrial output grows', 'Tourism sector rebounds', 'EU relations stabilize'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.autostrade.it/en/autostrade-it'
    },
    'ES': {
      name: 'Spain',
      capital: 'Madrid',
      population: '47M',
      gdp: '$1.4T',
      riskScore: 30,
      summary: 'Spain benefits from tourism recovery and renewable energy leadership. Key developments include infrastructure investment and European integration.',
      news: ['Tourism hits record levels', 'Solar energy expands', 'Infrastructure investment grows'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.dgt.es/'
    },
    'BR': {
      name: 'Brazil',
      capital: 'Brasilia',
      population: '215M',
      gdp: '$2.1T',
      riskScore: 42,
      summary: 'Brazil is a regional economic leader with significant agricultural and energy resources. Key developments include Amazon conservation efforts and trade diversification.',
      news: ['Agricultural exports surge', 'Amazon protection expands', 'Tech sector grows'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.dnit.gov.br/'
    },
    'CA': {
      name: 'Canada',
      capital: 'Ottawa',
      population: '38M',
      gdp: '$2.1T',
      riskScore: 18,
      summary: 'Canada maintains strong ties with allies while developing natural resources. Key developments include critical minerals strategy and climate policy.',
      news: ['Critical minerals investment surges', 'Climate policy advances', 'Trade ties strengthen'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.511ontario.ca/'
    },
    'MX': {
      name: 'Mexico',
      capital: 'Mexico City',
      population: '128M',
      gdp: '$1.3T',
      riskScore: 45,
      summary: 'Mexico benefits from nearshoring trends and manufacturing growth. Key developments include trade integration with US and infrastructure modernization.',
      news: ['Manufacturing investment surges', 'Infrastructure projects advance', 'Energy sector reforms proceed'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.fcm.mx/'
    },
    'ID': {
      name: 'Indonesia',
      capital: 'Jakarta',
      population: '275M',
      gdp: '$1.3T',
      riskScore: 48,
      summary: 'Indonesia is a rising economic power in Southeast Asia with abundant natural resources. Key developments include infrastructure investment and EV supply chain positioning.',
      news: ['NIK grows record high', 'EV supply chain investment', 'Infrastructure spending continues'],
      youtubeCameras: ['https://www.youtube.com/embed/5R3kT7nQ0pA'],
      liveCameraUrl: 'https://www.jakarta-tourism.com/'
    },
    'SA': {
      name: 'Saudi Arabia',
      capital: 'Riyadh',
      population: '35M',
      gdp: '$1.1T',
      riskScore: 52,
      summary: 'Saudi Arabia pursues Vision 2030 diversification away from oil. Key developments include mega-projects and regional diplomatic leadership.',
      news: ['Vision 2030 projects advance', 'Oil production stabilizes', 'Regional diplomacy active'],
      youtubeCameras: ['https://www.youtube.com/embed/8R4kT6nM0oA'],
      liveCameraUrl: 'https://www.moro.gov.sa/'
    },
    'AE': {
      name: 'UAE',
      capital: 'Abu Dhabi',
      population: '10M',
      gdp: '$499B',
      riskScore: 28,
      summary: 'The UAE continues economic diversification with strategic investments in tech and logistics. Key developments include COP28 hosting and trade hub expansion.',
      news: ['Tech investment surges', 'Trade volumes grow', 'Tourism sector rebounds'],
      youtubeCameras: ['https://www.youtube.com/embed/4R5kT7pN0nA'],
liveCameraUrl: 'https://www.tcra.gov.ae/'
},
'NL': {
      name: 'Netherlands',
      capital: 'Amsterdam',
      population: '17M',
      gdp: '$991B',
      riskScore: 22,
      summary: 'The Netherlands is a European economic hub with strong logistics and technology sectors. Key developments include ASML leadership in semiconductor equipment.',
      news: ['ASML expands capacity', 'Port throughput grows', 'Green energy investment increases'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.anwb.nl/'
    },
    'CH': {
      name: 'Switzerland',
      capital: 'Bern',
      population: '8.7M',
      gdp: '$818B',
      riskScore: 15,
      summary: 'Switzerland maintains financial stability and neutrality. Key developments include banking sector adaptation and technology sector growth.',
      news: ['Banking sector evolves', 'Tech startups grow', 'Trade agreements update'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.astra.admin.ch/'
    },
    'SE': {
      name: 'Sweden',
      capital: 'Stockholm',
      population: '10.4M',
      gdp: '$585B',
      riskScore: 18,
      summary: 'Sweden is a Nordic innovation hub with strong social welfare. Key developments include green energy leadership and defense cooperation.',
      news: ['Green energy expands', 'Defense cooperation increases', 'Tech exports grow'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.trafikverket.se/'
    },
    'NO': {
      name: 'Norway',
      capital: 'Oslo',
      population: '5.4M',
      gdp: '$541B',
      riskScore: 15,
      summary: 'Norway benefits from energy exports and sovereign wealth management. Key developments include green transition leadership and Arctic diplomacy.',
      news: ['Oil fund invests in renewables', 'Green hydrogen expands', 'Arctic council engagement'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://www.vegvesen.no/'
    },
    'SG': {
      name: 'Singapore',
      capital: 'Singapore',
      population: '5.9M',
      gdp: '$397B',
      riskScore: 20,
      summary: 'Singapore is a global financial hub and Asian business center. Key developments include fintech growth and supply chain resilience.',
      news: ['Fintech sector grows', 'Supply chain hub expands', 'Economic ties strengthen'],
youtubeCameras: ['https://www.youtube.com/live/a5s7uAjTJWE'],
liveCameraUrl: 'https://onemotoring.lta.gov.sg/content/onemotoring/home/digitalservices/view-traffic-cameras.html'
    },
    'NZ': {
      name: 'New Zealand',
      capital: 'Wellington',
      population: '5.1M',
      gdp: '$252B',
      riskScore: 15,
      summary: 'New Zealand balances agricultural exports with environmental policy. Key developments include trade diversification and climate action.',
      news: ['Agricultural exports grow', 'Climate policy advances', 'Trade ties expand'],
      youtubeCameras: ['https://www.youtube.com/embed/1R5kT3TP0jA'],
      liveCameraUrl: 'https://www.journeys.nzta.govt.nz/'
    },
    'IL': {
      name: 'Israel',
      capital: 'Jerusalem',
      population: '9.3M',
      gdp: '$525B',
      riskScore: 58,
      summary: 'Israel is a tech powerhouse with significant defense capabilities. Key developments include diplomatic normalization and tech sector resilience.',
      news: ['Tech exports grow', 'Diplomatic ties expand', 'Defense capabilities advance'],
      youtubeCameras: ['https://www.youtube.com/embed/2T6kT4UQ0iA'],
      liveCameraUrl: 'https://www.gov.il/'
    },
    'TH': {
      name: 'Thailand',
      capital: 'Bangkok',
      population: '71M',
      gdp: '$574B',
      riskScore: 38,
      summary: 'Thailand is an ASEAN manufacturing hub with strong tourism. Key developments include EV production expansion and infrastructure investment.',
      news: ['EV manufacturing grows', 'Tourism rebounds', 'Infrastructure projects advance'],
      youtubeCameras: ['https://www.youtube.com/embed/3U7kT5VR0hA'],
      liveCameraUrl: 'https://www.thairoads.org/'
    },
    'VN': {
      name: 'Vietnam',
      capital: 'Hanoi',
      population: '97M',
      gdp: '$409B',
      riskScore: 42,
      summary: 'Vietnam is a rising manufacturing hub with young workforce. Key developments include semiconductor supply chain positioning and infrastructure growth.',
      news: ['Manufacturing investment surges', 'Tech sector grows', 'Infrastructure expands'],
      youtubeCameras: ['https://www.youtube.com/embed/4V8kT6WS0gA'],
      liveCameraUrl: 'https://www.cameras.com.vn/'
    },
    'PH': {
      name: 'Philippines',
      capital: 'Manila',
      population: '113M',
      gdp: '$404B',
      riskScore: 48,
      summary: 'The Philippines benefits from service sector growth and demographics. Key developments include BPO expansion and infrastructure investment.',
      news: ['BPO sector grows', 'Infrastructure spending increases', 'Tourism rebounds'],
      youtubeCameras: ['https://www.youtube.com/embed/5W9kT7XT0fA'],
      liveCameraUrl: 'https://www.roadcam.ph/'
    },
    'MY': {
      name: 'Malaysia',
      capital: 'Kuala Lumpur',
      population: '33M',
      gdp: '$406B',
      riskScore: 35,
      summary: 'Malaysia benefits from semiconductor and commodity exports. Key developments include tech manufacturing growth and trade diversification.',
      news: ['Semiconductor investment grows', 'Trade with China diversifies', 'Infrastructure modernizes'],
      youtubeCameras: ['https://www.youtube.com/embed/6X0kT8YU0eA'],
      liveCameraUrl: 'https://www.plus.com.my/'
    },
    'PK': {
      name: 'Pakistan',
      capital: 'Islamabad',
      population: '231M',
      gdp: '$341B',
      riskScore: 65,
      summary: 'Pakistan faces economic challenges while maintaining strategic location. Key developments include IMF program continuation and China trade ties.',
      news: ['IMF program continues', 'China trade grows', 'Energy projects advance'],
      youtubeCameras: ['https://www.youtube.com/embed/7Y1kT9ZV0dA'],
      liveCameraUrl: 'https://www.nha.gov.pk/'
    },
    'BD': {
      name: 'Bangladesh',
      capital: 'Dhaka',
      population: '165M',
      gdp: '$455B',
      riskScore: 52,
      summary: 'Bangladesh is a rising manufacturing hub with RMG exports. Key developments include infrastructure investment and energy sector expansion.',
      news: ['RMG exports grow', 'Power generation increases', 'Infrastructure modernizes'],
      youtubeCameras: ['https://www.youtube.com/embed/8Z2kT0AW0cA'],
      liveCameraUrl: 'https://www.rthd.gov.bd/'
    },
    'EG': {
      name: 'Egypt',
      capital: 'Cairo',
      population: '104M',
      gdp: '$476B',
      riskScore: 55,
      summary: 'Egypt maintains regional influence with Suez Canal strategic value. Key developments include economic reforms and Gulf investment.',
      news: ['Suez traffic grows', 'Reforms advance', 'Gulf investment increases'],
      youtubeCameras: ['https://www.youtube.com/embed/9Z3kT1BX0bA'],
      liveCameraUrl: 'https://www.sca.gov.eg/'
    },
    'NG': {
      name: 'Nigeria',
      capital: 'Abuja',
      population: '211M',
      gdp: '$453B',
      riskScore: 62,
      summary: 'Nigeria is Africa\'s largest economy with oil resources. Key developments include diversification efforts and regional leadership.',
      news: ['Oil production stabilizes', 'Tech sector grows', 'Regional trade expands'],
      youtubeCameras: ['https://www.youtube.com/embed/0A4kT2CY0aA'],
      liveCameraUrl: 'https://www.f Roads.gov.ng/'
    },
    'KE': {
      name: 'Kenya',
      capital: 'Nairobi',
      population: '54M',
      gdp: '$113B',
      riskScore: 55,
      summary: 'Kenya is East Africa\'s economic hub with tech sector growth. Key developments include infrastructure investment and regional trade leadership.',
      news: ['Tech hub expands', 'Infrastructure grows', 'Regional trade increases'],
      youtubeCameras: ['https://www.youtube.com/embed/1B5kT3DZ0Z9'],
      liveCameraUrl: 'https://www.roads.go.ke/'
    },
    'ZA': {
      name: 'South Africa',
      capital: 'Pretoria',
      population: '60M',
      gdp: '$421B',
      riskScore: 52,
      summary: 'South Africa is Africa\'s most industrialized economy. Key developments include energy crisis management and trade with China.',
      news: ['Energy crisis eases', 'China trade grows', 'Mining sector stabilizes'],
      youtubeCameras: ['https://www.youtube.com/embed/2C6kT4EY0Y8'],
      liveCameraUrl: 'https://www.iTraffic.co.za/'
    },
    'CO': {
      name: 'Colombia',
      capital: 'Bogota',
      population: '51M',
      gdp: '$343B',
      riskScore: 48,
      summary: 'Colombia is Latin America\'s steady performer with peace process continuation. Key developments include economic liberalization and regional trade.',
      news: ['Peace process continues', 'Trade agreements expand', 'Infrastructure investment grows'],
      youtubeCameras: ['https://www.youtube.com/embed/3D7kT5FZ0X7'],
      liveCameraUrl: 'https://www.invias.gov.co/'
    },
    'AR': {
      name: 'Argentina',
      capital: 'Buenos Aires',
      population: '46M',
      gdp: '$632B',
      riskScore: 68,
      summary: 'Argentina faces economic volatility with IMF program. Key developments include agricultural exports and regional diplomatic leadership.',
      news: ['Soy exports surge', 'IMF program continues', 'Regional ties strengthen'],
      youtubeCameras: ['https://www.youtube.com/embed/4E8kT6GZ0W6'],
      liveCameraUrl: 'https://www. Roads.gob.ar/'
    },
    'CL': {
      name: 'Chile',
      capital: 'Santiago',
      population: '19M',
      gdp: '$301B',
      riskScore: 35,
      summary: 'Chile is Latin America\'s most stable economy with copper exports. Key developments include lithium strategy and renewable energy leadership.',
      news: ['Copper production grows', 'Lithium strategy advances', 'Renewable energy expands'],
      youtubeCameras: ['https://www.youtube.com/embed/5F9kT7HA0V5'],
      liveCameraUrl: 'https://www.conaset.cl/'
    },
    'PE': {
      name: 'Peru',
      capital: 'Lima',
      population: '33M',
      gdp: '$242B',
      riskScore: 50,
      summary: 'Peru benefits from mining exports and regional trade. Key developments include copper production growth and infrastructure investment.',
      news: ['Mining investment grows', 'Trade with China expands', 'Infrastructure modernizes'],
      youtubeCameras: ['https://www.youtube.com/embed/6G0kT8JB0U4'],
      liveCameraUrl: 'https://www.mtc.gob.pe/'
    },
    'PL': {
      name: 'Poland',
      capital: 'Warsaw',
      population: '38M',
      gdp: '$688B',
      riskScore: 28,
      summary: 'Poland is Central Europe\'s economic leader with EU integration. Key developments include refugee support and defense spending increase.',
      news: ['EU funds flow', 'Defense spending increases', 'Manufacturing grows'],
      youtubeCameras: ['https://www.youtube.com/embed/7H1kT9KC0T3'],
      liveCameraUrl: 'https://www.gddkia.gov.pl/'
    },
    'TR': {
      name: 'Turkey',
      capital: 'Ankara',
      population: '85M',
      gdp: '$905B',
      riskScore: 55,
      summary: 'Turkey bridges Europe and Asia with strategic location. Key developments include NATO cooperation and economic stabilization.',
      news: ['NATO cooperation continues', 'Inflation stabilizes', 'Exports grow'],
      youtubeCameras: ['https://www.youtube.com/embed/8I2kT0LD0S2'],
      liveCameraUrl: 'https://www.kgm.gov.tr/'
    },
    'CZ': {
      name: 'Czech Republic',
      capital: 'Prague',
      population: '10.5M',
      gdp: '$290B',
      riskScore: 25,
      summary: 'Czech Republic is Central Europe\'s manufacturing hub. Key developments include industrial production and EU leadership.',
      news: ['Manufacturing grows', 'EU leadership advances', 'Infrastructure modernizes'],
      youtubeCameras: ['https://www.youtube.com/embed/9J3kT1ME0R1'],
      liveCameraUrl: 'https://www.rsd.cz/'
    },
    'HU': {
      name: 'Hungary',
      capital: 'Budapest',
      population: '9.6M',
      gdp: '$178B',
      riskScore: 42,
      summary: 'Hungary navigates EU relations while maintaining economic growth. Key developments include manufacturing investment and diplomatic balancing.',
      news: ['Manufacturing expands', 'EU tensions continue', 'Trade grows'],
      youtubeCameras: ['https://www.youtube.com/embed/0K4kT2NF0Q0'],
      liveCameraUrl: 'https://www.police.hu/'
    },
    'RO': {
      name: 'Romania',
      capital: 'Bucharest',
      population: '19M',
      gdp: '$284B',
      riskScore: 38,
      summary: 'Romania benefits from EU membership and tech sector growth. Key developments include infrastructure investment and regional security.',
      news: ['Infrastructure improves', 'Tech sector grows', 'NATO presence strengthens'],
      youtubeCameras: ['https://www.youtube.com/embed/1L5kT3OG0P0'],
      liveCameraUrl: 'https://www.cnadnr.ro/'
    },
    'UA': {
      name: 'Ukraine',
      capital: 'Kyiv',
      population: '41M',
      gdp: '$160B',
      riskScore: 88,
      summary: 'Ukraine continues defense against Russian invasion with Western support. Key developments include military aid continuation and reconstruction planning.',
      news: ['Military aid continues', 'Reconstruction plans advance', 'EU candidate status progresses'],
      youtubeCameras: ['https://www.youtube.com/embed/2M6kT4PH0O0'],
      liveCameraUrl: 'https://www.situ.com.ua/'
    },
    'GR': {
      name: 'Greece',
      capital: 'Athens',
      population: '10.4M',
      gdp: '$218B',
      riskScore: 40,
      summary: 'Greece recovered from debt crisis with tourism and reforms. Key developments include economic growth and regional diplomatic leadership.',
      news: ['Tourism surges', 'Reforms continue', 'Regional influence expands'],
      youtubeCameras: ['https://www.youtube.com/embed/3N7kT5QI0N0'],
      liveCameraUrl: 'https://www.roadscameras.gr/'
    },
    'PT': {
      name: 'Portugal',
      capital: 'Lisbon',
      population: '10.3M',
      gdp: '$255B',
      riskScore: 28,
      summary: 'Portugal benefits from EU membership and green transition. Key developments include renewable energy leadership and tourism recovery.',
      news: ['Renewable energy expands', 'Tourism rebounds', 'Tech sector grows'],
      youtubeCameras: ['https://www.youtube.com/embed/4O8kT6JH0M0'],
      liveCameraUrl: 'https://www.stradas.pt/'
    }
  };
  res.json(countryData[code] || {
    name: code,
    capital: 'Unknown',
    population: 'N/A',
    gdp: 'N/A',
    riskScore: 50,
    summary: 'No detailed information available for this country.',
    news: [],
    youtubeCameras: [],
    liveCameraUrl: ''
  });
});

app.get('/api/tech/events', async (_req, res) => {
try {
const events = [
{ name: 'CES 2025', location: 'Las Vegas, USA', date: '2025-01-07', type: 'conference', attendees: 180000 },
{ name: 'Mobile World Congress', location: 'Barcelona, Spain', date: '2025-02-26', type: 'conference', attendees: 100000 },
{ name: 'Google I/O', location: 'Mountain View, USA', date: '2025-05-14', type: 'conference', attendees: 7000 },
{ name: 'WWDC', location: 'Cupertino, USA', date: '2025-06-03', type: 'conference', attendees: 5000 },
{ name: 'AWS re:Invent', location: 'Las Vegas, USA', date: '2025-11-30', type: 'conference', attendees: 65000 },
{ name: 'DEF CON', location: 'Las Vegas, USA', date: '2025-08-07', type: 'security', attendees: 30000 },
{ name: 'Black Hat', location: 'Las Vegas, USA', date: '2025-08-02', type: 'security', attendees: 20000 },
{ name: 'TechCrunch Disrupt', location: 'San Francisco, USA', date: '2025-09-17', type: 'startup', attendees: 10000 },
];
res.json({ events, timestamp: Date.now() });
} catch (error) {
  res.status(503).json({ error: 'Tech events data unavailable' });
}
});

app.get('/api/power-plants', async (_req, res) => {
  try {
    const powerPlants = [
      { name: 'Three Gorges Dam', country: 'CN', lat: 30.823, lon: 111.003, capacity: 22500, fuel: 'hydro', status: 'operating' },
      { name: 'Taichung', country: 'TW', lat: 24.213, lon: 120.493, capacity: 5784, fuel: 'coal', status: 'operating' },
      { name: 'Belchatow', country: 'PL', lat: 51.267, lon: 19.283, capacity: 5298, fuel: 'coal', status: 'operating' },
      { name: 'Vindhyachal', country: 'IN', lat: 24.103, lon: 82.672, capacity: 4760, fuel: 'coal', status: 'operating' },
      { name: 'Tashkent', country: 'UZ', lat: 41.299, lon: 69.240, capacity: 3750, fuel: 'gas', status: 'operating' },
      { name: 'Datang Tuoketuo', country: 'CN', lat: 40.197, lon: 111.360, capacity: 6720, fuel: 'coal', status: 'operating' },
      { name: 'Guodian Beidian', country: 'CN', lat: 39.904, lon: 116.416, capacity: 6240, fuel: 'coal', status: 'operating' },
      { name: 'Gorakhpur', country: 'IN', lat: 29.448, lon: 75.405, capacity: 2976, gas: 'gas', status: 'operating' },
      { name: 'Rihand', country: 'IN', lat: 24.752, lon: 83.045, capacity: 3000, fuel: 'coal', status: 'operating' },
      { name: 'Sasan', country: 'IN', lat: 24.431, lon: 82.656, capacity: 3960, fuel: 'coal', status: 'operating' },
      { name: 'Mundra', country: 'IN', lat: 22.837, lon: 69.722, capacity: 4150, fuel: 'coal', status: 'operating' },
      { name: 'Jamalpur', country: 'IN', lat: 26.303, lon: 86.485, capacity: 2490, fuel: 'coal', status: 'operating' },
      { name: 'Ukai', country: 'IN', lat: 21.246, lon: 73.562, capacity: 1350, fuel: 'hydro', status: 'operating' },
      { name: 'Chandrapur', country: 'IN', lat: 19.958, lon: 79.335, capacity: 2340, fuel: 'coal', status: 'operating' },
      { name: 'Bhadra', country: 'IN', lat: 13.544, lon: 75.600, capacity: 240, fuel: 'hydro', status: 'operating' },
      { name: 'Kahalgaon', country: 'IN', lat: 25.263, lon: 87.524, capacity: 2340, fuel: 'coal', status: 'operating' },
      { name: 'Kawai', country: 'IN', lat: 24.990, lon: 75.550, capacity: 1320, fuel: 'coal', status: 'operating' },
      { name: 'Simhadri', country: 'IN', lat: 17.683, lon: 82.617, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Talwandi Sabo', country: 'IN', lat: 29.917, lon: 75.050, capacity: 1980, fuel: 'coal', status: 'operating' },
      { name: 'Jharsuguda', country: 'IN', lat: 21.857, lon: 84.017, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Lanco Amarkantak', country: 'IN', lat: 22.667, lon: 81.733, capacity: 1260, fuel: 'coal', status: 'operating' },
      { name: 'Grand Coulee Dam', country: 'US', lat: 47.933, lon: -119.000, capacity: 6809, fuel: 'hydro', status: 'operating' },
      { name: 'Palo Verde', country: 'US', lat: 33.388, lon: -112.987, capacity: 3937, fuel: 'nuclear', status: 'operating' },
      { name: 'Browns Ferry', country: 'US', lat: 34.702, lon: -87.118, capacity: 3568, fuel: 'nuclear', status: 'operating' },
      { name: 'W. A. Parish', country: 'US', lat: 29.307, lon: -95.540, capacity: 4008, fuel: 'gas', status: 'operating' },
      { name: 'Moss Landing', country: 'US', lat: 36.767, lon: -121.783, capacity: 3040, fuel: 'gas', status: 'operating' },
      { name: 'Robert Moses Niagara', country: 'US', lat: 43.078, lon: -79.024, capacity: 2439, fuel: 'hydro', status: 'operating' },
      { name: 'Prescott', country: 'US', lat: 31.946, lon: -109.489, capacity: 1545, fuel: 'nuclear', status: 'operating' },
      { name: 'Crystal River', country: 'US', lat: 28.956, lon: -82.699, capacity: 3326, fuel: 'gas', status: 'operating' },
      { name: 'Labadie', country: 'US', lat: 38.528, lon: -90.844, capacity: 2389, fuel: 'coal', status: 'operating' },
      { name: 'Thomas Hill', country: 'US', lat: 39.367, lon: -92.583, capacity: 1200, fuel: 'coal', status: 'operating' },
      { name: 'New Madrid', country: 'US', lat: 36.517, lon: -89.517, capacity: 1160, fuel: 'coal', status: 'operating' },
      { name: 'Joppa', country: 'US', lat: 37.083, lon: -88.867, capacity: 1000, fuel: 'coal', status: 'operating' },
      { name: 'Canton', country: 'US', lat: 40.450, lon: -81.367, capacity: 720, fuel: 'coal', status: 'operating' },
      { name: 'Gavin', country: 'US', lat: 38.750, lon: -82.133, capacity: 2600, fuel: 'coal', status: 'operating' },
      { name: 'Clifty Creek', country: 'US', lat: 39.067, lon: -85.117, capacity: 1302, fuel: 'coal', status: 'operating' },
      { name: 'Zimmer', country: 'US', lat: 38.917, lon: -84.333, capacity: 1400, fuel: 'coal', status: 'operating' },
      { name: 'Gibson', country: 'US', lat: 39.017, lon: -87.800, capacity: 1563, fuel: 'coal', status: 'operating' },
      { name: 'Dawn', country: 'US', lat: 40.200, lon: -84.350, capacity: 1400, fuel: 'coal', status: 'operating' },
      { name: 'Loring', country: 'US', lat: 44.950, lon: -68.567, capacity: 1550, fuel: 'oil', status: 'operating' },
      { name: 'Scherger', country: 'US', lat: 32.133, lon: -110.800, capacity: 1240, fuel: 'gas', status: 'operating' },
      { name: 'Murray', country: 'US', lat: 34.367, lon: -84.950, capacity: 1558, fuel: 'coal', status: 'operating' },
      { name: 'Youngs Creek', country: 'US', lat: 33.950, lon: -81.167, capacity: 1300, fuel: 'gas', status: 'operating' },
      { name: 'W. H. Weatherspoon', country: 'US', lat: 34.683, lon: -79.333, capacity: 1100, fuel: 'coal', status: 'operating' },
      { name: 'H. B. Robinson', country: 'US', lat: 34.383, lon: -80.150, capacity: 1170, fuel: 'nuclear', status: 'operating' },
      { name: 'Edwin I. Hatch', country: 'US', lat: 31.933, lon: -82.333, capacity: 1500, fuel: 'nuclear', status: 'operating' },
      { name: 'Vogtle', country: 'US', lat: 33.140, lon: -81.620, capacity: 4536, fuel: 'nuclear', status: 'operating' },
      { name: 'McGuire', country: 'US', lat: 35.433, lon: -80.950, capacity: 2200, fuel: 'nuclear', status: 'operating' },
      { name: 'Catawba', country: 'US', lat: 34.833, lang: -81.017, capacity: 2400, fuel: 'nuclear', status: 'operating' },
      { name: 'Salem', country: 'US', lat: 39.450, lon: -75.533, capacity: 2356, fuel: 'nuclear', status: 'operating' },
      { name: 'Hope Creek', country: 'US', lat: 39.467, lon: -75.517, capacity: 1100, fuel: 'nuclear', status: 'operating' },
      { name: 'Seabrook', country: 'US', lat: 42.900, lon: -70.850, capacity: 1240, fuel: 'nuclear', status: 'operating' },
      { name: 'Fermi', country: 'US', lat: 41.967, lon: -83.267, capacity: 1135, fuel: 'nuclear', status: 'operating' },
      { name: 'Donald C. Cook', country: 'US', lat: 41.983, lon: -86.567, capacity: 2230, fuel: 'nuclear', status: 'operating' },
      { name: 'Davis-Besse', country: 'US', lat: 41.500, lon: -82.650, capacity: 1120, fuel: 'nuclear', status: 'operating' },
      { name: 'Perry', country: 'US', lat: 41.800, lon: -81.133, capacity: 1205, fuel: 'nuclear', status: 'operating' },
      { name: 'Beaver Valley', country: 'US', lat: 40.617, lon: -80.433, capacity: 1852, fuel: 'nuclear', status: 'operating' },
      { name: 'Nine Mile Point', country: 'US', lat: 43.517, lon: -76.400, capacity: 1900, fuel: 'nuclear', status: 'operating' },
      { name: 'R. E. Ginna', country: 'US', lat: 43.283, lon: -77.317, capacity: 500, fuel: 'nuclear', status: 'operating' },
      { name: 'Indian Point', country: 'US', lat: 41.267, lon: -73.950, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Calvert Cliffs', country: 'US', lat: 38.533, lon: -76.433, capacity: 1850, fuel: 'nuclear', status: 'operating' },
      { name: 'Limerick', country: 'US', lat: 40.217, lon: -75.583, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Three Mile Island', country: 'US', lat: 40.150, lon: -76.883, capacity: 908, fuel: 'nuclear', status: 'operating' },
      { name: 'Hatch', country: 'US', lat: 31.933, lon: -82.333, capacity: 1500, fuel: 'nuclear', status: 'operating' },
      { name: 'Vogtle Unit 3', country: 'US', lat: 33.140, lon: -81.620, capacity: 1114, fuel: 'nuclear', status: 'operating' },
      { name: 'Summer', country: 'US', lat: 34.300, lon: -81.317, capacity: 1198, fuel: 'nuclear', status: 'operating' },
      { name: 'Watts Bar', country: 'US', lat: 35.600, lon: -84.788, capacity: 1125, fuel: 'nuclear', status: 'operating' },
      { name: 'Fort Calhoun', country: 'US', lat: 41.517, lon: -96.067, capacity: 500, fuel: 'nuclear', status: 'operating' },
      { name: 'Cooper', country: 'US', lat: 40.350, lon: -95.633, capacity: 478, fuel: 'nuclear', status: 'operating' },
      { name: 'Diablo Canyon', country: 'US', lat: 35.217, lon: -120.850, capacity: 2278, fuel: 'nuclear', status: 'operating' },
      { name: 'Palo Duro', country: 'US', lat: 35.033, lon: -101.700, capacity: 1160, fuel: 'gas', status: 'operating' },
      { name: 'Northeast Texas', country: 'US', lat: 32.750, lon: -94.750, capacity: 1020, fuel: 'gas', status: 'operating' },
      { name: 'New Dublin', country: 'US', lat: 32.717, lon: -96.867, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Enid', country: 'US', lat: 36.400, lon: -97.900, capacity: 450, fuel: 'gas', status: 'operating' },
      { name: 'Riverside', country: 'US', lat: 33.950, lon: -117.400, capacity: 980, fuel: 'gas', status: 'operating' },
      { name: 'Midlothian', country: 'US', lat: 32.483, lon: -96.983, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Wolf Hollow', country: 'US', lat: 32.650, lon: -97.800, capacity: 788, fuel: 'gas', status: 'operating' },
      { name: 'Meyersdale', country: 'US', lat: 39.783, lon: -79.083, capacity: 1100, fuel: 'gas', status: 'operating' },
      { name: 'Carnegie', country: 'US', lat: 40.400, lon: -80.067, capacity: 950, fuel: 'gas', status: 'operating' },
      { name: 'Moxie Freedom', country: 'US', lat: 41.667, lon: -76.417, capacity: 1040, fuel: 'gas', status: 'operating' },
      { name: 'Lackawanna', country: 'US', lat: 41.500, lon: -75.667, capacity: 1479, fuel: 'gas', status: 'operating' },
      { name: 'Bethpage', country: 'US', lat: 40.750, lon: -73.583, capacity: 350, fuel: 'gas', status: 'operating' },
      { name: 'Astoria', country: 'US', lat: 40.783, lon: -73.917, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Gowanus', country: 'US', lat: 40.650, lon: -73.983, capacity: 850, fuel: 'gas', status: 'operating' },
      { name: 'Roseton', country: 'US', lat: 41.533, lon: -74.050, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Danskammer', country: 'US', lat: 41.533, lon: -74.017, capacity: 520, fuel: 'gas', status: 'operating' },
      { name: 'Brockport', country: 'US', lat: 43.217, lon: -77.933, capacity: 650, fuel: 'gas', status: 'operating' },
      { name: 'Somerset', country: 'US', lat: 41.950, lon: -71.133, capacity: 580, fuel: 'gas', status: 'operating' },
      { name: 'Canal', country: 'US', lat: 41.783, lon: -70.500, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Merrimack', country: 'US', lat: 43.150, lon: -71.483, capacity: 480, fuel: 'gas', status: 'operating' },
      { name: 'KeySpan Ravenswood', country: 'US', lat: 40.750, lon: -73.950, capacity: 2500, fuel: 'gas', status: 'operating' },
      { name: 'NRG Norwalk', country: 'US', lat: 41.067, lon: -73.400, capacity: 380, fuel: 'gas', status: 'operating' },
      { name: 'Bridgeport', country: 'US', lat: 41.183, lon: -73.200, capacity: 600, gas: 'gas', status: 'operating' },
      { name: 'Milford', country: 'US', lat: 41.217, lon: -73.067, capacity: 520, fuel: 'gas', status: 'operating' },
      { name: 'Wallace', country: 'US', lat: 34.700, lon: -98.167, capacity: 450, fuel: 'gas', status: 'operating' },
      { name: 'Red Hills', country: 'US', lat: 34.883, lon: -98.283, capacity: 220, fuel: 'gas', status: 'operating' },
      { name: 'Lovett', country: 'US', lat: 41.250, lon: -73.967, capacity: 375, fuel: 'oil', status: 'operating' },
      { name: 'Bowline Point', country: 'US', lat: 41.200, lon: -73.983, capacity: 750, fuel: 'oil', status: 'operating' },
      { name: 'Portland', country: 'US', lat: 40.250, lon: -75.883, fuel: 'oil', status: 'operating', capacity: 350 },
      { name: 'Tosco', country: 'US', lat: 34.067, lon: -117.750, capacity: 720, fuel: 'oil', status: 'operating' },
      { name: 'Milwaukee', country: 'US', lat: 43.017, lon: -87.900, capacity: 450, fuel: 'coal', status: 'operating' },
      { name: 'Oak Creek', country: 'US', lat: 42.700, lon: -87.817, capacity: 1200, fuel: 'coal', status: 'operating' },
      { name: 'Pleasant Prairie', country: 'US', lat: 42.550, lon: -87.933, capacity: 1200, fuel: 'coal', status: 'operating' },
      { name: 'Columbia', country: 'US', lat: 43.533, lon: -89.417, capacity: 1100, fuel: 'coal', status: 'operating' },
      { name: 'Edgewater', country: 'US', lat: 43.583, lon: -87.817, capacity: 400, fuel: 'coal', status: 'operating' },
      { name: 'Blaine', country: 'US', lat: 43.100, lon: -87.800, capacity: 580, fuel: 'coal', status: 'operating' },
      { name: 'J. P. M. J. B', country: 'US', lat: 42.067, lon: -88.067, capacity: 600, fuel: 'coal', status: 'operating' },
      { name: 'Waukegan', country: 'US', lat: 42.367, lon: -87.833, capacity: 700, fuel: 'coal', status: 'operating' },
      { name: 'Crawford', country: 'US', lat: 41.867, lon: -87.650, capacity: 400, fuel: 'coal', status: 'operating' },
      { name: 'Fisk', country: 'US', lat: 41.867, lon: -87.650, capacity: 330, fuel: 'coal', status: 'operating' },
      { name: 'ComEd', country: 'US', lat: 41.883, lon: -87.633, capacity: 350, fuel: 'coal', status: 'operating' },
      { name: 'Peach Bottom', country: 'US', lat: 39.750, lon: -76.267, capacity: 1085, fuel: 'nuclear', status: 'operating' },
      { name: 'Limerick 2', country: 'US', lat: 40.217, lon: -75.583, capacity: 1100, fuel: 'nuclear', status: 'operating' },
      { name: 'Hope Creek', country: 'US', lat: 39.467, lon: -75.517, capacity: 1100, fuel: 'nuclear', status: 'operating' },
      { name: 'Catden', country: 'NL', lat: 51.900, lon: 4.167, capacity: 1400, fuel: 'gas', status: 'operating' },
      { name: 'Cliff', country: 'NL', lat: 51.500, lon: 4.167, capacity: 1300, fuel: 'gas', status: 'operating' },
      { name: 'Maasvlakte', country: 'NL', lat: 51.933, lon: 4.050, capacity: 1070, fuel: 'gas', status: 'operating' },
      { name: 'Eems', country: 'NL', lat: 53.417, lon: 6.833, capacity: 1055, fuel: 'gas', status: 'operating' },
      { name: 'Rotterdam', country: 'NL', lat: 51.917, lon: 4.500, capacity: 790, fuel: 'gas', status: 'operating' },
      { name: 'Borssele', country: 'NL', lat: 51.433, lon: 3.883, capacity: 485, fuel: 'nuclear', status: 'operating' },
      { name: 'Doel', country: 'BE', lat: 51.317, lon: 4.267, capacity: 2963, fuel: 'nuclear', status: 'operating' },
      { name: 'Tihange', country: 'BE', lat: 50.533, lon: 5.267, capacity: 3003, fuel: 'nuclear', status: 'operating' },
      { name: 'Dunkirk', country: 'FR', lat: 51.033, lon: 2.383, capacity: 1035, fuel: 'gas', status: 'operating' },
      { name: 'Cordemais', country: 'FR', lat: 47.300, lon: -1.883, capacity: 2600, fuel: 'coal', status: 'operating' },
      { name: 'Le Havre', country: 'FR', lat: 49.483, lon: 0.133, capacity: 2600, fuel: 'coal', status: 'operating' },
      { name: 'Saint-Avold', country: 'FR', lat: 49.067, lon: 6.800, capacity: 2700, fuel: 'coal', status: 'operating' },
      { name: 'TGV', country: 'FR', lat: 48.717, lon: 2.217, capacity: 500, fuel: 'nuclear', status: 'operating' },
      { name: 'Cattenom', country: 'FR', lat: 49.417, lon: 6.217, capacity: 5200, fuel: 'nuclear', status: 'operating' },
      { name: 'Golfech', country: 'FR', lat: 44.117, lon: 0.850, capacity: 2620, fuel: 'nuclear', status: 'operating' },
      { name: 'Blayais', country: 'FR', lat: 45.400, lon: -0.700, capacity: 3640, fuel: 'nuclear', status: 'operating' },
      { name: 'Cruas', country: 'FR', lat: 44.633, lon: 4.833, capacity: 3660, fuel: 'nuclear', status: 'operating' },
      { name: 'Saint-Laurent', country: 'FR', lat: 47.717, lon: 1.583, capacity: 2780, fuel: 'nuclear', status: 'operating' },
      { name: 'Paluel', country: 'FR', lat: 49.850, lon: 0.633, capacity: 5520, fuel: 'nuclear', status: 'operating' },
      { name: 'Penly', country: 'FR', lat: 49.983, lon: 1.217, capacity: 2760, fuel: 'nuclear', status: 'operating' },
      { name: 'Nogent', country: 'FR', lat: 48.517, lon: 3.517, capacity: 2760, fuel: 'nuclear', status: 'operating' },
      { name: 'Belleville', country: 'FR', lat: 47.517, lon: 2.867, capacity: 2760, fuel: 'nuclear', status: 'operating' },
      { name: 'Chinon', country: 'FR', lat: 47.217, lon: 0.167, capacity: 2760, fuel: 'nuclear', status: 'operating' },
      { name: 'Dampierre', country: 'FR', lat: 47.733, lon: 2.517, capacity: 2760, fuel: 'nuclear', status: 'operating' },
      { name: 'Stazioni', country: 'IT', lat: 41.117, lon: 16.867, capacity: 2640, fuel: 'gas', status: 'operating' },
      { name: 'Turbigo', country: 'IT', lat: 45.533, lon: 8.733, capacity: 1980, fuel: 'gas', status: 'operating' },
      { name: 'Fiume Santo', country: 'IT', lat: 40.800, lon: 8.500, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'La Casella', country: 'IT', lat: 45.167, lon: 9.917, capacity: 1040, fuel: 'gas', status: 'operating' },
      { name: 'Garigliano', country: 'IT', lat: 41.200, lon: 13.783, capacity: 860, fuel: 'gas', status: 'operating' },
      { name: 'Civitavecchia', country: 'IT', lat: 42.100, lon: 11.800, capacity: 1980, fuel: 'gas', status: 'operating' },
      { name: 'Brindisi', country: 'IT', lat: 40.650, lon: 17.933, capacity: 2640, fuel: 'gas', status: 'operating' },
      { name: 'Rossi', country: 'IT', lat: 44.017, lon: 10.200, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Caorso', country: 'IT', lat: 45.017, lon: 9.933, capacity: 900, fuel: 'nuclear', status: 'operating' },
      { name: 'GKN', country: 'IT', lat: 43.800, lon: 10.917, capacity: 1180, fuel: 'gas', status: 'operating' },
      { name: 'Janjice', country: 'RS', lat: 43.950, lon: 21.067, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'Kostolac', country: 'RS', lat: 44.617, lon: 21.200, capacity: 1000, fuel: 'coal', status: 'operating' },
      { name: 'Nicosia', country: 'CY', lat: 35.183, lon: 33.383, capacity: 460, fuel: 'gas', status: 'operating' },
      { name: 'Dhekelia', country: 'CY', lat: 35.050, lon: 33.750, capacity: 440, fuel: 'gas', status: 'operating' },
      { name: 'Vasilikos', country: 'CY', lat: 34.633, lon: 33.033, capacity: 870, fuel: 'gas', status: 'operating' },
      { name: 'Marmara', country: 'TR', lat: 40.967, lon: 29.067, capacity: 2100, fuel: 'gas', status: 'operating' },
      { name: 'Ambarli', country: 'TR', lat: 40.967, lon: 28.650, capacity: 2700, fuel: 'gas', status: 'operating' },
      { name: 'Yenikoy', country: 'TR', lat: 37.500, lon: 28.067, capacity: 420, fuel: 'coal', status: 'operating' },
      { name: 'Seyitomer', country: 'TR', lat: 39.750, lon: 29.950, capacity: 600, fuel: 'coal', status: 'operating' },
      { name: 'Can', country: 'TR', lat: 40.633, lon: 27.017, capacity: 1040, fuel: 'coal', status: 'operating' },
      { name: 'Cayirhan', country: 'TR', lat: 39.467, lon: 32.167, capacity: 640, fuel: 'coal', status: 'operating' },
      { name: 'Akkuyu', country: 'TR', lat: 36.133, lon: 33.533, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Sinop', country: 'TR', lat: 42.017, lon: 35.150, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Haditha', country: 'IQ', lat: 34.200, lon: 42.350, capacity: 1500, fuel: 'gas', status: 'operating' },
      { name: 'Al-Mussaib', country: 'IQ', lat: 32.950, lon: 44.300, capacity: 1260, fuel: 'gas', status: 'operating' },
      { name: 'Hartha', country: 'IQ', lat: 32.600, lon: 44.650, capacity: 1000, fuel: 'gas', status: 'operating' },
      { name: 'Al-Kora', country: 'IQ', lat: 33.300, lon: 44.400, capacity: 720, fuel: 'gas', status: 'operating' },
      { name: 'Shuaiba', country: 'KW', lat: 29.033, lon: 48.150, capacity: 2000, fuel: 'gas', status: 'operating' },
      { name: 'Doha', country: 'KW', lat: 29.367, lon: 47.967, capacity: 2400, fuel: 'gas', status: 'operating' },
      { name: 'Al-Zour', country: 'KW', lat: 28.800, lon: 48.333, capacity: 1500, fuel: 'gas', status: 'operating' },
      { name: 'Sirri', country: 'IR', lat: 26.150, lon: 54.517, capacity: 2000, fuel: 'gas', status: 'operating' },
      { name: 'Lavark', country: 'IR', lat: 27.450, lon: 53.067, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Kish', country: 'IR', lat: 26.500, lon: 53.933, capacity: 500, fuel: 'gas', status: 'operating' },
      { name: 'Assaluyeh', country: 'IR', lat: 27.500, lon: 52.600, capacity: 2800, fuel: 'gas', status: 'operating' },
      { name: 'Bandar Abbas', country: 'IR', lat: 27.183, lon: 56.367, capacity: 3200, fuel: 'gas', status: 'operating' },
      { name: 'Ramsar', country: 'IR', lat: 36.917, lon: 50.650, capacity: 320, fuel: 'gas', status: 'operating' },
      { name: 'Shahriyar', country: 'IR', lat: 35.650, lon: 51.317, capacity: 1300, fuel: 'gas', status: 'operating' },
      { name: 'Daryan', country: 'IR', lat: 31.500, lon: 47.333, capacity: 1000, fuel: 'gas', status: 'operating' },
      { name: 'Karkheh', country: 'IR', lat: 31.800, lon: 48.400, capacity: 1000, fuel: 'hydro', status: 'operating' },
      { name: 'Gotvand', country: 'IR', lat: 32.250, lon: 48.817, capacity: 1000, fuel: 'hydro', status: 'operating' },
      { name: 'Masjed Soleyman', country: 'IR', lat: 32.050, lon: 49.367, capacity: 2000, fuel: 'hydro', status: 'operating' },
      { name: 'Karun', country: 'IR', lat: 31.983, lon: 49.817, capacity: 2000, fuel: 'hydro', status: 'operating' },
      { name: 'Bakhtar', country: 'IR', lat: 34.300, lon: 47.067, capacity: 1000, fuel: 'hydro', status: 'operating' },
      { name: 'Abu Dhabi', country: 'AE', lat: 24.467, lon: 54.367, capacity: 2000, fuel: 'gas', status: 'operating' },
      { name: 'Al Taweelah', country: 'AE', lat: 24.433, lon: 54.517, capacity: 1700, fuel: 'gas', status: 'operating' },
      { name: 'Sham', country: 'AE', lat: 24.250, lon: 54.433, capacity: 1500, fuel: 'gas', status: 'operating' },
      { name: 'Fujairah', country: 'AE', lat: 25.117, lon: 56.333, capacity: 2400, fuel: 'gas', status: 'operating' },
      { name: 'Qatal', country: 'QA', lat: 24.767, lon: 51.583, capacity: 2800, fuel: 'gas', status: 'operating' },
      { name: 'Ras Abu Aboud', country: 'QA', lat: 24.733, lon: 51.250, capacity: 1500, fuel: 'gas', status: 'operating' },
      { name: 'Mesaieed', country: 'QA', lat: 24.700, lon: 51.550, capacity: 2000, fuel: 'gas', status: 'operating' },
      { name: 'Al Kharsaah', country: 'QA', lat: 24.417, lon: 51.283, capacity: 1800, fuel: 'gas', status: 'operating' },
      { name: 'Manah', country: 'OM', lat: 22.683, lon: 58.067, capacity: 1500, fuel: 'gas', status: 'operating' },
      { name: 'Sohar', country: 'OM', lat: 24.317, lon: 56.700, capacity: 2000, fuel: 'gas', status: 'operating' },
      { name: 'Barka', country: 'OM', lat: 23.550, lon: 58.183, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Khalifa', country: 'SA', lat: 24.417, lon: 46.417, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Jubail', country: 'SA', lat: 27.017, lon: 49.550, capacity: 4000, fuel: 'gas', status: 'operating' },
      { name: 'Ras Tanura', country: 'SA', lat: 26.633, lon: 50.150, capacity: 2400, fuel: 'gas', status: 'operating' },
      { name: 'Waad Al Shamal', country: 'SA', lat: 31.133, lon: 41.083, capacity: 1400, fuel: 'coal', status: 'operating' },
      { name: 'Al Khobar', country: 'SA', lat: 26.217, lon: 50.183, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Dammam', country: 'SA', lat: 26.420, lon: 50.088, capacity: 1700, fuel: 'gas', status: 'operating' },
      { name: 'Qurrayyat', country: 'SA', lat: 31.833, lon: 37.333, capacity: 4000, fuel: 'gas', status: 'operating' },
      { name: 'Ghazlan', country: 'SA', lat: 26.683, lon: 49.667, capacity: 2800, fuel: 'gas', status: 'operating' },
      { name: 'Al Waha', country: 'SA', lat: 21.483, lon: 39.500, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Petro Rabigh', country: 'SA', lat: 22.783, lon: 38.867, capacity: 1300, fuel: 'gas', status: 'operating' },
      { name: 'Jubail 2', country: 'SA', lat: 27.050, lon: 49.650, capacity: 2400, fuel: 'gas', status: 'operating' },
      { name: 'Mumbai', country: 'IN', lat: 18.975, lon: 72.826, capacity: 1800, fuel: 'gas', status: 'operating' },
      { name: 'Trombay', country: 'IN', lat: 19.017, lon: 72.817, capacity: 1400, fuel: 'gas', status: 'operating' },
      { name: 'Kawas', country: 'IN', lat: 21.167, lon: 72.650, capacity: 650, fuel: 'gas', status: 'operating' },
      { name: 'Gandhar', country: 'IN', lat: 20.900, lon: 73.333, capacity: 657, fuel: 'gas', status: 'operating' },
      { name: 'Kakrapar', country: 'IN', lat: 21.250, lon: 73.350, capacity: 1050, fuel: 'nuclear', status: 'operating' },
      { name: 'Koodankulam', country: 'IN', lat: 8.167, lon: 77.700, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Kalpakkam', country: 'IN', lat: 12.033, lon: 80.183, capacity: 440, fuel: 'nuclear', status: 'operating' },
      { name: 'Tarapur', country: 'IN', lat: 19.850, lon: 72.650, capacity: 1400, fuel: 'nuclear', status: 'operating' },
      { name: 'Rawatbhata', country: 'IN', lat: 25.117, lon: 75.567, capacity: 1180, fuel: 'nuclear', status: 'operating' },
      { name: 'Narora', country: 'IN', lat: 28.200, lon: 78.417, capacity: 440, fuel: 'nuclear', status: 'operating' },
      { name: 'Kakrapar', country: 'IN', lat: 21.250, lon: 73.350, capacity: 630, fuel: 'nuclear', status: 'operating' },
      { name: 'Chennai', country: 'IN', lat: 13.082, lon: 80.271, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Moyar', country: 'IN', lat: 11.583, lon: 76.650, capacity: 360, fuel: 'hydro', status: 'operating' },
      { name: 'Pykara', country: 'IN', lat: 11.450, lon: 76.683, capacity: 307, fuel: 'hydro', status: 'operating' },
      { name: 'Mettur', country: 'IN', lat: 11.783, lon: 77.800, capacity: 400, fuel: 'hydro', status: 'operating' },
      { name: 'Kundah', country: 'IN', lat: 11.283, lon: 76.933, capacity: 900, fuel: 'hydro', status: 'operating' },
      { name: 'Nagarjuna Sagar', country: 'IN', lat: 16.917, lon: 79.333, capacity: 960, fuel: 'hydro', status: 'operating' },
      { name: 'Srisailam', country: 'IN', lat: 16.083, lon: 78.883, capacity: 770, fuel: 'hydro', status: 'operating' },
      { name: 'Tunga', country: 'IN', lat: 13.333, lon: 74.667, capacity: 240, fuel: 'hydro', status: 'operating' },
      { name: 'Bhakra', country: 'IN', lat: 31.417, lon: 76.433, capacity: 1325, fuel: 'hydro', status: 'operating' },
      { name: 'Beas', country: 'IN', lat: 31.833, lon: 76.700, capacity: 780, fuel: 'hydro', status: 'operating' },
      { name: 'Salal', country: 'IN', lat: 33.200, lon: 74.817, capacity: 690, fuel: 'hydro', status: 'operating' },
      { name: 'Chamera', country: 'IN', lat: 32.550, lon: 76.150, capacity: 540, fuel: 'hydro', status: 'operating' },
      { name: 'Uri', country: 'IN', lat: 34.083, lon: 74.000, capacity: 600, fuel: 'hydro', status: 'operating' },
      { name: 'Tehri', country: 'IN', lat: 30.383, lon: 78.467, capacity: 1000, fuel: 'hydro', status: 'operating' },
      { name: 'Dul Hasti', country: 'IN', lat: 33.550, lon: 75.750, capacity: 390, fuel: 'hydro', status: 'operating' },
      { name: 'Sainj', country: 'IN', lat: 31.717, lon: 77.367, capacity: 200, fuel: 'hydro', status: 'operating' },
      { name: 'Kashang', country: 'IN', lat: 31.650, lon: 77.583, capacity: 195, fuel: 'hydro', status: 'operating' },
      { name: 'Yuanan', country: 'CN', lat: 31.800, lon: 117.400, capacity: 5400, fuel: 'coal', status: 'operating' },
      { name: 'Shenhua Taisha', country: 'CN', lat: 39.750, lon: 110.033, capacity: 3000, fuel: 'coal', status: 'operating' },
      { name: 'Huaneng Yunneng', country: 'CN', lat: 25.083, lon: 102.650, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Zhonglian', country: 'CN', lat: 39.533, lon: 114.167, capacity: 2600, fuel: 'coal', status: 'operating' },
      { name: 'Wenruitang', country: 'CN', lat: 26.883, lon: 100.233, capacity: 1400, fuel: 'hydro', status: 'operating' },
      { name: 'Longtan', country: 'CN', lat: 25.200, lon: 107.967, capacity: 1800, fuel: 'hydro', status: 'operating' },
      { name: 'Xiluodu', country: 'CN', lat: 28.200, lon: 103.650, capacity: 13860, fuel: 'hydro', status: 'operating' },
      { name: ' Xiangjiaba', country: 'CN', lat: 28.800, lon: 104.650, capacity: 6000, fuel: 'hydro', status: 'operating' },
      { name: 'Baihua', country: 'CN', lat: 26.600, lon: 106.717, capacity: 1200, fuel: 'hydro', status: 'operating' },
      { name: 'Dianzhong', country: 'CN', lat: 25.467, lon: 101.800, capacity: 1800, fuel: 'hydro', status: 'operating' },
      { name: 'Fujian', country: 'CN', lat: 26.650, lon: 118.300, capacity: 1400, fuel: 'hydro', status: 'operating' },
      { name: 'Tianjin', country: 'CN', lat: 39.133, lon: 117.200, capacity: 6000, fuel: 'gas', status: 'operating' },
      { name: 'Beijing', country: 'CN', lat: 39.900, lon: 116.400, capacity: 4000, fuel: 'gas', status: 'operating' },
      { name: 'Hongyan', country: 'CN', lat: 38.500, lon: 121.000, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Lingao', country: 'CN', lat: 19.900, lon: 109.167, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Fangchenggang', country: 'CN', lat: 21.617, lon: 108.550, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Ningde', country: 'CN', lat: 27.000, lon: 120.267, capacity: 1080, fuel: 'nuclear', status: 'operating' },
      { name: 'Fuqing', country: 'CN', lat: 25.450, lon: 119.650, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Yangjiang', country: 'CN', lat: 21.700, lon: 111.983, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Sanmen', country: 'CN', lat: 29.100, lon: 121.433, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Haiyang', country: 'CN', lat: 36.700, lon: 121.183, capacity: 1200, fuel: 'nuclear', status: 'operating' },
      { name: 'Liaoning', country: 'CN', lat: 40.017, lon: 122.000, capacity: 4000, fuel: 'coal', status: 'operating' },
      { name: 'Jinzhou', country: 'CN', lat: 41.083, lon: 121.100, capacity: 3200, fuel: 'coal', status: 'operating' },
      { name: 'Fuxin', country: 'CN', lat: 42.017, lon: 121.650, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Tieling', country: 'CN', lat: 42.200, lon: 123.850, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Zhangjiakou', country: 'CN', lat: 40.767, lon: 114.867, capacity: 3000, fuel: 'coal', status: 'operating' },
      { name: 'Jing-Jin-E', country: 'CN', lat: 39.517, lon: 117.083, capacity: 4000, fuel: 'coal', status: 'operating' },
      { name: 'Tangshan', country: 'CN', lat: 39.633, lon: 118.183, capacity: 3600, fuel: 'coal', status: 'operating' },
      { name: 'Shijiazhuang', country: 'CN', lat: 38.017, lon: 114.467, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Baoding', country: 'CN', lat: 38.867, lon: 115.467, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Taiyuan', country: 'CN', lat: 37.867, lon: 112.550, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Datong', country: 'CN', lat: 40.083, lon: 113.300, capacity: 4000, fuel: 'coal', status: 'operating' },
      { name: 'Pingluo', country: 'CN', lat: 38.900, lon: 106.550, capacity: 3300, fuel: 'coal', status: 'operating' },
      { name: 'Hohhot', country: 'CN', lat: 40.833, lon: 111.667, capacity: 4600, fuel: 'coal', status: 'operating' },
      { name: 'Baotou', country: 'CN', lat: 40.650, lon: 109.817, capacity: 4200, fuel: 'coal', status: 'operating' },
      { name: 'Shandong', country: 'CN', lat: 36.650, lon: 117.117, capacity: 6000, fuel: 'coal', status: 'operating' },
      { name: 'Jinan', country: 'CN', lat: 36.650, lon: 117.083, capacity: 2800, fuel: 'coal', status: 'operating' },
      { name: 'Zibo', country: 'CN', lat: 36.800, lon: 118.050, capacity: 3200, fuel: 'coal', status: 'operating' },
      { name: 'Weifang', country: 'CN', lat: 36.700, lon: 119.167, capacity: 3000, fuel: 'coal', status: 'operating' },
      { name: 'Nanjing', country: 'CN', lat: 32.050, lon: 118.767, capacity: 2800, fuel: 'coal', status: 'operating' },
      { name: 'Suzhou', country: 'CN', lat: 31.300, lon: 120.583, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Wuxi', country: 'CN', lat: 31.567, lon: 120.300, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Hangzhou', country: 'CN', lat: 30.267, lon: 120.167, capacity: 3000, fuel: 'coal', status: 'operating' },
      { name: 'Ningbo', country: 'CN', lat: 29.867, lon: 121.550, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Wenzhou', country: 'CN', lat: 28.000, lon: 120.700, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'Huzhou', country: 'CN', lat: 30.867, lon: 120.083, capacity: 1400, fuel: 'coal', status: 'operating' },
      { name: 'Chongqing', country: 'CN', lat: 29.550, lon: 106.550, capacity: 4000, fuel: 'coal', status: 'operating' },
      { name: 'Chengdu', country: 'CN', lat: 30.683, lon: 104.067, capacity: 2800, fuel: 'coal', status: 'operating' },
      { name: 'Deyang', country: 'CN', lat: 31.133, lon: 104.400, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'Nanchong', country: 'CN', lat: 30.800, lon: 106.117, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Luzhou', country: 'CN', lat: 28.867, lon: 105.450, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Yibin', country: 'CN', lat: 28.767, lon: 104.633, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'Guangzhou', country: 'CN', lat: 23.129, lon: 113.264, capacity: 2800, fuel: 'gas', status: 'operating' },
      { name: 'Shenzhen', country: 'CN', lat: 22.543, lon: 114.058, capacity: 3200, fuel: 'gas', status: 'operating' },
      { name: 'Zhuhai', country: 'CN', lat: 22.267, lon: 113.583, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Dongguan', country: 'CN', lat: 23.017, lon: 113.750, capacity: 2400, fuel: 'gas', status: 'operating' },
      { name: 'Foshan', country: 'CN', lat: 23.017, lon: 113.117, capacity: 1800, fuel: 'gas', status: 'operating' },
      { name: 'Zhongshan', country: 'CN', lat: 22.517, lon: 113.367, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Huizhou', country: 'CN', lat: 23.117, lon: 114.417, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Jiangmen', country: 'CN', lat: 22.567, lon: 113.083, capacity: 1200, fuel: 'gas', status: 'operating' },
      { name: 'Taizhou', country: 'CN', lat: 32.483, lon: 119.917, capacity: 1400, fuel: 'gas', status: 'operating' },
      { name: 'Yangzhou', country: 'CN', lat: 32.400, lon: 119.400, capacity: 1600, fuel: 'gas', status: 'operating' },
      { name: 'Taizhou', country: 'CN', lat: 28.650, lon: 121.433, capacity: 1400, fuel: 'gas', status: 'operating' },
      { name: 'Lianyungang', country: 'CN', lat: 34.600, lon: 119.167, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Xuzhou', country: 'CN', lat: 34.200, lon: 117.283, capacity: 2600, fuel: 'coal', status: 'operating' },
      { name: 'Huaian', country: 'CN', lat: 33.550, lon: 119.017, capacity: 2000, fuel: 'coal', status: 'operating' },
      { name: 'Wuhu', country: 'CN', lat: 31.333, lon: 118.400, capacity: 1200, fuel: 'coal', status: 'operating' },
      { name: 'Maanshan', country: 'CN', lat: 31.950, lon: 118.500, capacity: 2400, fuel: 'coal', status: 'operating' },
      { name: 'Bengbu', country: 'CN', lat: 32.917, lon: 117.383, capacity: 1600, fuel: 'coal', status: 'operating' },
      { name: 'Haikou', country: 'CN', lat: 20.017, lon: 110.350, capacity: 600, fuel: 'gas', status: 'operating' },
      { name: 'Sanya', country: 'CN', lat: 18.233, lon: 109.517, capacity: 400, fuel: 'gas', status: 'operating' },
      { name: 'Danzhou', country: 'CN', lat: 19.517, lon: 109.583, capacity: 400, fuel: 'gas', status: 'operating' },
      { name: 'Kunming', country: 'CN', lat: 25.050, lon: 102.700, capacity: 2000, fuel: 'hydro', status: 'operating' },
      { name: 'Dali', country: 'CN', lat: 25.600, lon: 100.267, capacity: 1400, fuel: 'hydro', status: 'operating' },
      { name: 'Lijiang', country: 'CN', lat: 26.867, lon: 100.233, capacity: 1400, fuel: 'hydro', status: 'operating' },
      { name: 'Wenshan', country: 'CN', lat: 23.383, lon: 104.217, capacity: 800, fuel: 'hydro', status: 'operating' },
      { name: 'Gejiu', country: 'CN', lat: 23.367, lon: 103.150, capacity: 600, fuel: 'hydro', status: 'operating' },
      { name: 'Yunneng', country: 'CN', lat: 25.083, lon: 102.650, capacity: 1400, fuel: 'hydro', status: 'operating' },
      { name: 'Nanshan', country: 'CN', lat: 29.533, lon: 91.767, capacity: 1000, fuel: 'hydro', status: 'operating' },
      { name: 'Zhonghe', country: 'CN', lat: 29.200, lon: 93.000, capacity: 800, fuel: 'hydro', status: 'operating' },
      { name: 'Mianyang', country: 'CN', lat: 31.467, lon: 104.683, capacity: 2000, fuel: 'nuclear', status: 'operating' },
      { name: 'Haiwang', country: 'CN', lat: 30.633, lon: 103.133, capacity: 1200, fuel: 'nuclear', status: 'operating' }
    ];
    res.json({ plants: powerPlants, timestamp: Date.now() });
  } catch (error) {
    res.status(503).json({ error: 'Power plants data unavailable' });
  }
});

app.listen(PORT, () => {
console.log(`Proxy server running on http://localhost:${PORT}`);
console.log('[PROXY] Loading OpenFlights route database...');
loadRoutesDatabase();
});
