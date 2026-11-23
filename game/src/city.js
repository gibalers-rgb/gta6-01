// Solara Bay: the city itself. A seeded grid of avenues, blocks, parks, a
// beachfront, and a working port, plus every collision and road query the
// cars, pedestrians, police and missions need.

import { makeRng, clamp, pushCircleOutOfRect } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;

// Avenue center lines. The city is a grid; the south edge is the beach.
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2100];

export const BEACH_Y = 2160;   // sand starts here
export const WATER_Y = 2280;   // open water starts here

const WALL_COLORS = [
  '#e8dcc8', '#d9b48f', '#c97e6b', '#7fa8a0', '#e0a458',
  '#b7c4ce', '#d98a7a', '#f0e6d2', '#8fb8a8', '#c9a86a',
];
const ROOF_COLORS = ['#a34d3f', '#5d7a6a', '#7a6a58', '#4d6a7a', '#8a5a44'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    buildings: [],
    parks: [],
    lots: [],
    trees: [],
    boats: [],
    containers: [],
    districts: [
      { name: 'Old Town', x: 0, y: 0, w: 1200, h: 1200 },
      { name: 'Downtown', x: 1200, y: 0, w: 1200, h: 1200 },
      { name: 'The Hills', x: 2400, y: 0, w: 800, h: 1200 },
      { name: 'Marina', x: 0, y: 1200, w: 1200, h: 960 },
      { name: 'Midtown', x: 1200, y: 1200, w: 1200, h: 960 },
      { name: 'The Docks', x: 2400, y: 1200, w: 800, h: 960 },
      { name: 'Beachfront', x: 0, y: 2160, w: 3200, h: 240 },
    ],
    hospital: { x: 1470, y: 260, w: 260, h: 180 },
    policeStation: { x: 2470, y: 1270, w: 220, h: 150 },
    bank: { x: 1470, y: 1070, w: 200, h: 140 },
    paintShop: { x: 670, y: 1470, w: 180, h: 120 },
    safehouse: { x: 470, y: 330, w: 110, h: 90 },
    dockGate: { x: 2760, y: 1560 },
  };

  const landmarkBlocks = new Set();
  const blockOf = (bx, by) => `${bx},${by}`;
  const markLandmark = (x, y) => {
    const bx = ROADS_X.findIndex((v) => v > x) - 1;
    const by = ROADS_Y.findIndex((v) => v > y) - 1;
    if (bx >= 0 && by >= 0) landmarkBlocks.add(blockOf(bx, by));
  };
  markLandmark(city.hospital.x, city.hospital.y);
  markLandmark(city.policeStation.x, city.policeStation.y);
  markLandmark(city.bank.x, city.bank.y);
  markLandmark(city.paintShop.x, city.paintShop.y);
  markLandmark(city.safehouse.x, city.safehouse.y);

  const addBuilding = (x, y, w, h, opts = {}) => {
    city.buildings.push({
      x, y, w, h,
      wall: opts.wall || rng.pick(WALL_COLORS),
      roof: opts.roof || rng.pick(ROOF_COLORS),
      height: opts.height ?? rng.int(6, 22),
      landmark: opts.landmark || null,
    });
  };

  // Landmark buildings, drawn with their own colours.
  addBuilding(city.hospital.x, city.hospital.y, city.hospital.w, city.hospital.h,
    { wall: '#eef2f4', roof: '#c94f4f', height: 18, landmark: 'St. Marisol Hospital' });
  addBuilding(city.policeStation.x, city.policeStation.y, city.policeStation.w, city.policeStation.h,
    { wall: '#3f5a78', roof: '#2c4258', height: 14, landmark: 'Solara PD Central' });
  addBuilding(city.bank.x, city.bank.y, city.bank.w, city.bank.h,
    { wall: '#d8c690', roof: '#8a6a3a', height: 20, landmark: 'Bay Federal Bank' });
  addBuilding(city.paintShop.x, city.paintShop.y, city.paintShop.w, city.paintShop.h,
    { wall: '#e07840', roof: '#5a3a28', height: 8, landmark: "Rico's Paint & Body" });
  addBuilding(city.safehouse.x, city.safehouse.y, city.safehouse.w, city.safehouse.h,
    { wall: '#f0e0b8', roof: '#a34d3f', height: 8, landmark: "Leo's Safehouse" });

  // Fill the remaining blocks.
  for (let by = 0; by < ROADS_Y.length - 1; by++) {
    for (let bx = 0; bx < ROADS_X.length - 1; bx++) {
      if (landmarkBlocks.has(blockOf(bx, by))) continue;
      const x0 = ROADS_X[bx] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[by] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[by + 1] - ROAD_W / 2 - 14;
      if (y0 > 2050) continue; // beach strip stays open
      const roll = rng.next();
      if (roll < 0.52) {
        // One to three buildings in the block.
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const bw = rng.range(90, Math.max(100, (x1 - x0) / n - 20));
          const bh = rng.range(80, Math.max(90, (y1 - y0) - 30));
          const bx0 = x0 + rng.range(0, Math.max(1, x1 - x0 - bw));
          const by0 = y0 + rng.range(0, Math.max(1, y1 - y0 - bh));
          addBuilding(bx0, by0, bw, bh);
        }
      } else if (roll < 0.68) {
        city.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const trees = rng.int(5, 10);
        for (let i = 0; i < trees; i++) {
          city.trees.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            r: rng.range(12, 22),
          });
        }
      } else if (roll < 0.82) {
        city.lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      } else {
        // Open plaza with a few trees.
        const trees = rng.int(2, 5);
        for (let i = 0; i < trees; i++) {
          city.trees.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            r: rng.range(12, 20),
          });
        }
      }
    }
  }

  // The Docks: warehouses, containers and cranes east of x = 2760.
  const dockRng = makeRng(seed + 77);
  for (let i = 0; i < 4; i++) {
    addBuilding(2820, 1240 + i * 210, 300, 150,
      { wall: '#9aa5a0', roof: '#5a6a72', height: 12, landmark: i === 0 ? 'Pier 9 Warehouse' : null });
  }
  const containerColors = ['#c96a3a', '#3a7ac9', '#4da34d', '#c9b13a', '#8a4da3'];
  for (let i = 0; i < 26; i++) {
    city.containers.push({
      x: dockRng.range(2780, 3120),
      y: dockRng.range(1250, 2050),
      w: 64, h: 26,
      color: dockRng.pick(containerColors),
      angle: dockRng.chance(0.5) ? 0 : Math.PI / 2,
    });
  }
  // Boats in the marina, south-west water edge.
  for (let i = 0; i < 7; i++) {
    city.boats.push({
      x: 260 + i * 130 + dockRng.range(-20, 20),
      y: 2310 + dockRng.range(-8, 8),
      angle: dockRng.range(-0.2, 0.2),
      color: dockRng.pick(['#f2f2f2', '#d8e8f0', '#f0d8d8']),
    });
  }
  return city;
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solara Bay';
}

