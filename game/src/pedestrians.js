// Pedestrians: they stroll the sidewalks, the park and the beach, flee from gunfire
// and from a speeding car, and a few of them wait as taxi fares. A ped is
// {x, y, angle, speed, color, state, ...}; state is 'walk' | 'flee' | 'taxi' | 'down'.
import { WORLD } from './config.js';
import { isOnRoad, isWater, nearestRoadPoint } from './city.js';

const SHIRTS = ['#e85d75', '#4a90d9', '#f2a541', '#7ac74f', '#9b8fd4', '#ef8354', '#e8e8e8', '#2f3542'];

export function createPedestrians(random, city) {
  const peds = [];
  let spawnTimer = 0;

  function spawnNear(px, py, forceState) {
    for (let tries = 0; tries < 5; tries += 1) {
      const spot = nearestRoadPoint(px + random.range(-500, 500), py + random.range(-500, 500));
      const side = random.pick([-1, 1]);
      const x = spot.vertical ? spot.x + side * 62 : spot.x + random.range(-160, 160);
      const y = spot.vertical ? spot.y + random.range(-160, 160) : spot.y + side * 62;
      if (isWater(x, y)) continue; // the beach road's east side is ocean: try again
      const ped = {
        x, y,
        angle: random.range(0, Math.PI * 2),
        speed: random.range(28, 52),
        color: random.pick(SHIRTS),
        state: forceState || (random.next() < 0.06 ? 'taxi' : 'walk'),
        stateTime: random.range(2, 8),
        health: 100,
        panic: 0,
      };
      peds.push(ped);
      return ped;
    }
    return null;
  }

  function step(dt, px, py, danger) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.7;
      const near = peds.filter((p) => Math.hypot(p.x - px, p.y - py) < 900);
      if (near.length < 22) spawnNear(px, py);
    }
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (Math.hypot(ped.x - px, ped.y - py) > 1100) {
        peds.splice(i, 1);
        continue;
      }
      if (ped.state === 'down') continue;
      const distDanger = danger ? Math.hypot(ped.x - danger.x, ped.y - danger.y) : 9999;
      if (distDanger < 260 && ped.state !== 'taxi') {
        ped.state = 'flee';
        ped.panic = 3;
        ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      }
      ped.stateTime -= dt;
      if (ped.state === 'flee') {
        ped.speed = 150;
        if (ped.panic > 0) ped.panic -= dt;
        else ped.state = 'walk';
      } else if (ped.state === 'taxi') {
        ped.speed = 0;
      } else {
        ped.speed = 40;
        if (ped.stateTime <= 0) {
          ped.stateTime = random.range(3, 9);
          ped.angle = random.range(0, Math.PI * 2);
        }
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      // Walkers keep to the sidewalks, the park and the beach: they turn away from
      // the road instead of strolling into traffic (fleeing peds run anywhere).
      const steppingOntoRoad = isOnRoad(nx, ny) && !isOnRoad(ped.x, ped.y);
      if (!isWater(nx, ny) && !city.blocked(nx, ny, 10) && !(steppingOntoRoad && ped.state === 'walk' && random.next() < 0.9)) {
        ped.x = Math.max(20, Math.min(WORLD.width - 20, nx));
        ped.y = Math.max(20, Math.min(WORLD.height - 20, ny));
      } else {
        ped.angle += Math.PI / 2;
      }
    }
  }

  return { peds, spawnNear, step };
}
