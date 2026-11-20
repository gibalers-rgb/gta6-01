// The simulation: one state, one step. The player on foot or in a car, traffic,
// pedestrians, police, missions, taxi fares, pickups and the day clock — all wired
// together here, with no drawing and no browser in it. step() returns what happened
// as bit flags so the caller can react (sounds, screens, saves) without the world
// knowing about them.
import { CAR, DAY_LENGTH, PLACES, PLAYER, STEP, WORLD } from './config.js';
import { createCity, isOnRoad, isSand, isWater } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice, EVENT_BUSTED } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, MISSION_DEFS } from './missions.js';
import { loadSave } from './save.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED_FLAG = 2;
export const EVENT_MISSION_PASS = 4;
export const EVENT_MISSION_FAIL = 8;
export const EVENT_CASH = 16;
export const EVENT_SHOT = 32;
export const EVENT_PUNCH = 64;
export const EVENT_PICKUP = 128;

const PICKUP_SPOTS = [
  { x: PLACES.hospital.x + 40, y: PLACES.hospital.y, kind: 'health' },
  { x: PLACES.diner.x - 60, y: PLACES.diner.y, kind: 'armor' },
  { x: PLACES.beach.x, y: PLACES.beach.y + 80, kind: 'health' },
  { x: PLACES.port.x, y: PLACES.port.y - 80, kind: 'armor' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createWorld(random) {
  const city = createCity(random);
  const vehicles = createVehicles(random, city);
  const peds = createPedestrians(random, city);
  const police = createPolice(random, vehicles);
  const combat = createCombat();
  const missions = createMissions();

  const player = {
    x: PLACES.safehouse.x, y: PLACES.safehouse.y, angle: -Math.PI / 2,
    health: PLAYER.health, armor: 0,
    inCar: false, car: null, weapon: 'fists', ammo: 0,
    punchCooldown: 0, aimAngle: 0, speed: 0, moving: false,
  };

  const state = {
    city, vehicles, peds, police, combat, missions,
    player,
    cash: 0, earned: 0, wanted: 0,
    time: 10 * 3600, // 10:00 in the morning
    elapsed: 0,
    cam: { x: player.x, y: player.y },
    pickups: PICKUP_SPOTS.map((p) => ({ ...p, taken: false, timer: 0 })),
    missionCar: null, // the car a mission is about (m2 steal, m6 Vic)
    thugs: [], // hostile peds a mission spawned
    objectiveSpawned: false,
    sprayCooldown: 0,
  };

  function reset() {
    const save = loadSave();
    player.x = PLACES.safehouse.x;
    player.y = PLACES.safehouse.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.armor = 0;
    player.inCar = false;
    player.car = null;
    player.weapon = 'fists';
    player.ammo = 0;
    player.punchCooldown = 0;
    state.cash = save ? save.cash : 0;
    state.earned = save ? save.earned : 0;
    state.wanted = 0;
    state.time = 10 * 3600;
    state.elapsed = 0;
    state.missionCar = null;
    state.thugs = [];
    state.objectiveSpawned = false;
    vehicles.cars.length = 0;
    peds.peds.length = 0;
    combat.bullets.length = 0;
    combat.particles.length = 0;
    combat.floaters.length = 0;
    city.packages.forEach((p, i) => {
      p.taken = save ? save.packages.includes(i) : false;
    });
    state.pickups.forEach((p) => { p.taken = false; p.timer = 0; });
    missions.startMission(save ? Math.min(save.missionIndex, MISSION_DEFS.length) : 0);
    if (save && save.missionIndex >= MISSION_DEFS.length) missions.state.complete = true;
    // A few parked cars and walkers near the safehouse so the street is alive.
    for (let i = 0; i < 4; i += 1) vehicles.spawnParked(player.x + random.range(-260, 260), player.y + random.range(-260, 260));
    for (let i = 0; i < 8; i += 1) peds.spawnNear(player.x, player.y);
    activateObjective();
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of vehicles.cars) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (!car) return;
    if (car.kind === 'traffic' || car.kind === 'parked') {
      police.addHeat(state, 1);
    } else if (car.kind === 'police') {
      police.addHeat(state, 2);
    }
    car.driver = 'player';
    player.inCar = true;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    car.driver = null;
    player.inCar = false;
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
    if (isWater(player.x, player.y) || city.blocked(player.x, player.y, 14)) {
      player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 40;
      player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 40;
    }
  }

  function spawnThugs(x, y, count) {
    state.thugs = [];
    for (let i = 0; i < count; i += 1) {
      const ped = peds.spawnNear(x, y, 'walk');
      if (!ped) continue;
      ped.x = x + random.range(-90, 90);
      ped.y = y + random.range(-90, 90);
      ped.thug = true;
      ped.hostile = true;
      ped.health = 100;
      ped.state = 'walk';
      ped.color = '#5b2d8e';
      state.thugs.push(ped);
    }
  }

  function spawnMissionCar(modelName, x, y, flee) {
    const model = { name: modelName, color: modelName === 'Comet GT' ? '#e53238' : '#1d1d24', top: 520, accel: 460 };
    const car = vehicles.makeCar(x, y, 0, model, 'mission');
    car.flee = !!flee;
    state.missionCar = car;
    return car;
  }

  /** Set up whatever the current objective needs (cars, thugs, wanted level). */
  function activateObjective() {
    const mission = missions.current();
    const obj = missions.objective();
    state.objectiveSpawned = true;
    if (!mission || !obj) return;
    if (obj.wanted) state.wanted = Math.max(state.wanted, obj.wanted);
    if (mission.id === 'm1' && missions.state.objective === 0) {
      const taxi = vehicles.makeCar(PLACES.safehouse.x + 40, PLACES.safehouse.y, Math.PI / 2, { name: 'Palm Taxi', color: '#f2b705', top: 450, accel: 380 }, 'parked');
      taxi.taxi = true;
    }
    if (mission.id === 'm2' && missions.state.objective === 0) {
      spawnMissionCar('Comet GT', PLACES.beachLot.x, PLACES.beachLot.y, false);
    }
    if (mission.id === 'm3' && missions.state.objective === 0) {
      // Rook left a pistol in the glovebox: the brawl is fought armed, as the
      // briefing promises. (The mission reward tops the ammo up again.)
      player.weapon = 'pistol';
      player.ammo += 24;
    }
    if (mission.id === 'm3' && missions.state.objective === 1) {
      spawnThugs(PLACES.beach.x, PLACES.beach.y, 5);
      state.missions.state.defeated = 0;
    }
    if (mission.id === 'm6' && missions.state.objective === 1) {
      spawnMissionCar("Vic's Vulture", PLACES.downtown.x + 60, PLACES.downtown.y, true);
      state.missions.state.defeated = 0;
    }
    if (mission.id === 'm6' && missions.state.objective === 2) {
      spawnThugs(PLACES.downtown.x, PLACES.downtown.y, 4);
      state.missions.state.defeated = 0;
    }
  }

  function damagePlayer(amount) {
    let left = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, left);
      player.armor -= absorbed;
      left -= absorbed;
    }
    player.health -= left;
  }

  function stepPlayerOnFoot(dt, input, actions) {
    const move = input.move();
    const len = Math.hypot(move.x, move.y) || 1;
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.moving = move.x !== 0 || move.y !== 0;
    player.speed = player.moving ? speed : 0;
    if (player.moving) {
      player.angle = Math.atan2(move.y / len, move.x / len);
      const nx = player.x + (move.x / len) * speed * dt;
      const ny = player.y + (move.y / len) * speed * dt;
      if (!isWater(nx, player.y) && !city.blocked(nx, player.y, PLAYER.radius)) player.x = nx;
      if (!isWater(player.x, ny) && !city.blocked(player.x, ny, PLAYER.radius)) player.y = ny;
      player.x = clamp(player.x, 20, WORLD.width - 20);
      player.y = clamp(player.y, 20, WORLD.height - 20);
    }
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    // Aim follows the mouse; click (or Space) shoots / punches.
    const mouse = input.mouse();
    if (mouse && state.cam.scale) {
      const wx = state.cam.x + (mouse.x - state.cam.screenW / 2) / state.cam.scale;
      const wy = state.cam.y + (mouse.y - state.cam.screenH / 2) / state.cam.scale;
      player.aimAngle = Math.atan2(wy - player.y, wx - player.x);
    }
    if (actions & 8 /* ACTION_PUNCH */ || input.takeClick()) {
      if (player.weapon === 'pistol' && player.ammo > 0) {
        player.ammo -= 1;
        combat.shoot(player.x, player.y, player.aimAngle, true);
        return EVENT_SHOT;
      }
      if (player.punchCooldown <= 0) {
        player.punchCooldown = PLAYER.punchCooldown;
        const targets = [...state.thugs, ...peds.peds];
        const hit = combat.punch(player.x, player.y, player.aimAngle, targets);
        if (hit && hit.thug && hit.health <= 0) {
          // Only a kill counts toward the defeat objective, not every landed hit.
          state.missions.state.defeated += 1;
        }
        return EVENT_PUNCH;
      }
    }
    return 0;
  }

  function stepThugs(dt) {
    for (const thug of state.thugs) {
      if (!thug.hostile || thug.health <= 0 || thug.state === 'down') continue;
      const dist = Math.hypot(player.x - thug.x, player.y - thug.y);
      if (dist < 420) {
        thug.angle = Math.atan2(player.y - thug.y, player.x - thug.x);
        const speed = player.inCar ? 0 : 150;
        const nx = thug.x + Math.cos(thug.angle) * speed * dt;
        const ny = thug.y + Math.sin(thug.angle) * speed * dt;
        if (!city.blocked(nx, ny, 10) && !isWater(nx, ny)) {
          thug.x = nx;
          thug.y = ny;
        }
        if (dist < 30 && !player.inCar) {
          thug.punchTimer = (thug.punchTimer || 0) - dt;
          if (thug.punchTimer <= 0) {
            thug.punchTimer = 1.2;
            damagePlayer(8);
          }
        }
      }
    }
  }

  function stepMissionCar(dt) {
    const car = state.missionCar;
    if (!car || car.kind !== 'mission' || !car.flee) return;
    // Vic flees: steer away from the player, flat out.
    const away = Math.atan2(car.y - player.y, car.x - player.x);
    const steer = clamp(((away - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    vehicles.drive(car, dt, 1, steer, false, city);
  }

  function checkObjectives() {
    const mission = missions.current();
    const obj = missions.objective();
    if (!mission || !obj) return 0;
    const px = player.x;
    const py = player.y;
    const dist = Math.hypot(px - obj.x, py - obj.y);
    switch (obj.type) {
      case 'enter':
        if (player.inCar) return advance();
        break;
      case 'goto':
      case 'deliver':
        if (dist < obj.radius) return advance();
        break;
      case 'steal':
        if (player.inCar && player.car === state.missionCar) return advance();
        break;
      case 'collect':
        if (dist < obj.radius) return advance();
        break;
      case 'defeat':
        if (missions.state.defeated >= obj.count) return advance();
        break;
      case 'ram':
        if (state.missionCar && state.missionCar.health <= 0) return advance();
        break;
      default:
        break;
    }
    return 0;
  }

  function advance() {
    const result = missions.nextObjective();
    state.objectiveSpawned = false;
    if (result === 'complete') {
      const mission = MISSION_DEFS[missions.state.index];
      state.cash += mission.reward;
      state.earned += mission.reward;
      if (mission.id === 'm3') {
        player.weapon = 'pistol';
        player.ammo += 24;
      }
      missions.state.index += 1;
      missions.state.objective = 0;
      missions.state.defeated = 0;
      missions.state.timer = 0;
      if (missions.state.index < MISSION_DEFS.length) activateObjective();
      return EVENT_MISSION_PASS;
    }
    activateObjective();
    return 0;
  }

  function stepTaxi(dt) {
    const taxi = missions.state.taxi;
    if (!taxi) return 0;
    taxi.timeLeft -= dt;
    const dist = Math.hypot(player.x - taxi.to.x, player.y - taxi.to.y);
    if (dist < 70) {
      state.cash += taxi.fare;
      state.earned += taxi.fare;
      combat.floater(player.x, player.y - 30, `+$${taxi.fare}`, '#7ac74f');
      missions.state.taxi = null;
      return EVENT_CASH;
    }
    if (taxi.timeLeft <= 0) {
      missions.state.taxi = null;
    }
    return 0;
  }

  /** One fixed step. `input` is the live input; `actions` the one-shot flags. */
  function step(dt, input, actions) {
    let events = 0;
    state.elapsed += dt;
    state.time = (state.time + dt * (86400 / DAY_LENGTH)) % 86400;

    // Enter / exit cars.
    if (actions & 4 /* ACTION_ENTER */) {
      if (player.inCar) {
        exitCar();
      } else {
        const nearTaxi = peds.peds.find((p) => p.state === 'taxi' && Math.hypot(p.x - player.x, p.y - player.y) < 46);
        const car = nearestCar(player.x, player.y, 78);
        if (car) enterCar(car);
        else if (nearTaxi && !missions.state.taxi) {
          const dest = random.pick([PLACES.diner, PLACES.beach, PLACES.downtown, PLACES.port, PLACES.hospital]);
          const dist = Math.hypot(dest.x - player.x, dest.y - player.y);
          const fare = 40 + Math.round(dist / 40);
          missions.startTaxi({ x: player.x, y: player.y }, dest, fare, dist / 300 + 18);
          nearTaxi.state = 'walk';
        }
      }
    }

    // Move the player.
    if (player.inCar && player.car) {
      vehicles.drive(player.car, dt, input.throttle(), input.steer(), input.handbrake(), city);
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
      player.speed = Math.abs(player.car.speed);
      if (input.takeClick()) {
        // Honk / drive-by is not wired; a click while driving does nothing.
      }
    } else {
      events |= stepPlayerOnFoot(dt, input, actions);
    }

    // Traffic, pedestrians, police.
    vehicles.maintain(dt, player.x, player.y);
    for (const car of vehicles.cars) {
      if (car.kind === 'traffic') vehicles.driveTraffic(car, dt, city);
      else if (car.kind === 'police') { /* driven by police.step */ }
    }
    for (let i = 0; i < vehicles.cars.length; i += 1) {
      for (let j = i + 1; j < vehicles.cars.length; j += 1) {
        vehicles.collideCars(vehicles.cars[i], vehicles.cars[j]);
      }
    }
    // Car vs pedestrian: running someone over is a crime.
    for (const car of vehicles.cars) {
      if (Math.abs(car.speed) < 120) continue;
      for (const ped of peds.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34) {
          ped.state = 'down';
          ped.health = 0;
          combat.burst(ped.x, ped.y, 6, '#ff5d5d', 200);
          if (car.driver === 'player') police.addHeat(state, 1);
        }
      }
    }
    peds.step(dt, player.x, player.y, player.weapon === 'pistol' ? { x: player.x, y: player.y } : null);
    stepThugs(dt);
    stepMissionCar(dt);
    const policeEvent = police.step(dt, state, player, city);
    if (policeEvent & EVENT_BUSTED) events |= EVENT_BUSTED_FLAG;

    // Bullets: friendly ones hit thugs/peds/cops, hostile ones hit the player.
    combat.step(dt, city, (x, y) => {
      for (const thug of state.thugs) {
        if (thug.health > 0 && thug.state !== 'down' && Math.hypot(thug.x - x, thug.y - y) < 16) {
          thug.health -= 34;
          if (thug.health <= 0) {
            thug.state = 'down';
            missions.state.defeated += 1;
            police.addHeat(state, 1);
          }
          return true;
        }
      }
      for (const ped of peds.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 14) {
          ped.state = 'down';
          ped.health = 0;
          police.addHeat(state, 1);
          return true;
        }
      }
      for (const car of vehicles.cars) {
        if (car.kind === 'police' && Math.hypot(car.x - x, car.y - y) < 30) {
          car.health -= 20;
          police.addHeat(state, 1);
          return true;
        }
      }
      if (state.missionCar && Math.hypot(state.missionCar.x - x, state.missionCar.y - y) < 30) {
        state.missionCar.health -= 20;
        return true;
      }
      return false;
    }, (x, y) => {
      if (!player.inCar && Math.hypot(player.x - x, player.y - y) < 16) {
        damagePlayer(12);
        return true;
      }
      return false;
    });

    // Hidden packages and pickups.
    for (let i = 0; i < city.packages.length; i += 1) {
      const pkg = city.packages[i];
      if (!pkg.taken && Math.hypot(pkg.x - player.x, pkg.y - player.y) < 32) {
        pkg.taken = true;
        state.cash += 50;
        state.earned += 50;
        combat.floater(pkg.x, pkg.y - 24, '+$50 package', '#ffd23e');
        events |= EVENT_PICKUP;
      }
    }
    for (const pickup of state.pickups) {
      if (pickup.taken) {
        pickup.timer -= dt;
        if (pickup.timer <= 0) pickup.taken = false;
        continue;
      }
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 34 && !player.inCar) {
        pickup.taken = true;
        pickup.timer = 45;
        if (pickup.kind === 'health') player.health = Math.min(PLAYER.health, player.health + 50);
        else player.armor = Math.min(100, player.armor + 50);
        events |= EVENT_PICKUP;
      }
    }

    // Pay 'n Spray: drive through to lose the heat for $100.
    if (state.sprayCooldown > 0) state.sprayCooldown -= dt;
    if (player.inCar && state.wanted > 0 && state.sprayCooldown <= 0) {
      const d = Math.hypot(player.x - PLACES.spray.x, player.y - PLACES.spray.y);
      if (d < 80) {
        if (police.clearWanted(state, 100)) {
          state.sprayCooldown = 5;
          combat.floater(player.x, player.y - 40, 'Clean getaway -$100', '#22d3ee');
          events |= EVENT_CASH;
        }
      }
    }

    // A wrecked mission car fails the mission that needs it.
    const activeMission = missions.current();
    if (activeMission && (activeMission.id === 'm2' || activeMission.id === 'm6')
      && state.missionCar && state.missionCar.health <= 0 && !missions.state.failed) {
      missions.fail('Your ride was wrecked');
      events |= EVENT_MISSION_FAIL;
    }

    // Mission timer and objectives.
    const mission = missions.current();
    if (mission && mission.timeLimit && !missions.state.failed) {
      missions.state.timer -= dt;
      if (missions.state.timer <= 0) {
        missions.fail('Out of time');
        events |= EVENT_MISSION_FAIL;
      }
    }
    if (mission && !missions.state.failed) {
      events |= checkObjectives();
    }
    events |= stepTaxi(dt);

    // Camera follows the player.
    state.cam.x = clamp(player.x, 0, WORLD.width);
    state.cam.y = clamp(player.y, 0, WORLD.height);

    // Wasted: no health left.
    if (player.health <= 0) {
      events |= EVENT_WASTED;
    }
    return events;
  }

  /** After Wasted/Busted: respawn, lose some cash, fail the active mission. */
  function respawn(busted) {
    if (missions.current() && !missions.state.failed) missions.fail(busted ? 'Busted' : 'Wasted');
    state.cash = Math.max(0, state.cash - (busted ? 100 : Math.floor(state.cash / 2)));
    state.wanted = 0;
    player.health = PLAYER.health;
    player.armor = 0;
    player.inCar = false;
    player.car = null;
    player.x = busted ? PLACES.downtown.x : PLACES.hospital.x;
    player.y = busted ? PLACES.downtown.y : PLACES.hospital.y;
    player.angle = -Math.PI / 2;
    state.thugs = [];
    // Restart the failed mission from its first objective.
    if (missions.current()) {
      missions.startMission(missions.state.index);
      activateObjective();
    }
  }

  reset();
  return { state, player, reset, step, respawn, nearestCar, enterCar, exitCar, activateObjective };
}
