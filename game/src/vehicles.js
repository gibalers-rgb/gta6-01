// Cars: traffic that drives the avenue grid, and the arcade driving model
// the player uses when they steal one.

import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, collideWorld, nearestRoadPoint, randomRoadPoint } from './city.js';
import { clamp, dist } from './rng.js';
import { spawnBurst, spawnSmoke, shake } from './fx.js';

export const CAR_TYPES = {
  sedan: { w: 46, h: 22, maxSpeed: 300, accel: 300, color: '#c94f4f' },
  taxi: { w: 46, h: 22, maxSpeed: 310, accel: 320, color: '#e8c33a' },
  sport: { w: 48, h: 21, maxSpeed: 520, accel: 460, color: '#c93a6a' },
  truck: { w: 62, h: 26, maxSpeed: 220, accel: 200, color: '#7a8a99' },
  van: { w: 54, h: 24, maxSpeed: 250, accel: 240, color: '#8a6a4d' },
  cop: { w: 48, h: 22, maxSpeed: 430, accel: 420, color: '#2c4a6a' },
};

const TRAFFIC_COLORS = ['#c94f4f', '#4d7ac9', '#e8e8e8', '#3a3a3a', '#5a9a5a', '#c9863a', '#7a5ac9', '#9ab8c9'];

export function makeCar(city, rng, opts = {}) {
  const type = opts.type || rng.pick(['sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
  const spec = CAR_TYPES[type];
  let x = opts.x;
  let y = opts.y;
  let angle = opts.angle ?? 0;
  if (x === undefined || y === undefined) {
    const p = randomRoadPoint(rng);
    x = p.x; y = p.y;
    angle = p.axis === 'v' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
  }
  return {
    kind: opts.kind || 'traffic',
    type,
    x, y, angle,
    speed: opts.speed ?? 0,
    color: opts.color || (type === 'taxi' ? '#e8c33a' : rng.pick(TRAFFIC_COLORS)),
    hp: 100,
    ai: null,
    brakeLight: false,
    smoke: 0,
    id: opts.id ?? Math.floor(rng.next() * 1e9),
  };
}

// Give a traffic car a lane to follow on the grid.
export function giveTrafficRoute(car, rng) {
  const p = nearestRoadPoint(car.x, car.y);
  car.ai = {
    axis: p.axis,
    dir: rng.chance(0.5) ? 1 : -1,
    cruise: rng.range(90, 165),
    turnCooldown: rng.range(1, 4),
    lane: 0,
  };
  car.ai.lane = car.ai.axis === 'v'
    ? (car.ai.dir > 0 ? 22 : -22)
    : (car.ai.dir > 0 ? 22 : -22);
}

export function spawnTraffic(city, rng, player, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 12) {
    const car = makeCar(city, rng);
    if (dist(car.x, car.y, player.x, player.y) < 320) continue;
    giveTrafficRoute(car, rng);
    car.speed = car.ai.cruise;
    cars.push(car);
  }
  return cars;
}

function laneTarget(car) {
  if (!car.ai) return { x: car.x, y: car.y };
  if (car.ai.axis === 'v') {
    const rx = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    return { x: rx + car.ai.lane, y: car.y };
  }
  const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  return { x: car.x, y: ry + car.ai.lane };
}

function nearestIntersection(x, y) {
  let best = null;
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      const d = Math.hypot(x - rx, y - ry);
      if (!best || d < best.d) best = { x: rx, y: ry, d };
    }
  }
  return best;
}

export function updateTraffic(G, dt) {
  const player = G.player;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.kind !== 'traffic') continue;
    // Recycle cars that drifted far from the player.
    if (dist(car.x, car.y, player.x, player.y) > 1500) {
      G.cars.splice(i, 1);
      const fresh = makeCar(G.city, G.rng);
      const p = nearestRoadPoint(player.x + G.rng.range(-700, 700), player.y + G.rng.range(-700, 700));
      fresh.x = p.x; fresh.y = p.y;
      giveTrafficRoute(fresh, G.rng);
      fresh.speed = fresh.ai.cruise;
      G.cars.push(fresh);
      continue;
    }
    const ai = car.ai;
    ai.turnCooldown -= dt;
    // Slow for the car ahead on the same lane.
    let target = ai.cruise;
    for (const other of G.cars) {
      if (other === car || other.kind === 'player') continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 80) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) { target = 0; break; }
      }
    }
    // Fleeing pedestrians make traffic brake too.
    for (const ped of G.peds) {
      if (ped.fleeing && dist(car.x, car.y, ped.x, ped.y) < 70) { target = 0; break; }
    }
    car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
    // Turn at intersections sometimes.
    const inter = nearestIntersection(car.x, car.y);
    if (inter.d < 46 && ai.turnCooldown <= 0 && G.rng.chance(0.35)) {
      ai.turnCooldown = G.rng.range(2, 5);
      if (ai.axis === 'v') {
        ai.axis = 'h';
        ai.dir = G.rng.chance(0.5) ? 1 : -1;
        car.y = inter.y;
      } else {
        ai.axis = 'v';
        ai.dir = G.rng.chance(0.5) ? 1 : -1;
        car.x = inter.x;
      }
      ai.lane = ai.dir > 0 ? 22 : -22;
    }
    const wantAngle = ai.axis === 'v' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const lane = laneTarget(car);
    if (ai.axis === 'v') car.x += (lane.x - car.x) * Math.min(1, 2.2 * dt);
    else car.y += (lane.y - car.y) * Math.min(1, 2.2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 60, WORLD_W - 60);
    car.y = clamp(car.y, 60, WORLD_H - 60);
    car.brakeLight = target < car.speed - 5;
  }
}

