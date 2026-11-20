// Cars: arcade driving physics, traffic that follows the road grid, parked cars to
// steal, and the models and colours of Leonida Bay. A car is {x, y, angle, speed,
// color, model, health, kind, driver, ...}; kind is 'player' | 'traffic' | 'police'
// | 'parked' | 'mission'.
import { CAR, COLORS, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { isSand, isWater, nearestRoadPoint, randomRoadPointNear } from './city.js';

export const MODELS = [
  { name: 'Comet GT', color: '#e53238', top: 560, accel: 470 },
  { name: 'Sunrise Sedan', color: '#3a7ca5', top: 470, accel: 400 },
  { name: 'Bay Cruiser', color: '#f2c94c', top: 430, accel: 360 },
  { name: 'Palm Taxi', color: '#f2b705', top: 450, accel: 380, taxi: true },
  { name: 'Voodoo Van', color: '#8fc1a3', top: 400, accel: 330 },
  { name: 'Neon Coupe', color: '#ff2e88', top: 530, accel: 450 },
  { name: 'Dune Buggy', color: '#e07856', top: 460, accel: 420 },
  { name: 'Harbor Truck', color: '#7a7f8a', top: 380, accel: 300 },
];

const POLICE_COLORS = ['#1d2b53', '#1d2b53'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createVehicles(random, city) {
  const cars = [];
  let trafficTimer = 0;
  let parkedTimer = 0;

  function makeCar(x, y, angle, model, kind) {
    const car = {
      x, y, angle, speed: 0,
      model: model.name, color: model.color, top: model.top, accel: model.accel,
      health: CAR.health, kind, driver: kind === 'traffic' ? 'traffic' : null,
      // traffic AI state
      lane: 0, targetSpeed: 0, stuck: 0, turnAt: null,
      smoke: 0, skid: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnParked(x, y) {
    const spot = nearestRoadPoint(x, y);
    const angle = spot.vertical ? (random.next() < 0.5 ? 0 : Math.PI) : (random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const model = random.pick(MODELS.filter((m) => !m.taxi));
    return makeCar(spot.x + (spot.vertical ? 30 : 0), spot.y + (spot.vertical ? 0 : 30), angle, model, 'parked');
  }

  function spawnTrafficNear(px, py) {
    const spot = randomRoadPointNear(random, px, py, 700);
    if (!spot) return null;
    const angle = spot.vertical ? (random.next() < 0.5 ? 0 : Math.PI) : (random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const model = random.pick(MODELS);
    const car = makeCar(spot.x, spot.y, angle, model, 'traffic');
    car.lane = random.pick([-24, 24]);
    car.targetSpeed = random.range(130, 200);
    return car;
  }

  function spawnPoliceNear(px, py) {
    const spot = randomRoadPointNear(random, px, py, 620);
    if (!spot) return null;
    const model = { name: 'LCPD Interceptor', color: random.pick(POLICE_COLORS), top: 560, accel: 500 };
    const car = makeCar(spot.x, spot.y, Math.atan2(py - spot.y, px - spot.x), model, 'police');
    car.targetSpeed = 520;
    return car;
  }

  /** Arcade car physics: throttle, steering that bites with speed, drift on handbrake. */
  function drive(car, dt, throttle, steer, handbrake, cityRef) {
    // A wrecked car coasts to a stop and never accelerates again.
    if (car.health <= 0) throttle = 0;
    const top = car.top * (isSand(car.x, car.y) ? 0.45 : 1);
    if (throttle > 0) car.speed += car.accel * throttle * dt;
    else if (throttle < 0) {
      car.speed += car.speed > 10 ? -CAR.brake * dt : CAR.reverseAccel * throttle * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, top);
    const grip = handbrake ? 1.4 : CAR.turnRate;
    car.angle += steer * grip * dt * clamp(Math.abs(car.speed) / 160, 0, 1) * Math.sign(car.speed || 1);
    if (handbrake) car.skid = 0.5;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(nx, 30, WORLD.width - 30);
    car.y = clamp(ny, 30, WORLD.height - 30);
    if (isWater(car.x, car.y)) {
      car.x -= Math.cos(car.angle) * car.speed * dt;
      car.y -= Math.sin(car.angle) * car.speed * dt;
      car.speed *= -0.3;
    }
    if (cityRef) cityRef.collideCircle(car, CAR.width / 2 + 4);
    if (car.skid > 0) car.skid -= dt;
    if (car.health < 40) car.smoke = Math.max(car.smoke, 0.4);
    if (car.smoke > 0) car.smoke -= dt;
  }

  /** Traffic follows its road: straight until an intersection, then maybe turn. */
  function driveTraffic(car, dt, cityRef) {
    const ahead = { x: car.x + Math.cos(car.angle) * 70, y: car.y + Math.sin(car.angle) * 70 };
    let blocked = false;
    for (const other of cars) {
      if (other === car || !other) continue;
      if (Math.hypot(other.x - ahead.x, other.y - ahead.y) < 46) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.targetSpeed;
    const throttle = car.speed < target ? 1 : 0;
    // Lane keeping: nudge the angle toward the road direction.
    const onVertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
    const roadLine = onVertical
      ? ROADS_X.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a))
      : ROADS_Y.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a));
    const laneOffset = onVertical ? car.x - (roadLine + car.lane) : car.y - (roadLine + car.lane);
    const desired = onVertical ? (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(car.angle) >= 0 ? 0 : Math.PI);
    let steer = clamp(angleDiff(desired, car.angle) * 1.6 - laneOffset * 0.012, -1, 1);
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = ROADS_X.some((rx) => Math.abs(car.x - rx) < 52);
    const nearY = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 52);
    if (nearX && nearY && random.next() < dt * 0.5) {
      const turn = random.pick([-Math.PI / 2, Math.PI / 2]);
      car.angle += turn;
    }
    drive(car, dt, throttle, steer, false, cityRef);
    if (blocked) car.stuck += dt;
    else car.stuck = 0;
  }

  /** Keep the streets alive around (px, py): traffic in, far cars out. */
  function maintain(dt, px, py) {
    trafficTimer -= dt;
    parkedTimer -= dt;
    const traffic = cars.filter((c) => c.kind === 'traffic');
    if (trafficTimer <= 0) {
      trafficTimer = 1.1;
      if (traffic.length < 14) spawnTrafficNear(px, py);
    }
    if (parkedTimer <= 0) {
      parkedTimer = 2.5;
      const parked = cars.filter((c) => c.kind === 'parked');
      if (parked.length < 8) {
        const spot = randomRoadPointNear(random, px, py, 600);
        if (spot) spawnParked(spot.x, spot.y);
      }
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (car.kind === 'traffic' || car.kind === 'parked') {
        if (Math.hypot(car.x - px, car.y - py) > 1100 || car.health <= 0) cars.splice(i, 1);
      }
    }
  }

  /** Simple circle-vs-car collision between two cars; returns true on a hit. */
  function collideCars(a, b) {
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

  return { cars, makeCar, spawnParked, spawnTrafficNear, spawnPoliceNear, drive, driveTraffic, maintain, collideCars, angleDiff };
}
