// Cars: arcade driving, traffic that hops between intersections, parked cars
// to steal, and the models and colours of Marisol Bay. A car is
// {x, y, angle, speed, color, model, health, kind, driver, ...}; kind is
// 'traffic' | 'police' | 'parked' | 'job'.
import { CFG, angDiff, clampNum } from './tuning.js';
import { inSea, onSand, snapStreet, streetNear } from './city.js';

export const MODELS = [
  { name: 'Solara GT', color: '#2ec4b6', top: 565, accel: 480 },
  { name: 'Sunrise Sedan', color: '#3a7ca5', top: 475, accel: 410 },
  { name: 'Bay Cruiser', color: '#f2c94c', top: 435, accel: 365 },
  { name: 'Palm Cab', color: '#f2b705', top: 455, accel: 385, cab: true },
  { name: 'Voodoo Van', color: '#8fc1a3', top: 405, accel: 335 },
  { name: 'Neon Coupe', color: '#ff2e88', top: 535, accel: 455 },
  { name: 'Dune Buggy', color: '#e07856', top: 465, accel: 425 },
  { name: 'Harbor Truck', color: '#7a7f8a', top: 385, accel: 305 },
];

export function makeCars(rng, city) {
  const list = [];
  let trafficIn = 0;
  let parkedIn = 0;

  function add(x, y, angle, model, kind) {
    const car = {
      x, y, angle, speed: 0,
      model: model.name, color: model.color, top: model.top, accel: model.accel,
      health: CFG.car.health, kind,
      driver: kind === 'traffic' ? 'traffic' : null,
      // traffic AI: the intersection it is driving toward
      goal: null, cruise: 0, stuck: 0,
      smoke: 0, skid: 0, ramSide: 0,
      hornT: 0, // seconds left on a horn blast (lights + sound hook)
    };
    list.push(car);
    return car;
  }

  function park(x, y) {
    const spot = snapStreet(x, y);
    const angle = spot.vertical ? rng.from([0, Math.PI]) : rng.from([Math.PI / 2, -Math.PI / 2]);
    const model = rng.from(MODELS.filter((m) => !m.cab));
    return add(
      spot.x + (spot.vertical ? 30 : 0), spot.y + (spot.vertical ? 0 : 30),
      angle, model, 'parked',
    );
  }

  /** Pick a random intersection as a traffic car's next goal. */
  function nextGoal(car) {
    const gx = rng.from(CFG.streetsX);
    const gy = rng.from(CFG.streetsY);
    car.goal = { x: gx, y: gy };
  }

  /** No other car within `minDist` of this point — a spawn that overlaps a car
   *  wedges both of them to a crawl, so spawns must land on clear road. */
  function clearSpot(x, y, minDist) {
    return !list.some((c) => Math.hypot(c.x - x, c.y - y) < minDist);
  }

  function spawnTraffic(px, py) {
    for (let n = 0; n < 6; n += 1) {
      const spot = streetNear(rng, px, py, 700);
      if (!spot) return null;
      if (!clearSpot(spot.x, spot.y, 90)) continue;
      const angle = spot.vertical ? rng.from([0, Math.PI]) : rng.from([Math.PI / 2, -Math.PI / 2]);
      const car = add(spot.x, spot.y, angle, rng.from(MODELS), 'traffic');
      car.cruise = rng.range(130, 200);
      nextGoal(car);
      return car;
    }
    return null;
  }

  function spawnCruiser(px, py) {
    for (let n = 0; n < 8; n += 1) {
      const spot = streetNear(rng, px, py, 620);
      if (!spot) return null;
      // Never on top of the player, and never on top of another car.
      if (Math.hypot(spot.x - px, spot.y - py) < 140) continue;
      if (!clearSpot(spot.x, spot.y, 100)) continue;
      const model = { name: 'MPD Interceptor', color: '#14264d', top: 565, accel: 510 };
      const car = add(spot.x, spot.y, Math.atan2(py - spot.y, px - spot.x), model, 'police');
      car.cruise = 520;
      return car;
    }
    return null;
  }

  /**
   * Arcade driving: throttle builds speed with drag, steering bites harder
   * the faster the car goes, and the handbrake kills grip for a slide.
   */
  function drive(car, dt, throttle, steer, brake, cityRef) {
    if (car.health <= 0) throttle = 0; // a wreck coasts to a stop
    const top = car.top * (onSand(car.x, car.y) ? 0.45 : 1);
    if (throttle > 0) car.speed += car.accel * throttle * dt;
    else if (throttle < 0) {
      car.speed += car.speed > 10 ? -CFG.car.brake * dt : CFG.car.reverse * throttle * dt;
    }
    // Drag: the car always loses a little speed, more at the top end.
    car.speed -= car.speed * 0.22 * dt;
    if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    car.speed = clampNum(car.speed, -CFG.car.topBack, top);
    const grip = brake ? 1.5 : CFG.car.steer;
    const bite = clampNum(Math.abs(car.speed) / 170, 0, 1);
    car.angle += steer * grip * dt * bite * Math.sign(car.speed || 1);
    if (brake && Math.abs(car.speed) > 120) car.skid = 0.5;
    car.x = clampNum(car.x + Math.cos(car.angle) * car.speed * dt, 30, CFG.mapW - 30);
    car.y = clampNum(car.y + Math.sin(car.angle) * car.speed * dt, 30, CFG.mapH - 30);
    if (inSea(car.x, car.y)) {
      car.x -= Math.cos(car.angle) * car.speed * dt;
      car.y -= Math.sin(car.angle) * car.speed * dt;
      car.speed *= -0.3;
    }
    if (cityRef) cityRef.pushOut(car, 18);
    if (car.skid > 0) car.skid -= dt;
    if (car.hornT > 0) car.hornT -= dt;
    if (car.health < 40) car.smoke = Math.max(car.smoke, 0.4);
    if (car.smoke > 0) car.smoke -= dt;
  }

  /** Traffic drives toward its goal intersection, then picks another. */
  function driveTraffic(car, dt, cityRef) {
    if (!car.goal) nextGoal(car);
    const gx = car.goal.x;
    const gy = car.goal.y;
    const dx = gx - car.x;
    const dy = gy - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 60) {
      nextGoal(car);
      return;
    }
    // Slow for the car ahead.
    let blocked = false;
    const ax = car.x + Math.cos(car.angle) * 70;
    const ay = car.y + Math.sin(car.angle) * 70;
    for (const other of list) {
      if (other === car) continue;
      if (Math.hypot(other.x - ax, other.y - ay) < 46) { blocked = true; break; }
    }
    const wantAngle = Math.atan2(dy, dx);
    let steer = clampNum(angDiff(wantAngle, car.angle) * 2.0, -1, 1);
    // Keep to the right-hand lane of the street being followed.
    const vertical = Math.abs(Math.sin(wantAngle)) > Math.abs(Math.cos(wantAngle));
    if (vertical) steer += clampNum((car.x - (nearestLine(CFG.streetsX, car.x) + 24)) * -0.012, -0.4, 0.4);
    else steer += clampNum((car.y - (nearestLine(CFG.streetsY, car.y) + 24)) * -0.012, -0.4, 0.4);
    steer = clampNum(steer, -1, 1);
    const throttle = blocked ? 0 : (car.speed < car.cruise ? 1 : 0);
    drive(car, dt, throttle, steer, false, cityRef);
    if (blocked) car.stuck += dt;
    else car.stuck = 0;
  }

  function nearestLine(lines, v) {
    let best = lines[0];
    for (const l of lines) if (Math.abs(v - l) < Math.abs(v - best)) best = l;
    return best;
  }

  /** Keep the streets alive around (px, py): traffic in, far cars out. */
  function maintain(dt, px, py) {
    trafficIn -= dt;
    parkedIn -= dt;
    if (trafficIn <= 0) {
      trafficIn = 1.1;
      const n = list.filter((c) => c.kind === 'traffic').length;
      if (n < 14) spawnTraffic(px, py);
    }
    if (parkedIn <= 0) {
      parkedIn = 2.5;
      const n = list.filter((c) => c.kind === 'parked').length;
      if (n < 8) {
        const spot = streetNear(rng, px, py, 600);
        if (spot && clearSpot(spot.x, spot.y, 90)) park(spot.x, spot.y);
      }
    }
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const car = list[i];
      if ((car.kind === 'traffic' || car.kind === 'parked')
        && (Math.hypot(car.x - px, car.y - py) > 1100 || car.health <= 0)) {
        list.splice(i, 1);
      }
    }
  }

  /** Circle collision between two cars; returns true on a hit. */
  function bump(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const min = 44;
    if (dist >= min || dist === 0) return false;
    const push = (min - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    const impact = Math.abs(a.speed - b.speed);
    a.speed *= 0.6;
    b.speed *= 0.6;
    if (impact > 120) {
      a.health -= impact * 0.012;
      b.health -= impact * 0.012;
    }
    return true;
  }

  return { list, add, park, spawnTraffic, spawnCruiser, drive, driveTraffic, maintain, bump };
}
