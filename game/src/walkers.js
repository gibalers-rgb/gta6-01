// Walkers: they stroll along the streets from one intersection to the next,
// hang out in the plaza and on the beach, flee from gunfire and speeding cars,
// and a few of them wait with a hand up as taxi fares. A walker is
// {x, y, angle, speed, color, mode, ...}; mode is 'stroll' | 'flee' | 'fare'
// | 'down'.
import { CFG } from './tuning.js';
import { inSea, onStreet, snapStreet } from './city.js';

const SHIRTS = ['#e85d75', '#4a90d9', '#f2a541', '#7ac74f', '#9b8fd4', '#ef8354', '#e8e8e8', '#2f3542'];

export function makeWalkers(rng, city) {
  const list = [];
  let spawnIn = 0;

  function spawnNear(px, py, forceMode) {
    for (let n = 0; n < 5; n += 1) {
      const spot = snapStreet(px + rng.range(-500, 500), py + rng.range(-500, 500));
      const side = rng.from([-1, 1]);
      const x = spot.vertical ? spot.x + side * 62 : spot.x + rng.range(-160, 160);
      const y = spot.vertical ? spot.y + rng.range(-160, 160) : spot.y + side * 62;
      if (inSea(x, y)) continue;
      const walker = {
        x, y,
        angle: rng.range(0, Math.PI * 2),
        speed: rng.range(28, 52),
        color: rng.from(SHIRTS),
        mode: forceMode || (rng.chance(0.06) ? 'fare' : 'stroll'),
        legT: rng.range(2, 8),
        health: 100,
        panic: 0,
        goal: null,
      };
      pickLeg(walker);
      list.push(walker);
      return walker;
    }
    return null;
  }

  /** Point the walker at a nearby intersection to stroll toward. */
  function pickLeg(walker) {
    const gx = rng.from(CFG.streetsX);
    const gy = rng.from(CFG.streetsY);
    walker.goal = { x: gx + rng.range(-40, 40), y: gy + rng.range(-40, 40) };
    walker.angle = Math.atan2(walker.goal.y - walker.y, walker.goal.x - walker.x);
  }

  /** A horn blast nearby: strollers stop and turn to look at the car. */
  function lookAt(px, py, radius) {
    for (const w of list) {
      if (w.mode !== 'stroll') continue;
      if (Math.hypot(w.x - px, w.y - py) > radius) continue;
      w.angle = Math.atan2(py - w.y, px - w.x);
      w.legT = 1.2; // stand and stare for a moment
      w.speed = 0;
    }
  }

  function step(dt, px, py, danger) {
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = 0.7;
      const near = list.filter((w) => Math.hypot(w.x - px, w.y - py) < 900);
      if (near.length < 22) spawnNear(px, py);
    }
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const w = list[i];
      if (Math.hypot(w.x - px, w.y - py) > 1100) {
        list.splice(i, 1);
        continue;
      }
      if (w.mode === 'down') continue;
      const dangerDist = danger ? Math.hypot(w.x - danger.x, w.y - danger.y) : 9999;
      if (dangerDist < 260 && w.mode !== 'fare') {
        w.mode = 'flee';
        w.panic = 3;
        w.angle = Math.atan2(w.y - danger.y, w.x - danger.x);
      }
      if (w.mode === 'flee') {
        w.speed = 150;
        w.panic -= dt;
        if (w.panic <= 0) {
          w.mode = 'stroll';
          pickLeg(w);
        }
      } else if (w.mode === 'fare') {
        w.speed = 0;
      } else {
        w.speed = 40;
        // Stroll toward the goal intersection, then pick a new leg.
        if (w.goal && Math.hypot(w.goal.x - w.x, w.goal.y - w.y) < 30) pickLeg(w);
        else if (w.goal) w.angle = Math.atan2(w.goal.y - w.y, w.goal.x - w.x);
        w.legT -= dt;
        if (w.legT <= 0) {
          w.legT = rng.range(3, 9);
          pickLeg(w);
        }
      }
      const nx = w.x + Math.cos(w.angle) * w.speed * dt;
      const ny = w.y + Math.sin(w.angle) * w.speed * dt;
      // Strollers stay off the road itself (pavements, plaza, beach); a
      // fleeing walker runs anywhere.
      const ontoRoad = onStreet(nx, ny) && !onStreet(w.x, w.y);
      if (!inSea(nx, ny) && !city.blocked(nx, ny, 10) && !(ontoRoad && w.mode === 'stroll' && rng.chance(0.9))) {
        w.x = Math.max(20, Math.min(CFG.mapW - 20, nx));
        w.y = Math.max(20, Math.min(CFG.mapH - 20, ny));
      } else {
        w.angle += Math.PI / 2;
        pickLeg(w);
      }
    }
  }

  return { list, spawnNear, step, lookAt };
}
