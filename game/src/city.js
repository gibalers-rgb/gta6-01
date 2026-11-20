// The city itself: a fixed road grid, blocks with buildings, a park, a port, a beach
// and an ocean. Generated once per seed; every query the game needs (is this a road,
// what building blocks this point, where can a car spawn) lives here.
import { BEACH_X, COLORS, OCEAN_X, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';

const BLOCK_MARGIN = 26; // sidewalk ring between a road and the buildings inside a block

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** True when the point is on a road (within half a road width of a centreline). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
  return false;
}

/** True when the point is in the ocean (not walkable, not drivable). */
export function isWater(x, y) {
  return x >= OCEAN_X && y >= 0 && y <= WORLD.height;
}

/** True when the point is sand (walkable, slow to drive). */
export function isSand(x, y) {
  return x >= BEACH_X && x < OCEAN_X;
}

/** The nearest road centreline point to (x, y), for snapping spawns onto roads. */
export function nearestRoadPoint(x, y) {
  let bestX = ROADS_X[0];
  let bestY = ROADS_Y[0];
  for (const rx of ROADS_X) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y: clamp(y, 60, WORLD.height - 60), vertical: true };
  return { x: clamp(x, 60, WORLD.width - 60), y: bestY, vertical: false };
}

/** A random point on a road within `radius` of (x, y), or null when none is close. */
export function randomRoadPointNear(random, x, y, radius) {
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = random.next() < 0.5;
    const line = vertical ? random.pick(ROADS_X) : random.pick(ROADS_Y);
    const along = (vertical ? y : x) + random.range(-radius, radius);
    const px = vertical ? line : clamp(along, 60, WORLD.width - 60);
    const py = vertical ? clamp(along, 60, WORLD.height - 60) : line;
    if (Math.hypot(px - x, py - y) <= radius && !isWater(px, py)) return { x: px, y: py, vertical };
  }
  return null;
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  const containers = [];
  const zones = [];

  // Blocks: the rectangles between neighbouring roads.
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.height];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? 12 : ROAD_WIDTH / 2 + BLOCK_MARGIN);
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? 12 : ROAD_WIDTH / 2 + BLOCK_MARGIN);
      const y0 = ys[by] + (by === 0 ? 12 : ROAD_WIDTH / 2 + BLOCK_MARGIN);
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 12 : ROAD_WIDTH / 2 + BLOCK_MARGIN);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Beach strip: no buildings east of the sand line. The last road block
      // reaches past it, so clamp its east edge instead of skipping it whole.
      const bx1 = Math.min(x1, BEACH_X - 30);
      if (bx1 - x0 < 90) continue;
      // The park block (between roads 1100-1500, 650-1050) stays green.
      if (bx === 3 && by === 2) {
        zones.push({ kind: 'park', x: x0, y: y0, w: bx1 - x0, h: y1 - y0 });
        for (let i = 0; i < 14; i += 1) {
          palms.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), park: true });
        }
        continue;
      }
      // The port block (bottom-left) holds shipping containers, not buildings.
      if (bx === 0 && by === 5) {
        zones.push({ kind: 'port', x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let i = 0; i < 10; i += 1) {
          containers.push({
            x: random.range(x0 + 30, x1 - 90),
            y: random.range(y0 + 20, y1 - 30),
            w: 78,
            h: 30,
            color: random.pick(['#c25e3a', '#3a7ca5', '#7a9a3a', '#b08a2e']),
          });
        }
        continue;
      }
      const downtown = bx >= 3 && bx <= 4 && by >= 2 && by <= 3;
      const count = downtown ? 1 : random.int(1, 3);
      const color = random.pick(COLORS.roofs);
      const wall = random.pick(COLORS.walls);
      for (let i = 0; i < count; i += 1) {
        const w = downtown ? (bx1 - x0) * 0.86 : random.range(90, Math.max(100, (bx1 - x0) / count - 16));
        const h = downtown ? (y1 - y0) * 0.86 : random.range(80, Math.max(90, (y1 - y0) - 16));
        const x = downtown ? x0 + (bx1 - x0 - w) / 2 : x0 + ((bx1 - x0 - w) * (count === 1 ? 0.5 : i / (count - 1 || 1)));
        const y = downtown ? y0 + (y1 - y0 - h) / 2 : y0 + random.range(0, Math.max(1, y1 - y0 - h));
        buildings.push({ x, y, w, h, color, wall, tall: downtown, neon: downtown && random.next() < 0.7 });
      }
    }
  }

  // Palm trees along the beach and a few on the main boulevard.
  for (let y = 120; y < WORLD.height - 60; y += 130) {
    palms.push({ x: BEACH_X + 34 + random.range(-8, 8), y: y + random.range(-20, 20), park: false });
  }
  for (let x = 400; x < 2700; x += 260) {
    palms.push({ x: x + random.range(-14, 14), y: 250 - 62, park: false });
  }

  // Hidden packages: 20 glowing stars tucked around the city.
  const packages = [];
  for (let i = 0; i < 20; i += 1) {
    let px;
    let py;
    let tries = 0;
    do {
      px = random.range(140, 3300);
      py = random.range(140, WORLD.height - 140);
      tries += 1;
    } while (tries < 20 && (isWater(px, py) || hitsBuilding(px, py, 20)));
    packages.push({ x: px, y: py, taken: false });
  }

  function hitsBuilding(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    for (const c of containers) {
      if (x + radius > c.x && x - radius < c.x + c.w && y + radius > c.y && y - radius < c.y + c.h) return c;
    }
    return null;
  }

  /** Push a circle out of every solid rect; returns the building hit, if any. */
  function collideCircle(pos, radius) {
    const hit = hitsBuilding(pos.x, pos.y, radius);
    if (!hit) return null;
    const cx = clamp(pos.x, hit.x, hit.x + hit.w);
    const cy = clamp(pos.y, hit.y, hit.y + hit.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    const push = radius - dist;
    if (push > 0) {
      pos.x += (dx / dist) * push;
      pos.y += (dy / dist) * push;
    }
    return hit;
  }

  /** True when a circle at (x, y) overlaps a building or a container. */
  function blocked(x, y, radius) {
    return hitsBuilding(x, y, radius) !== null;
  }

  return { buildings, palms, containers, zones, packages, hitsBuilding, collideCircle, blocked };
}
