// The wanted system: heat, stars, police cars that chase, foot officers
// who try to arrest the player, and the busted / escaped outcomes.

import { makeCar, CAR_TYPES } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint } from './city.js';
import { clamp, dist, angleTo, angleLerp } from './rng.js';
import { spawnBurst, shake } from './fx.js';

export function starsFromHeat(heat) {
  if (heat < 8) return 0;
  if (heat < 25) return 1;
  if (heat < 45) return 2;
  if (heat < 65) return 3;
  if (heat < 85) return 4;
  return 5;
}

export function addHeat(G, amount, reason) {
  const before = starsFromHeat(G.heat);
  G.heat = clamp(G.heat + amount, 0, 100);
  G.wanted = starsFromHeat(G.heat);
  G.crimeTimer = 0;
  G.lastCrimeAt = G.time;
  if (reason) G.feed(`${reason} — wanted level ${G.wanted}`, '#ff8a7a');
  if (G.wanted > before) G.audio.horn();
}

export function wantedCopCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

export function spawnCopCar(G) {
  const p = nearestRoadPoint(
    G.player.x + G.rng.range(-800, 800),
    G.player.y + G.rng.range(-800, 800),
  );
  const car = makeCar(G.city, G.rng, {
    kind: 'cop', type: 'cop', x: p.x, y: p.y, color: '#2c4a6a',
  });
  car.speed = 200;
  car.ramCooldown = 0;
  G.cars.push(car);
  return car;
}

export function spawnFootCop(G, x, y) {
  const cop = {
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 255,
    hp: 70,
    grab: 0,
    shootCooldown: G.rng.range(0.5, 1.5),
    shirt: '#2c4a6a',
    pants: '#1c2a3a',
    skin: '#e8b88a',
  };
  G.cops.push(cop);
  return cop;
}

function nearestCopDistance(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.kind === 'cop') best = Math.min(best, dist(car.x, car.y, G.player.x, G.player.y));
  }
  for (const cop of G.cops) best = Math.min(best, dist(cop.x, cop.y, G.player.x, G.player.y));
  return best;
}

export function updatePolice(G, dt) {
  const player = G.player;
  G.crimeTimer += dt;

  // Wanted decay: lay low, stay out of sight, and the heat fades.
  if (G.heat > 0 && G.time - G.lastCrimeAt > 20) {
    const near = nearestCopDistance(G);
    if (near > 480) {
      G.heat = Math.max(0, G.heat - 3.2 * dt);
      const stars = starsFromHeat(G.heat);
      if (stars < G.wanted) {
        G.wanted = stars;
        if (stars === 0) G.feed('You lost the cops. Heat is off.', '#8ad98a');
      }
    }
  }

  // Keep the right number of pursuit cars on the road.
  const wantCars = wantedCopCount(G.wanted);
  let haveCars = 0;
  for (const car of G.cars) if (car.kind === 'cop') haveCars++;
  if (haveCars < wantCars && G.spawnTimer <= 0) {
    spawnCopCar(G);
    G.spawnTimer = 1.2;
  }
  G.spawnTimer -= dt;

  // Cop cars chase and ram.
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.kind !== 'cop') continue;
    if (G.wanted === 0) {
      G.cars.splice(i, 1);
      continue;
    }
    car.ramCooldown -= dt;
    const targetAngle = angleTo(car.x, car.y, player.x, player.y);
    car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 2.6 * dt));
    const spec = CAR_TYPES.cop;
    const wantSpeed = spec.maxSpeed * (0.72 + G.wanted * 0.06);
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram the player's car, or pull up and send an officer on foot.
    const d = dist(car.x, car.y, player.x, player.y);
    if (player.car) {
      if (d < 56 && car.ramCooldown <= 0) {
        car.ramCooldown = 0.9;
        player.car.hp -= 6;
        player.car.speed *= 0.6;
        car.speed *= 0.7;
        spawnBurst(G, player.car.x, player.car.y, '#ffd23a', 8, 220, 0.4);
        G.audio.crash();
        shake(G, 5);
        G.feed('Police rammed your car!', '#ff8a7a');
      }
    } else if (d < 130 && G.cops.length < 2 + G.wanted) {
      spawnFootCop(G, car.x + G.rng.range(-30, 30), car.y + G.rng.range(-30, 30));
      car.speed = 0;
      // The car waits while its officer is out.
      car.waiting = true;
    }
    if (car.waiting && G.cops.length === 0) car.waiting = false;
  }

  // Foot officers: run the player down, grab to arrest, or shoot at range.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    const d = dist(cop.x, cop.y, player.x, player.y);
    const a = angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle = a;
    if (G.wanted === 0) {
      G.cops.splice(i, 1);
      continue;
    }
    if (d > 900) {
      // Lost the trail — the officer gives up the chase.
      G.cops.splice(i, 1);
      continue;
    }
    if (d > 26) {
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      cop.grab = Math.max(0, cop.grab - dt * 1.5);
    } else {
      cop.grab += dt;
      if (cop.grab > 1.1) {
        bustPlayer(G);
        return;
      }
    }
    // Officers open fire from mid-range at 2+ stars.
    if (G.wanted >= 2 && d > 130 && d < 520) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = G.rng.range(0.9, 1.6);
        fireEnemyBullet(G, cop, a + G.rng.range(-0.12, 0.12));
      }
    }
    if (cop.hp <= 0) {
      spawnBurst(G, cop.x, cop.y, '#ff5a5a', 14, 240, 0.6);
      G.cops.splice(i, 1);
      addHeat(G, 20, 'Officer down');
    }
  }
}

function fireEnemyBullet(G, cop, angle) {
  G.bullets.push({
    x: cop.x + Math.cos(angle) * 16,
    y: cop.y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * 640,
    vy: Math.sin(angle) * 640,
    life: 0.9,
    damage: 9,
    from: 'cop',
  });
  G.audio.shot();
}

export function bustPlayer(G) {
  const lost = Math.floor(G.player.cash * 0.15);
  G.player.cash -= lost;
  G.player.hp = 100;
  G.player.armor = 0;
  G.heat = 0;
  G.wanted = 0;
  G.cops.length = 0;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    if (G.cars[i].kind === 'cop') G.cars.splice(i, 1);
  }
  if (G.player.car) {
    G.player.car.kind = 'traffic';
    G.player.car = null;
  }
  G.player.x = G.city.policeStation.x + 130;
  G.player.y = G.city.policeStation.y + 190;
  G.state = 'busted';
  G.stateTimer = 0;
  G.audio.busted();
  G.feed(`BUSTED — the PD took $${lost} in fines.`, '#ff8a7a');
}

export function wastePlayer(G) {
  const lost = Math.floor(G.player.cash * 0.1);
  G.player.cash -= lost;
  G.player.hp = 100;
  G.player.armor = 0;
  G.player.ammoReserve = 24;
  G.heat = 0;
  G.wanted = 0;
  G.cops.length = 0;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    if (G.cars[i].kind === 'cop') G.cars.splice(i, 1);
  }
  if (G.player.car) {
    G.player.car.kind = 'traffic';
    G.player.car = null;
  }
  G.player.x = G.city.hospital.x + 140;
  G.player.y = G.city.hospital.y + 220;
  G.state = 'wasted';
  G.stateTimer = 0;
  G.audio.fail();
  G.feed(`WASTED — the hospital bill cost $${lost}.`, '#ff8a7a');
}
