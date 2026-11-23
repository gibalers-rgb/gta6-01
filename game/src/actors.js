// Solmar Heat — actors: the player, traffic, pedestrians and police.
// Everything that moves in Solmar Bay lives here: driving and walking,
// stealing cars, the wanted level, and the police chase.

import {
  TILE, WORLD_W, WORLD_H, WALK_SPEED, RUN_SPEED, CAR_ACCEL, CAR_BRAKE,
  CAR_REVERSE_MAX, CAR_MAX_SPEED, CAR_TURN_RATE, CAR_DRAG, TRAFFIC_SPEED,
  POLICE_SPEED, MAX_HEALTH, CRASH_DAMAGE, RAM_DAMAGE, HEALTH_REGEN,
  MAX_WANTED, WANTED_DECAY_QUIET, WANTED_DECAY_STEP, WITNESS_RANGE,
  POLICE_SIGHT_RANGE, MAX_POLICE, POLICE_SPAWN_INTERVAL, BUST_GRAB_RANGE,
  TRAFFIC_COUNT, PARKED_COUNT, PED_COUNT,
} from './config.js';
import { hitsBuilding, clampToWorld, nearestRoadPoint } from './city.js';
import { isDown } from './input.js';
import { sfxCrash, sfxSteal } from './audio.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
const PED_COLORS = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe', '#ff9ff3'];

let nextCarId = 1;

export function makeCar(x, y, angle, kind, driver, color) {
  return {
    id: nextCarId++, x, y, angle, speed: 0,
    kind, driver, color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    dir: 1, vertical: true, turnAt: 0, w: 46, h: 22,
  };
}

export function createPlayer(city) {
  return {
    x: city.start.x, y: city.start.y, angle: -Math.PI / 2,
    onFoot: true, car: null, health: MAX_HEALTH,
    lastDamageAt: -99, speed: 0,
  };
}

function randomRoadPoint(city, rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const rx = city.verticalRoads[Math.floor(rng() * city.verticalRoads.length)];
    return { x: rx, y: 100 + rng() * (WORLD_H - 200), vertical };
  }
  const ry = city.horizontalRoads[Math.floor(rng() * city.horizontalRoads.length)];
  return { x: 100 + rng() * (WORLD_W - 200), y: ry, vertical };
}

export function createTraffic(city, count = TRAFFIC_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, Math.random);
    const c = makeCar(p.x, p.y, p.vertical ? Math.PI / 2 : 0, 'sedan', 'traffic');
    c.vertical = p.vertical;
    c.dir = Math.random() < 0.5 ? 1 : -1;
    c.speed = TRAFFIC_SPEED * (0.8 + Math.random() * 0.4);
    c.angle = c.vertical ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    cars.push(c);
  }
  return cars;
}

export function createParked(city, count = PARKED_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, Math.random);
    const offset = (Math.random() < 0.5 ? -1 : 1) * 26;
    const c = makeCar(
      p.vertical ? p.x + offset : p.x,
      p.vertical ? p.y : p.y + offset,
      p.vertical ? 0 : Math.PI / 2,
      Math.random() < 0.2 ? 'sport' : 'sedan', 'parked',
    );
    c.vertical = p.vertical;
    cars.push(c);
  }
  return cars;
}

export function createPeds(city, count = PED_COUNT) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = 60 + Math.random() * (WORLD_W - 120);
    const y = 60 + Math.random() * (WORLD_H - 340);
    peds.push({
      x, y, tx: x, ty: y, speed: 34 + Math.random() * 26,
      color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
      down: 0, fleeing: false,
    });
  }
  return peds;
}

// --- wanted level -----------------------------------------------------------

export function addWanted(state, n, reason) {
  const before = state.wanted;
  state.wanted = Math.min(MAX_WANTED, state.wanted + n);
  state.crimeTimer = 0;
  state.quietTimer = 0;
  if (state.wanted > before) {
    state.message = reason + `  (+${state.wanted - before}★)`;
    state.messageAt = state.time;
  }
}

export function updateWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.crimeTimer += dt;
  if (state.crimeTimer < WANTED_DECAY_QUIET) return;
  const copNear = state.cars.some(
    (c) => c.driver === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < POLICE_SIGHT_RANGE,
  );
  if (copNear) return;
  state.quietTimer += dt;
  if (state.quietTimer >= WANTED_DECAY_STEP) {
    state.quietTimer = 0;
    state.wanted -= 1;
    state.message = state.wanted === 0 ? 'Heat gone. You are clean.' : 'Heat cooling off…';
    state.messageAt = state.time;
  }
}

// --- player -----------------------------------------------------------------

export function damagePlayer(state, amount) {
  const p = state.player;
  p.health = Math.max(0, p.health - amount);
  p.lastDamageAt = state.time;
  state.shake = Math.min(10, state.shake + 5);
  if (p.health <= 0) state.mode = 'wasted';
}

