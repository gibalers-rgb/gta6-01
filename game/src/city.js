// The city itself: a fixed street grid, blocks full of buildings, a plaza,
// the docks, a beach with a ferry pier, and the sea. Built once per seed.
// Every question the game asks — is this a street, what blocks this point,
// where can a car park — lives here.
import { CFG, PALETTE, clampNum } from './tuning.js';

const GAP = 26; // pavement ring between a street and the buildings in a block

/** Is the point on a street (within half a street width of a centreline)? */
export function onStreet(x, y) {
  for (const sx of CFG.streetsX) if (Math.abs(x - sx) <= CFG.streetW / 2) return true;
  for (const sy of CFG.streetsY) if (Math.abs(y - sy) <= CFG.streetW / 2) return true;
  return false;
}

/** Is the point in the sea (not walkable, not drivable)? */
export function inSea(x, y) {
  return x >= CFG.seaX && y >= 0 && y <= CFG.mapH;
}

/** Is the point sand (walkable, slow to drive)? */
export function onSand(x, y) {
  return x >= CFG.sandX && x < CFG.seaX;
}

/** Snap (x, y) to the nearest street centreline point. */
export function snapStreet(x, y) {
  let bx = CFG.streetsX[0];
  let by = CFG.streetsY[0];
  for (const sx of CFG.streetsX) if (Math.abs(x - sx) < Math.abs(x - bx)) bx = sx;
  for (const sy of CFG.streetsY) if (Math.abs(y - sy) < Math.abs(y - by)) by = sy;
  if (Math.abs(x - bx) <= Math.abs(y - by)) {
    return { x: bx, y: clampNum(y, 60, CFG.mapH - 60), vertical: true };
  }
  return { x: clampNum(x, 60, CFG.mapW - 60), y: by, vertical: false };
}

