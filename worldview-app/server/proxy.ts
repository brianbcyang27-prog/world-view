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

function estimateRoute(airline: string, lat: number, lon: number): { origin: string; destination: string } {
const routes = ROUTES_CACHE.get(airline);
if (routes && routes.length > 0) {
const idx = Math.abs(Math.floor(lat * 100 + lon)) % routes.length;
return routes[idx];
}
const routeInfo = AIRLINE_ROUTES[airline];
if (!routeInfo) return { origin: '', destination: '' };
  
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
  
  const route = estimateRoute(parsed.airline, lat, lon);
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

  const route = estimateRoute(parsed.airline, ac.lat, ac.lon);
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
try {
const query = req.query.q as string || 'conflict protest military disaster';
const timespan = req.query.timespan as string || '24h';

const docUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&timespan=${timespan}&maxrecords=50`;

console.log('[PROXY] Fetching news from:', docUrl);

const response = await fetch(docUrl, {
signal: AbortSignal.timeout(30000),
headers: { 'User-Agent': 'WorldView-OSINT/1.0' }
});

if (!response.ok) {
console.error('[PROXY] GDELT error:', response.status);
throw new Error(`GDELT error: ${response.status}`);
}

const data = await response.json();

const articles = (data.articles || []).slice(0, 30).map((article: any) => ({
url: article.url,
title: article.title,
source: article.domain,
pubDate: article.seendate,
language: article.language,
socialimage: article.socialimage
}));

res.json({ articles, timestamp: Date.now(), total: articles.length });
} catch (error) {
console.error('[PROXY] News error:', error);
res.status(503).json({ error: 'News data unavailable', articles: [] });
}
});

app.listen(PORT, () => {
console.log(`Proxy server running on http://localhost:${PORT}`);
console.log('[PROXY] Loading OpenFlights route database...');
loadRoutesDatabase();
});
