// Solmar Heat — city generation.
// Builds the whole map from one fixed seed so every run (and every
// screenshot) sees the same streets, blocks and landmarks. The city is a
// grid: roads on every 5th tile line, blocks of buildings between them,
// sand and sea along the south edge.

import {
  TILE, COLS, ROWS, ROAD_EVERY, BEACH_START_ROW, WORLD_W, WORLD_H,
  COLORS,
} from './config.js';

// Small deterministic RNG (mulberry32) so the map is stable run to run.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isRoadTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  if (ty >= BEACH_START_ROW) return false;
  return tx % ROAD_EVERY === ROAD_EVERY - 1 || ty % ROAD_EVERY === ROAD_EVERY - 1;
}

export function isBeachTile(tx, ty) {
  return ty >= BEACH_START_ROW && tx >= 0 && tx < COLS && ty < ROWS;
}

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Every drivable road centre line, for traffic and spawn placement.
function roadCentres() {
  const vertical = [];
  const horizontal = [];
  for (let tx = ROAD_EVERY - 1; tx < COLS; tx += ROAD_EVERY) vertical.push(tx * TILE + TILE / 2);
  for (let ty = ROAD_EVERY - 1; ty < BEACH_START_ROW; ty += ROAD_EVERY) horizontal.push(ty * TILE + TILE / 2);
  return { vertical, horizontal };
}

export function buildCity(seed = 20261124) {
  const rng = makeRng(seed);
  const { vertical, horizontal } = roadCentres();
  const buildings = [];
  const palms = [];

  // One building per block, inset from the road, with a pastel roof.
  for (let bx = 0; bx < COLS; bx += ROAD_EVERY) {
    for (let by = 0; by < BEACH_START_ROW; by += ROAD_EVERY) {
      const blockW = Math.min(ROAD_EVERY - 1, COLS - bx) * TILE;
      const blockH = Math.min(ROAD_EVERY - 1, BEACH_START_ROW - by) * TILE;
      if (blockW < TILE * 2 || blockH < TILE * 2) continue;
      // Leave the central plaza block open (a park with palms).
      if (bx === 15 && by === 10) {
        for (let i = 0; i < 6; i++) {
          palms.push({
            x: bx * TILE + 40 + rng() * (blockW - 80),
            y: by * TILE + 40 + rng() * (blockH - 80),
          });
        }
        continue;
      }
      const w = TILE * (1.5 + rng() * 1.5);
      const h = TILE * (1.5 + rng() * 1.5);
      const x = bx * TILE + 16 + rng() * Math.max(1, blockW - w - 32);
      const y = by * TILE + 16 + rng() * Math.max(1, blockH - h - 32);
      buildings.push({
        x, y, w, h,
        color: COLORS.buildingRoof[Math.floor(rng() * COLORS.buildingRoof.length)],
      });
    }
  }

  // Palm rows along the beach and a few on sidewalks.
  for (let i = 0; i < 16; i++) {
    palms.push({ x: 60 + rng() * (WORLD_W - 120), y: BEACH_START_ROW * TILE + 26 + rng() * 40 });
  }
  for (let i = 0; i < 10; i++) {
    palms.push({ x: 40 + rng() * (WORLD_W - 80), y: 40 + rng() * (BEACH_START_ROW * TILE - 80) });
  }

  // Landmarks: spray shop (clears wanted), hideout (getaway target),
  // docks (delivery target), and the player's start corner.
  const sprayShop = { x: 9 * TILE, y: 9 * TILE, w: 150, h: 110, label: 'SPRAY SHOP' };
  const hideout = { x: 4 * TILE, y: 4 * TILE, w: 150, h: 110, label: 'HIDEOUT' };
  const docks = { x: 33 * TILE, y: 24 * TILE, w: 170, h: 90, label: 'DOCKS' };
  const start = { x: 19 * TILE + TILE / 2, y: 14 * TILE + TILE / 2 };

  return {
    seed, buildings, palms, sprayShop, hideout, docks, start,
    verticalRoads: vertical, horizontalRoads: horizontal,
  };
}

// Circle-vs-building test; roads, sidewalks and beach are all open ground.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const spot of [city.sprayShop, city.hideout, city.docks]) {
    if (x + r > spot.x && x - r < spot.x + spot.w && y + r > spot.y && y - r < spot.y + spot.h) return spot;
  }
  return null;
}

export function clampToWorld(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD_W - r, x)),
    y: Math.max(r, Math.min(WORLD_H - r, y)),
  };
}

// Nearest point on a road centre line, used to drop traffic onto streets.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.verticalRoads) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.horizontalRoads) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}
