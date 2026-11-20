// Tuning and palette for Leonida Bay, a sun-soaked fictional open-world city.
// All units are world pixels; one world step is 1/60 s.
export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2700 };
export const ROAD_WIDTH = 96;

// Vertical and horizontal road centrelines. Blocks between them hold buildings.
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [250, 650, 1050, 1450, 1850, 2250];

export const BEACH_X = 3050; // sand starts here
export const OCEAN_X = 3380; // water starts here

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 270,
  health: 100,
  punchDamage: 30,
  punchRange: 36,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 56,
  width: 27,
  accel: 430,
  brake: 720,
  reverseAccel: 260,
  maxSpeed: 540,
  maxReverse: 170,
  turnRate: 2.6,
  health: 100,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 8, // seconds with no police near before stars start falling
  decayInterval: 4,
  policeCars: [0, 2, 3, 4, 5, 6], // police cars on the map per star level
  policeFoot: [0, 0, 2, 3, 4, 6], // foot cops per star level
};

export const DAY_LENGTH = 240; // seconds for a full day cycle

export const COLORS = {
  grass: '#79a854',
  grassDark: '#6a9a48',
  park: '#5da24a',
  sand: '#ecd9a0',
  ocean: '#2fa8b5',
  oceanDeep: '#1d7f9e',
  road: '#33343c',
  roadEdge: '#26272e',
  sidewalk: '#b9b3a4',
  line: '#e8c33c',
  roofs: ['#e07856', '#f2a541', '#7fb3d5', '#e58aa5', '#8fc1a3', '#d9c27a', '#9b8fd4', '#ef8354'],
  walls: ['#c96a4a', '#d18a2e', '#6a9cc0', '#c97a95', '#7aa88d', '#bfa85e', '#8478bd', '#d06f42'],
  palm: '#3f8f4f',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonYellow: '#ffd23e',
};

export const SAVE_KEY = 'leonida-bay-save-v1';

// Fixed places in the city, by name.
export const PLACES = {
  safehouse: { x: 700, y: 650, label: 'Safehouse' },
  diner: { x: 1500, y: 1050, label: 'Sunset Diner' },
  beachLot: { x: 3100, y: 1450, label: 'Beach Lot' },
  garage: { x: 700, y: 2050, label: 'Port Garage' },
  beach: { x: 3200, y: 1050, label: 'Ocean Beach' },
  hideout: { x: 1100, y: 1850, label: 'Hideout' },
  port: { x: 500, y: 2250, label: 'Port of Leonida' },
  warehouse: { x: 1900, y: 2250, label: 'Warehouse 7' },
  downtown: { x: 1700, y: 1050, label: 'Downtown' },
  spray: { x: 2300, y: 650, label: "Pay 'n Spray" },
  hospital: { x: 1100, y: 250, label: 'Leonida General' },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