/** A random street point within `radius` of (x, y), or null when none is close. */
export function streetNear(rng, x, y, radius) {
  for (let n = 0; n < 12; n += 1) {
    const vertical = rng.chance(0.5);
    const line = vertical ? rng.from(CFG.streetsX) : rng.from(CFG.streetsY);
    const along = (vertical ? y : x) + rng.range(-radius, radius);
    const px = vertical ? line : clampNum(along, 60, CFG.mapW - 60);
    const py = vertical ? clampNum(along, 60, CFG.mapH - 60) : line;
    if (Math.hypot(px - x, py - y) <= radius && !inSea(px, py)) {
      return { x: px, y: py, vertical };
    }
  }
  return null;
}

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const crates = [];
  const zones = [];

  // Walk the grid of blocks. Each block is the rectangle between two
  // neighbouring streets, shrunk by the pavement ring.
  const xs = [0, ...CFG.streetsX, CFG.mapW];
  const ys = [0, ...CFG.streetsY, CFG.mapH];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? 12 : CFG.streetW / 2 + GAP);
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? 12 : CFG.streetW / 2 + GAP);
      const y0 = ys[by] + (by === 0 ? 12 : CFG.streetW / 2 + GAP);
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 12 : CFG.streetW / 2 + GAP);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The beach strip holds no buildings: clamp the east edge at the sand.
      const east = Math.min(x1, CFG.sandX - 30);
      if (east - x0 < 90) continue;
      // Palm Plaza (streets 1120-1520, 680-1080) stays green.
      if (bx === 3 && by === 2) {
        zones.push({ kind: 'plaza', x: x0, y: y0, w: east - x0, h: y1 - y0 });
        for (let i = 0; i < 16; i += 1) {
          palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      // The docks block (bottom-left) holds shipping crates, not buildings.
      if (bx === 0 && by === 5) {
        zones.push({ kind: 'docks', x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let i = 0; i < 10; i += 1) {
          crates.push({
            x: rng.range(x0 + 30, x1 - 90),
            y: rng.range(y0 + 20, y1 - 30),
            w: 78, h: 30,
            color: rng.from(['#c25e3a', '#3a7ca5', '#7a9a3a', '#b08a2e']),
          });
        }
        continue;
      }
      // Buildings: a 2x2 grid of small blocks in a normal block, one big tower
      // downtown (streets 1520-2320, 1080-1880).
      const tower = bx >= 3 && bx <= 4 && by >= 2 && by <= 3;
      const roof = rng.from(PALETTE.roofs);
      const wall = rng.from(PALETTE.walls);
      if (tower) {
        const w = (east - x0) * 0.86;
        const h = (y1 - y0) * 0.86;
        buildings.push(mkBuilding(x0 + (east - x0 - w) / 2, y0 + (y1 - y0 - h) / 2, w, h, roof, wall, true, rng));
        continue;
      }
      const cols = 2;
      const rows = 2;
      const cellW = (east - x0) / cols;
      const cellH = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (rng.chance(0.18)) continue; // some cells stay as yards
          const pad = 10;
          const w = cellW - pad * 2 - rng.range(0, 24);
          const h = cellH - pad * 2 - rng.range(0, 24);
          buildings.push(mkBuilding(
            x0 + cx * cellW + pad, y0 + cy * cellH + pad, w, h,
            rng.chance(0.5) ? roof : rng.from(PALETTE.roofs),
            rng.chance(0.5) ? wall : rng.from(PALETTE.walls),
            false, rng,
          ));
        }
      }
    }
  }

  // Lit windows: each building gets a grid of windows that glow at night.
  for (const b of buildings) {
    b.cols = Math.max(2, Math.floor(b.w / 46));
    b.rows = Math.max(2, Math.floor(b.h / 40));
    b.lit = [];
    for (let cx = 0; cx < b.cols; cx += 1) {
      for (let cy = 0; cy < b.rows; cy += 1) {
        if (rng.chance(0.45)) b.lit.push({ cx, cy, warm: rng.chance(0.7) });
      }
    }
  }

  // Palm trees along the beach and a few on the main boulevard.
  for (let y = 120; y < CFG.mapH - 60; y += 130) {
    palms.push({ x: CFG.sandX + 34 + rng.range(-8, 8), y: y + rng.range(-20, 20) });
  }
  for (let x = 420; x < 2720; x += 260) {
    palms.push({ x: x + rng.range(-14, 14), y: 280 - 62 });
  }

  // The ferry pier: wooden planks off the boardwalk into the sea, drawn by
  // the renderer from this zone. Walkers stroll out to the end of it.
  zones.push({ kind: 'pier', x: CFG.sandX, y: 1040, w: CFG.seaX - CFG.sandX + 60, h: 44 });

  // Hidden packages: 20 glowing stars tucked near intersections.
  const packages = [];
  for (let i = 0; i < 20; i += 1) {
    let px = 0;
    let py = 0;
    let tries = 0;
    do {
      const sx = rng.from(CFG.streetsX);
      const sy = rng.from(CFG.streetsY);
      px = sx + rng.range(-160, 160);
      py = sy + rng.range(-160, 160);
      tries += 1;
    } while (tries < 20 && (inSea(px, py) || solidAt(px, py, 20)));
    packages.push({ x: px, y: py, taken: false });
  }

  function mkBuilding(x, y, w, h, roof, wall, tower, r) {
    return {
      x, y, w, h, roof, wall, tower,
      neon: tower && r.chance(0.7),
      cols: 2, rows: 2, lit: [],
    };
  }

  function solidAt(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    for (const c of crates) {
      if (x + radius > c.x && x - radius < c.x + c.w && y + radius > c.y && y - radius < c.y + c.h) return c;
    }
    return null;
  }

  /** Push a circle out of every solid rect; returns the solid hit, if any. */
  function pushOut(pos, radius) {
    const hit = solidAt(pos.x, pos.y, radius);
    if (!hit) return null;
    const cx = clampNum(pos.x, hit.x, hit.x + hit.w);
    const cy = clampNum(pos.y, hit.y, hit.y + hit.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    const shove = radius - dist;
    if (shove > 0) {
      pos.x += (dx / dist) * shove;
      pos.y += (dy / dist) * shove;
    }
    return hit;
  }

  /** True when a circle at (x, y) overlaps a building or a crate. */
  function blocked(x, y, radius) {
    return solidAt(x, y, radius) !== null;
  }

  return { buildings, palms, crates, zones, packages, solidAt, pushOut, blocked };
}
