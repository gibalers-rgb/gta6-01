// The wanted system: stars rise with crimes, police cars and foot cops hunt the
// player, stars fall when the player stays unseen, and getting caught means Busted.
// Police cars ram the player; foot cops chase on foot and grab the player up close.
import { WANTED } from './config.js';
import { angleDiff } from './vehicles.js';

export const EVENT_BUSTED = 1;

export function createPolice(random, vehicles) {
  const cops = []; // foot cops {x, y, angle, speed}
  let unseenTimer = 0;
  let decayTimer = 0;
  let spawnTimer = 0;

  function wantedCars(state) {
    return vehicles.cars.filter((c) => c.kind === 'police').length;
  }

  function addHeat(state, stars) {
    state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
    unseenTimer = 0;
  }

  function step(dt, state, player, city) {
    const px = player.x;
    const py = player.y;
    // Keep the police presence matched to the wanted level.
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.8;
      const wantCars = WANTED.policeCars[state.wanted];
      if (wantedCars(state) < wantCars) vehicles.spawnPoliceNear(px, py);
      const wantFoot = WANTED.policeFoot[state.wanted];
      if (cops.length < wantFoot) {
        const spot = vehicles.spawnPoliceNear(px, py);
        if (spot) {
          vehicles.cars.splice(vehicles.cars.indexOf(spot), 1);
          cops.push({ x: spot.x, y: spot.y, angle: 0, speed: 200 });
        }
      }
    }
    // Chase: police cars steer at the player and ram; foot cops run at the player.
    let nearest = Infinity;
    for (const car of vehicles.cars) {
      if (car.kind !== 'police') continue;
      const dist = Math.hypot(car.x - px, car.y - py);
      nearest = Math.min(nearest, dist);
      // Aim slightly to the side so interceptors sideswipe instead of pinning the
      // player nose-to-nose and stalling the chase.
      if (car.ramSide === undefined) car.ramSide = random.next() < 0.5 ? -1 : 1;
      const side = car.ramSide * 46;
      const ax = px + Math.cos(Math.atan2(py - car.y, px - car.x) + Math.PI / 2) * side;
      const ay = py + Math.sin(Math.atan2(py - car.y, px - car.x) + Math.PI / 2) * side;
      const desired = Math.atan2(ay - car.y, ax - car.x);
      const steer = Math.max(-1, Math.min(1, angleDiff(desired, car.angle) * 2.2));
      const throttle = dist > 150 ? 1 : dist > 60 ? 0.5 : 0.15;
      vehicles.drive(car, dt, throttle, steer, false, city);
    }
    for (const cop of cops) {
      const dist = Math.hypot(cop.x - px, cop.y - py);
      nearest = Math.min(nearest, dist);
      cop.angle = Math.atan2(py - cop.y, px - cop.x);
      const speed = player.inCar ? 0 : 210;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      city.collideCircle(cop, 12);
    }
    // Busted: a foot cop grabs the player on foot while wanted.
    if (!player.inCar && state.wanted > 0) {
      for (const cop of cops) {
        if (Math.hypot(cop.x - px, cop.y - py) < 26) {
          return EVENT_BUSTED;
        }
      }
    }
    // Wanted decay: unseen for a while, then a star falls every few seconds.
    if (state.wanted > 0) {
      if (nearest > 520) {
        unseenTimer += dt;
        if (unseenTimer > WANTED.decayDelay) {
          decayTimer += dt;
          if (decayTimer > WANTED.decayInterval) {
            decayTimer = 0;
            state.wanted -= 1;
          }
        }
      } else {
        unseenTimer = 0;
        decayTimer = 0;
      }
    }
    // Despawn police far away, wrecked police cars, or when the heat is gone.
    for (let i = vehicles.cars.length - 1; i >= 0; i -= 1) {
      const car = vehicles.cars[i];
      if (car.kind === 'police' && (state.wanted === 0 || car.health <= 0)) {
        vehicles.cars.splice(i, 1);
      }
    }
    if (state.wanted === 0) {
      cops.length = 0;
    }
    return 0;
  }

  /** Pay 'n Spray: repaint and lose the heat, for cash. */
  function clearWanted(state, cost) {
    if (state.wanted === 0 || state.cash < cost) return false;
    state.cash -= cost;
    state.wanted = 0;
    return true;
  }

  return { cops, addHeat, step, clearWanted };
}