function moveWithBuildings(city, x, y, r) {
  // Try x then y separately so the player slides along walls.
  let nx = x;
  if (!hitsBuilding(city, nx, y, r)) x = nx;
  let ny = y;
  if (!hitsBuilding(city, x, ny, r)) y = ny;
  const c = clampToWorld(x, y, r);
  return { x: c.x, y: c.y };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  if (p.health < MAX_HEALTH && state.time - p.lastDamageAt > 6) {
    p.health = Math.min(MAX_HEALTH, p.health + HEALTH_REGEN * dt);
  }
  if (!p.onFoot && p.car) {
    updateDriving(state, dt);
    return;
  }
  const speed = isDown('run') ? RUN_SPEED : WALK_SPEED;
  let dx = 0; let dy = 0;
  if (isDown('up')) dy -= 1;
  if (isDown('down')) dy += 1;
  if (isDown('left')) dx -= 1;
  if (isDown('right')) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const nx = p.x + (dx / len) * speed * dt;
    const ny = p.y + (dy / len) * speed * dt;
    const moved = moveWithBuildings(state.city, nx, ny, 13);
    p.x = moved.x; p.y = moved.y;
    p.angle = Math.atan2(dy, dx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
}

function updateDriving(state, dt) {
  const p = state.player;
  const car = p.car;
  const throttle = isDown('up') ? 1 : 0;
  const braking = isDown('down') ? 1 : 0;
  if (throttle) car.speed += CAR_ACCEL * dt;
  if (braking) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
  car.speed -= car.speed * CAR_DRAG * dt;
  if (car.speed > CAR_MAX_SPEED) car.speed = CAR_MAX_SPEED;
  if (car.speed < -CAR_REVERSE_MAX) car.speed = -CAR_REVERSE_MAX;
  if (Math.abs(car.speed) < 4 && !throttle && !braking) car.speed = 0;
  const steer = (isDown('left') ? -1 : 0) + (isDown('right') ? 1 : 0);
  if (steer && Math.abs(car.speed) > 8) {
    car.angle += steer * CAR_TURN_RATE * dt * (car.speed / CAR_MAX_SPEED) * Math.sign(car.speed) * 1.6;
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (hitsBuilding(state.city, nx, ny, 20)) {
    if (Math.abs(car.speed) > 210) {
      damagePlayer(state, CRASH_DAMAGE);
      sfxCrash();
      state.message = 'You slammed a building!';
      state.messageAt = state.time;
    }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
    const c = clampToWorld(car.x, car.y, 22);
    car.x = c.x; car.y = c.y;
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
}

export function nearestCar(state, maxDist = 58) {
  let best = null;
  let bestD = maxDist;
  for (const c of state.cars) {
    if (c.driver === 'player' || c.driver === 'police') continue;
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function trySteal(state) {
  const p = state.player;
  const car = nearestCar(state);
  if (!car) {
    state.message = 'No car close enough — get nearer and press E.';
    state.messageAt = state.time;
    return false;
  }
  const wasTraffic = car.driver === 'traffic';
  car.driver = 'player';
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  sfxSteal();
  const witness = state.peds.some(
    (ped) => ped.down <= 0 && Math.hypot(ped.x - p.x, ped.y - p.y) < WITNESS_RANGE,
  ) || state.cars.some(
    (c) => c.driver === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < WITNESS_RANGE,
  );
  if (witness) {
    addWanted(state, 1, wasTraffic ? 'Carjacked in front of a witness!' : 'Stolen in front of a witness!');
  } else {
    state.message = 'Clean steal — nobody saw a thing.';
    state.messageAt = state.time;
  }
  return true;
}

export function exitCar(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.driver = 'parked';
  car.speed = 0;
  p.x = car.x - Math.cos(car.angle) * 34;
  p.y = car.y - Math.sin(car.angle) * 34;
  const c = clampToWorld(p.x, p.y, 13);
  p.x = c.x; p.y = c.y;
  p.car = null;
  p.onFoot = true;
}

// --- traffic ----------------------------------------------------------------

export function updateTraffic(state, dt) {
  for (const c of state.cars) {
    if (c.driver !== 'traffic') continue;
    // At an intersection, sometimes turn onto the cross street.
    const nearCrossX = state.city.verticalRoads.some((rx) => Math.abs(c.x - rx) < 8);
    const nearCrossY = state.city.horizontalRoads.some((ry) => Math.abs(c.y - ry) < 8);
    if (c.vertical ? nearCrossY : nearCrossX) {
      if (Math.random() < dt * 0.35) {
        c.vertical = !c.vertical;
        c.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
    if (c.vertical) {
      c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      c.y += c.dir * c.speed * dt;
      const lane = state.city.verticalRoads.reduce((a, b) => (Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a));
      c.x += (lane + (c.dir > 0 ? -14 : 14) - c.x) * Math.min(1, dt * 3);
      if (c.y < 40 || c.y > WORLD_H - 320) c.dir *= -1;
    } else {
      c.angle = c.dir > 0 ? 0 : Math.PI;
      c.x += c.dir * c.speed * dt;
      const lane = state.city.horizontalRoads.reduce((a, b) => (Math.abs(b - c.y) < Math.abs(a - c.y) ? b : a));
      c.y += (lane + (c.dir > 0 ? 14 : -14) - c.y) * Math.min(1, dt * 3);
      if (c.x < 40 || c.x > WORLD_W - 40) c.dir *= -1;
    }
    // Gentle separation so traffic does not pile up on one spot.
    for (const o of state.cars) {
      if (o === c || o.driver === 'player') continue;
      const dx = c.x - o.x; const dy = c.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.1 && d < 36) {
        c.x += (dx / d) * (36 - d) * 0.3;
        c.y += (dy / d) * (36 - d) * 0.3;
      }
    }
  }
}

// --- pedestrians --------------------------------------------------------------

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    // Flee from any fast car nearby.
    let fleeX = 0; let fleeY = 0;
    for (const c of state.cars) {
      if (Math.abs(c.speed) < 60) continue;
      const d = Math.hypot(c.x - ped.x, c.y - ped.y);
      if (d < 80) {
        fleeX += (ped.x - c.x) / d;
        fleeY += (ped.y - c.y) / d;
      }
    }
    if (fleeX || fleeY) {
      const len = Math.hypot(fleeX, fleeY);
      ped.x += (fleeX / len) * ped.speed * 2.2 * dt;
      ped.y += (fleeY / len) * ped.speed * 2.2 * dt;
      ped.fleeing = true;
    } else {
      ped.fleeing = false;
      const dx = ped.tx - ped.x; const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        ped.tx = 60 + Math.random() * (WORLD_W - 120);
        ped.ty = 60 + Math.random() * (WORLD_H - 380);
      } else {
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
      }
    }
    const c = clampToWorld(ped.x, ped.y, 10);
    ped.x = c.x; ped.y = c.y;
    // A speeding car that clips a pedestrian knocks them down — and the
    // whole city notices.
    if (!p.onFoot && p.car && Math.abs(p.car.speed) > 70) {
      const d = Math.hypot(p.car.x - ped.x, p.car.y - ped.y);
      if (d < 30) {
        ped.down = 3;
        addWanted(state, 1, 'You ran over a pedestrian!');
      }
    }
  }
}

// --- police -------------------------------------------------------------------

export function spawnPolice(state) {
  const p = state.player;
  // Spawn on a road a good distance away, so the chase arrives, not teleports.
  for (let tries = 0; tries < 12; tries++) {
    const spot = randomRoadPoint(state.city, Math.random);
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > 480 && d < 900) {
      const cop = makeCar(spot.x, spot.y, 0, 'cop', 'police', '#1c2733');
      cop.speed = POLICE_SPEED * 0.7;
      state.cars.push(cop);
      return cop;
    }
  }
  return null;
}

export function updatePolice(state, dt) {
  const p = state.player;
  const want = Math.min(state.wanted, MAX_POLICE);
  const active = state.cars.filter((c) => c.driver === 'police').length;
  state.policeTimer += dt;
  if (state.wanted > 0 && active < want && state.policeTimer > POLICE_SPAWN_INTERVAL) {
    state.policeTimer = 0;
    spawnPolice(state);
  }
  if (state.wanted === 0) {
    // No heat: the cops give up and drive off (removed quietly).
    state.cars = state.cars.filter((c) => c.driver !== 'police');
    return;
  }
  for (const cop of state.cars.filter((c) => c.driver === 'police')) {
    const dx = p.x - cop.x; const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    const target = Math.atan2(dy, dx);
    let diff = target - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    cop.speed = Math.min(POLICE_SPEED, cop.speed + 320 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (hitsBuilding(state.city, cop.x, cop.y, 20)) {
      cop.speed *= 0.4;
      cop.angle += 0.6 * dt * 10;
    }
    if (dist < 44) {
      if (p.onFoot) {
        if (dist < BUST_GRAB_RANGE) {
          state.mode = 'busted';
          state.bustedAt = state.time;
        }
      } else if (Math.abs(p.car.speed) > 40 || cop.speed > 200) {
        // A hard ram hurts the player and shoves both cars apart.
        damagePlayer(state, RAM_DAMAGE);
        sfxCrash();
        cop.speed *= 0.35;
        p.car.speed *= 0.6;
        p.car.x += Math.cos(cop.angle) * 26;
        p.car.y += Math.sin(cop.angle) * 26;
        state.message = 'Police rammed you!';
        state.messageAt = state.time;
      }
    }
  }
}

// Keep the camera's target centred on the player with a small look-ahead.
export function cameraTarget(state) {
  const p = state.player;
  const look = p.onFoot ? 0 : 46;
  return {
    x: p.x + Math.cos(p.angle) * look,
    y: p.y + Math.sin(p.angle) * look,
  };
}
