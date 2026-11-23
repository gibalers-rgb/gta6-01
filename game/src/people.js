// Pedestrians: they stroll the sidewalks, cross at corners, panic at
// gunfire, and occasionally flag a taxi fare.

import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, isOnRoad, nearestRoadPoint, randomRoadPoint } from './city.js';
import { clamp, dist, angleTo } from './rng.js';

const SHIRTS = ['#e05a5a', '#5a8ae0', '#5ac98a', '#e0c95a', '#a05ae0', '#e08a5a', '#5ad0c9', '#d8d8d8'];
const PANTS = ['#2c3a4a', '#4a3a2c', '#3a4a2c', '#5a2c3a'];

export function makePed(city, rng, x, y) {
  const p = { x, y };
  if (x === undefined || y === undefined) {
    const rp = randomRoadPoint(rng);
    p.x = rp.x + rng.range(-40, 40);
    p.y = rp.y + rng.range(-40, 40);
  }
  return {
    x: p.x, y: p.y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(34, 62),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    skin: rng.pick(['#f0c8a0', '#c98d5a', '#8a5a3a', '#e8b88a']),
    fleeing: false,
    fleeTimer: 0,
    target: null,
    walkPhase: rng.range(0, Math.PI * 2),
    fare: false,
    hp: 50,
  };
}

export function spawnPeds(city, rng, player, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 10) {
    const ped = makePed(city, rng);
    if (dist(ped.x, ped.y, player.x, player.y) < 260) continue;
    peds.push(ped);
  }
  return peds;
}

function pickSidewalkTarget(city, ped, rng) {
  const p = nearestRoadPoint(ped.x, ped.y);
  const along = rng.range(120, 420) * (rng.chance(0.5) ? 1 : -1);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = ROAD_W / 2 + 16;
  if (p.axis === 'v') {
    return { x: clamp(p.x + off * side, 40, WORLD_W - 40), y: clamp(ped.y + along, 40, WORLD_H - 40) };
  }
  return { x: clamp(ped.x + along, 40, WORLD_W - 40), y: clamp(p.y + off * side, 40, WORLD_H - 40) };
}

export function updatePeds(G, dt) {
  const player = G.player;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (dist(ped.x, ped.y, player.x, player.y) > 1400) {
      G.peds.splice(i, 1);
      const fresh = makePed(G.city, G.rng);
      const p = nearestRoadPoint(player.x + G.rng.range(-600, 600), player.y + G.rng.range(-600, 600));
      fresh.x = p.x; fresh.y = p.y;
      G.peds.push(fresh);
      continue;
    }
    // Panic: gunfire, a speeding car, or a body nearby.
    const gunfireNear = G.gunfireTimer > 0 && dist(ped.x, ped.y, player.x, player.y) < 420;
    const carNear = player.car && dist(ped.x, ped.y, player.car.x, player.car.y) < 90 && Math.abs(player.car.speed) > 200;
    if ((gunfireNear || carNear) && !ped.fleeing) {
      ped.fleeing = true;
      ped.fleeTimer = G.rng.range(2, 4);
    }
    if (ped.fleeing) {
      ped.fleeTimer -= dt;
      const away = angleTo(player.x, player.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      ped.walkPhase += dt * 14;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    } else {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
        ped.target = pickSidewalkTarget(G.city, ped, G.rng);
      }
      const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
      ped.walkPhase += dt * 7;
    }
    ped.x = clamp(ped.x, 30, WORLD_W - 30);
    ped.y = clamp(ped.y, 30, WORLD_H - 30);
  }
}

export function drawPed(ctx, ped, time) {
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ped.angle);
  // Legs, torso, head.
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-5, -5, 10, 4);
  ctx.fillRect(-5, 1, 10, 4);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(8, -2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.fare) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 26, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#062b16';
    ctx.font = 'bold 13px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 21);
  }
}