// Arcade driving for the player's car. Returns true when a hard crash happened.
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  const input = G.input;
  const spec = CAR_TYPES[car.type];
  const forward = input.up ? 1 : input.down ? -0.55 : 0;
  const steering = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const handbrake = input.handbrake;
  const prevSpeed = car.speed;

  if (forward > 0) car.speed += spec.accel * forward * dt;
  else if (forward < 0) car.speed += spec.accel * forward * dt * 0.9;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);

  const drag = handbrake ? 420 : 60;
  if (Math.abs(car.speed) > 0) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
  }
  car.speed = clamp(car.speed, -170, spec.maxSpeed);

  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
  const grip = handbrake ? 1.5 : 1;
  car.angle += steering * 2.5 * steerAuthority * dt * grip;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideWorld(G.city, nx, ny, 22);
  const crashed = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (crashed && Math.abs(car.speed) > 160) {
    car.hp -= Math.abs(car.speed) * 0.05;
    spawnBurst(G, fixed.x, fixed.y, '#ffb13a', 10, 260, 0.5);
    spawnSmoke(G, fixed.x, fixed.y, 5);
    G.audio.crash();
    shake(G, 6);
    car.speed *= 0.45;
  } else if (crashed) {
    car.speed *= 0.7;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  car.brakeLight = input.down || handbrake;
  if (car.hp < 35) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      spawnSmoke(G, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 1);
    }
  }
  if (car.hp <= 0) {
    spawnBurst(G, car.x, car.y, '#ff7a3a', 40, 420, 0.9);
    spawnSmoke(G, car.x, car.y, 14);
    G.audio.crash();
    shake(G, 12);
    return true; // car destroyed
  }
  return false;
}

// Soft circle collision between the player's car and traffic.
export function resolveCarBumps(G) {
  const pc = G.player.car;
  if (!pc) return;
  for (const car of G.cars) {
    if (car.kind !== 'traffic' && car.kind !== 'cop') continue;
    const d = dist(pc.x, pc.y, car.x, car.y);
    if (d < 52 && d > 0.01) {
      const push = (52 - d) / 2;
      const ux = (car.x - pc.x) / d;
      const uy = (car.y - pc.y) / d;
      car.x += ux * push; car.y += uy * push;
      pc.x -= ux * push; pc.y -= uy * push;
      const exchange = pc.speed * 0.25;
      car.speed = exchange;
      pc.speed *= 0.82;
      if (Math.abs(pc.speed) > 120) {
        G.audio.crash();
        spawnBurst(G, (pc.x + car.x) / 2, (pc.y + car.y) / 2, '#ffd23a', 6, 200, 0.4);
      }
    }
  }
}

export function drawCar(ctx, car, time) {
  const spec = CAR_TYPES[car.type];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = spec.w;
  const h = spec.h;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  ctx.beginPath();
  ctx.roundRect(-w * 0.18, -h / 2 + 4, w * 0.32, h - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.7)';
  ctx.fillRect(w * 0.14, -h / 2 + 5, 5, h - 10);
  ctx.fillRect(-w * 0.2, -h / 2 + 5, 4, h - 10);
  // Taxi sign / cop light bar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -h / 2 - 2, 12, 5);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -h / 2 + 8);
  }
  if (car.type === 'cop') {
    const blink = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3a3a' : '#3a7aff';
    ctx.beginPath(); ctx.arc(-4, -h / 2 + 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#3a7aff' : '#ff3a3a';
    ctx.beginPath(); ctx.arc(6, -h / 2 + 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  // Headlights and brake lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#a33';
  ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 5);
  ctx.fillRect(-w / 2 - 1, h / 2 - 8, 3, 5);
  ctx.restore();
}
