// Marisol Bay — tuning. One place holds every number the game balances on:
// map size, street grid, hero and car feel, heat rules, and the prices of the
// side systems (garage repairs, the clean-getaway bonus). Distances are world
// pixels; the simulation ticks at 60 Hz.
export const CFG = {
  tick: 1 / 60,
  mapW: 3600,
  mapH: 2700,
  streetW: 96,
  // Street centrelines; the blocks between them hold the buildings.
  streetsX: [320, 720, 1120, 1520, 1920, 2320, 2720],
  streetsY: [280, 680, 1080, 1480, 1880, 2280],
  sandX: 3060, // beach starts here
  seaX: 3390, // water starts here
  daySeconds: 300, // one full day/night cycle, in play seconds
  hero: {
    radius: 13,
    walk: 180,
    sprint: 280,
    health: 100,
    fistDmg: 30,
    fistReach: 38,
    fistDelay: 0.36,
    regenPerSec: 2, // slow heal while the heat is off
  },
  car: {
    accel: 450,
    brake: 760,
    reverse: 280,
    top: 550,
    topBack: 180,
    steer: 2.8,
    health: 100,
  },
  heat: {
    max: 5,
    unseenSecs: 8, // quiet seconds before stars start falling
    fallEvery: 4,
    cruisers: [0, 2, 3, 4, 5, 6],
    officers: [0, 0, 2, 3, 4, 6],
  },
  repairCost: 50, // Eddie's Garage fixes a battered car for this much
  evadeBonus: 100, // cash for shaking a wanted level clean
  sprayCost: 100, // Spray 'n Go repaint
  saveKey: 'marisol-bay-save-v3',
};

export const PALETTE = {
  lawn: '#7cab55',
  lawn2: '#6b9c49',
  park: '#5ea44b',
  sand: '#eedca6',
  sea: '#2fa9b6',
  sea2: '#1e809f',
  asphalt: '#34353d',
  kerb: '#bcb6a7',
  lane: '#eac53d',
  roofs: ['#e07856', '#f2a541', '#7fb3d5', '#e58aa5', '#8fc1a3', '#d9c27a', '#9b8fd4', '#ef8354'],
  walls: ['#c96a4a', '#d18a2e', '#6a9cc0', '#c97a95', '#7aa88d', '#bfa85e', '#8478bd', '#d06f42'],
  palm: '#3f8f4f',
  pink: '#ff2e88',
  cyan: '#22d3ee',
  gold: '#ffd23e',
};

// Named places: missions point at them, and the HUD names them.
export const SPOTS = {
  safehouse: { x: 720, y: 680, label: 'Safehouse' },
  diner: { x: 1520, y: 1080, label: 'Marisol Diner' },
  marina: { x: 3100, y: 1480, label: 'Marina Lot' },
  garage: { x: 720, y: 2080, label: "Eddie's Garage" },
  boardwalk: { x: 3220, y: 1080, label: 'Boardwalk' },
  hideout: { x: 1120, y: 1880, label: 'Hideout' },
  docks: { x: 520, y: 2280, label: 'Port of Marisol' },
  warehouse: { x: 1920, y: 2280, label: 'Warehouse 9' },
  downtown: { x: 1720, y: 1080, label: 'Downtown' },
  spray: { x: 2320, y: 680, label: "Spray 'n Go" },
  hospital: { x: 1120, y: 280, label: 'Marisol General' },
  plaza: { x: 1320, y: 880, label: 'Palm Plaza' },
};

// Rough neighbourhoods for the HUD district readout.
const HOODS = [
  { name: 'Downtown', x0: 1300, y0: 700, x1: 2100, y1: 1500 },
  { name: 'Old Town', x0: 0, y0: 0, x1: 1300, y1: 1500 },
  { name: 'The Docks', x0: 0, y0: 1900, x1: 1300, y1: 2700 },
  { name: 'Southside', x0: 1300, y0: 1900, x1: 3060, y1: 2700 },
  { name: 'Northside', x0: 1300, y0: 0, x1: 3060, y1: 700 },
  { name: 'Boardwalk', x0: 3060, y0: 0, x1: 3600, y1: 2700 },
];

/** Which neighbourhood contains (x, y). */
export function hoodAt(x, y) {
  for (const h of HOODS) {
    if (x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1) return h.name;
  }
  return 'Marisol Bay';
}

export function clampNum(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shortest signed angle from b to a, in (-PI, PI]. */
export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