// Nearest point on a road centre line, plus which axis it lies on.
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { x: rx, y: clamp(y, 60, WORLD_H - 60), axis: 'v', d };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { x: clamp(x, 60, WORLD_W - 60), y: ry, axis: 'h', d };
  }
  return best;
}

export function randomRoadPoint(rng, margin = 120) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(ROADS_X), y: rng.range(margin, WORLD_H - margin), axis: 'v' };
  }
  return { x: rng.range(margin, WORLD_W - margin), y: rng.pick(ROADS_Y), axis: 'h' };
}

// Resolve a circle against buildings, containers, the world edge and water.
// Returns the corrected position.
export function collideWorld(city, x, y, r, canSwim = false) {
  let nx = clamp(x, 20 + r, WORLD_W - 20 - r);
  let ny = clamp(y, 20 + r, WORLD_H - 20 - r);
  if (!canSwim && ny + r > WATER_Y) ny = WATER_Y - r;
  for (const b of city.buildings) {
    if (nx < b.x - r || nx > b.x + b.w + r || ny < b.y - r || ny > b.y + b.h + r) continue;
    const fixed = pushCircleOutOfRect(nx, ny, r, b);
    if (fixed) { nx = fixed.x; ny = fixed.y; }
  }
  for (const c of city.containers) {
    const rect = c.angle === 0
      ? { x: c.x, y: c.y, w: c.w, h: c.h }
      : { x: c.x, y: c.y, w: c.h, h: c.w };
    if (nx < rect.x - r || nx > rect.x + rect.w + r || ny < rect.y - r || ny > rect.y + rect.h + r) continue;
    const fixed = pushCircleOutOfRect(nx, ny, r, rect);
    if (fixed) { nx = fixed.x; ny = fixed.y; }
  }
  return { x: nx, y: ny };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Draw the whole city inside the current camera transform.
export function drawCity(ctx, city, cam, clockHour) {
  const night = clockHour < 6 || clockHour >= 19.5;
  const dusk = (clockHour >= 17.5 && clockHour < 19.5) || (clockHour >= 6 && clockHour < 7.5);

  // Ground.
  ctx.fillStyle = '#6f8f5a';
  ctx.fillRect(cam.x - 700, cam.y - 450, 1400, 900);
  // Dock apron: concrete yard east of the 2600 avenue.
  ctx.fillStyle = '#707880';
  ctx.fillRect(2660, 1180, 540, 980);
  // Beach sand and water.
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(cam.x - 700, BEACH_Y, 1400, WATER_Y - BEACH_Y);
  ctx.fillStyle = night ? '#16324a' : '#2e7fa8';
  ctx.fillRect(cam.x - 700, WATER_Y, 1400, WORLD_H - WATER_Y + 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 5; i++) {
    const wy = WATER_Y + 8 + i * 16;
    ctx.fillRect(cam.x - 700, wy + Math.sin(clockHour * 2 + i) * 2, 1400, 2);
  }

  // Roads.
  ctx.fillStyle = '#33383f';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Sidewalk edges.
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 4;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, WORLD_H);
    ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, WORLD_H); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(0, ry - ROAD_W / 2); ctx.lineTo(WORLD_W, ry - ROAD_W / 2);
    ctx.moveTo(0, ry + ROAD_W / 2); ctx.lineTo(WORLD_W, ry + ROAD_W / 2); ctx.stroke();
  }
  // Lane dashes.
  ctx.fillStyle = night ? '#c9a83a' : '#e8d44d';
  for (const rx of ROADS_X) {
    for (let y = 40; y < WORLD_H; y += 90) ctx.fillRect(rx - 3, y, 6, 42);
  }
  for (const ry of ROADS_Y) {
    for (let x = 40; x < WORLD_W; x += 90) ctx.fillRect(x, ry - 3, 42, 6);
  }

  // Parks and lots.
  for (const p of city.parks) {
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#4a7a38'; ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
  for (const lot of city.lots) {
    ctx.fillStyle = '#54595f';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2;
    for (let x = lot.x + 16; x < lot.x + lot.w - 20; x += 46) {
      ctx.strokeRect(x, lot.y + 12, 30, 16);
    }
  }

  // Buildings: soft shadow, walls, roof, lit windows at night.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + b.height * 0.7, b.y + b.height * 0.9, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (night || dusk) {
      ctx.fillStyle = '#ffd76a';
      const cols = Math.floor(b.w / 46);
      const rows = Math.floor(b.h / 40);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.x) % 3 === 0) {
            ctx.fillRect(b.x + 14 + i * 46, b.y + 14 + j * 40, 14, 10);
          }
        }
      }
    }
    if (b.landmark) {
      ctx.font = 'bold 13px Verdana, sans-serif';
      const w = ctx.measureText(b.landmark).width + 16;
      ctx.fillStyle = 'rgba(10,14,20,0.75)';
      ctx.fillRect(b.x + b.w / 2 - w / 2, b.y + b.h / 2 - 11, w, 22);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(b.landmark, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }

  // Dock containers.
  for (const c of city.containers) {
    ctx.save();
    ctx.translate(c.x + (c.angle === 0 ? c.w / 2 : c.h / 2), c.y + (c.angle === 0 ? c.h / 2 : c.w / 2));
    ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }

  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Boats.
  for (const boat of city.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(22, 14); ctx.lineTo(-22, 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f4f';
    ctx.fillRect(-6, -14, 12, 14);
    ctx.restore();
  }

  // District labels on the ground.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 26px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const d of city.districts) {
    if (d.name === 'Beachfront') continue;
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
}
