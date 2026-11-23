// The simulation, in phases: one state, one tick. The hero on foot or in a
// car, traffic, walkers, police, jobs, taxi fares, pickups and the day clock
// — all wired together here, with no drawing and no browser in it. Each tick
// returns the list of things that happened ('shot', 'cash', 'job-done', ...)
// so the caller can react (sounds, screens, saves) without the world knowing
// about them.
import { CFG, SPOTS, clampNum } from './tuning.js';
import { buildCity, inSea } from './city.js';
import { makeCars } from './cars.js';
import { makeWalkers } from './walkers.js';
import { EV_BUSTED, makeCops } from './cops.js';
import { makeFight } from './fight.js';
import { JOBS, makeJobs } from './story.js';
import { readSave } from './save.js';

const LOOT = [
  { x: SPOTS.hospital.x + 40, y: SPOTS.hospital.y, kind: 'health' },
  { x: SPOTS.diner.x - 60, y: SPOTS.diner.y, kind: 'armor' },
  { x: SPOTS.boardwalk.x, y: SPOTS.boardwalk.y + 80, kind: 'health' },
  { x: SPOTS.docks.x, y: SPOTS.docks.y - 80, kind: 'armor' },
  { x: SPOTS.garage.x - 60, y: SPOTS.garage.y, kind: 'ammo' },
  { x: SPOTS.warehouse.x + 60, y: SPOTS.warehouse.y, kind: 'ammo' },
];

export function makeWorld(rng) {
  const city = buildCity(rng);
  const cars = makeCars(rng, city);
  const people = makeWalkers(rng, city);
  const police = makeCops(rng, cars);
  const fx = makeFight();
  const jobs = makeJobs();

  const hero = {
    x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, angle: -Math.PI / 2,
    health: CFG.hero.health, armor: 0,
    inCar: false, car: null, weapon: 'fists', ammo: 0,
    fistT: 0, aim: 0, speed: 0, moving: false,
  };

  const state = {
    city, cars, people, police, fx, jobs,
    hero,
    cash: 0, earned: 0, wanted: 0,
    time: 10 * 3600, // 10:00 in the morning
    elapsed: 0,
    cam: { x: hero.x, y: hero.y },
    loot: LOOT.map((p) => ({ ...p, taken: false, timer: 0 })),
    jobCar: null, // the car a job is about (j2 steal, j6 Silas)
    sharks: [], // hostile walkers a job spawned
    sprayT: 0,
    repairT: 0, // cooldown between garage repairs
    prevWanted: 0, // wanted level before this tick (for the evade bonus)
  };

  function reset() {
    const save = readSave();
    Object.assign(hero, {
      x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, angle: -Math.PI / 2,
      health: CFG.hero.health, armor: 0,
      inCar: false, car: null, weapon: 'fists', ammo: 0, fistT: 0,
    });
    state.cash = save ? save.cash : 0;
    state.earned = save ? save.earned : 0;
    state.wanted = 0;
    state.prevWanted = 0;
    state.time = 10 * 3600;
    state.elapsed = 0;
    state.jobCar = null;
    state.sharks = [];
    state.sprayT = 0;
    state.repairT = 0;
    cars.list.length = 0;
    people.list.length = 0;
    fx.shots.length = 0;
    fx.sparks.length = 0;
    fx.notes.length = 0;
    fx.skids.length = 0;
    city.packages.forEach((p, i) => {
      p.taken = save ? save.pkgs.includes(i) : false;
    });
    state.loot.forEach((p) => { p.taken = false; p.timer = 0; });
    jobs.start(save ? Math.min(save.job, JOBS.length) : 0);
    if (save && save.job >= JOBS.length) jobs.state.done = true;
    // A few parked cars and walkers near the safehouse so the street is alive.
    for (let i = 0; i < 4; i += 1) {
      cars.park(hero.x + rng.range(-260, 260), hero.y + rng.range(-260, 260));
    }
    for (let i = 0; i < 8; i += 1) people.spawnNear(hero.x, hero.y);
    armStep();
  }

  function closestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of cars.list) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function getIn(car) {
    if (!car) return;
    if (car.kind === 'traffic' || car.kind === 'parked') police.addHeat(state, 1);
    else if (car.kind === 'police') police.addHeat(state, 2);
    car.driver = 'hero';
    hero.inCar = true;
    hero.car = car;
    hero.x = car.x;
    hero.y = car.y;
  }

  function getOut() {
    const car = hero.car;
    if (!car) return;
    car.driver = null;
    hero.inCar = false;
    hero.car = null;
    hero.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    hero.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    hero.angle = car.angle;
    if (inSea(hero.x, hero.y) || city.blocked(hero.x, hero.y, 14)) {
      hero.x = car.x - Math.cos(car.angle + Math.PI / 2) * 40;
      hero.y = car.y - Math.sin(car.angle + Math.PI / 2) * 40;
    }
  }

  /** Horn (H while driving): the car blasts, nearby walkers turn to look. */
  function honk() {
    if (!hero.inCar || !hero.car) return false;
    hero.car.hornT = 0.6;
    people.lookAt(hero.x, hero.y, 260);
    return true;
  }

  function spawnSharks(x, y, count) {
    state.sharks = [];
    for (let i = 0; i < count; i += 1) {
      const w = people.spawnNear(x, y, 'stroll');
      if (!w) continue;
      w.x = x + rng.range(-90, 90);
      w.y = y + rng.range(-90, 90);
      w.shark = true;
      w.hostile = true;
      w.health = 100;
      w.mode = 'stroll';
      w.color = '#1f6f54';
      state.sharks.push(w);
    }
  }

  function spawnJobCar(name, x, y, flees) {
    const model = { name, color: name === 'Solara GT' ? '#2ec4b6' : '#14141c', top: 525, accel: 465 };
    const car = cars.add(x, y, 0, model, 'job');
    car.flees = !!flees;
    state.jobCar = car;
    return car;
  }

  /** Set up whatever the current step needs (cars, sharks, wanted level). */
  function armStep() {
    const job = jobs.current();
    const step = jobs.step();
    if (!job || !step) return;
    if (step.heat) state.wanted = Math.max(state.wanted, step.heat);
    if (job.id === 'j1' && jobs.state.step === 0) {
      const cab = cars.add(SPOTS.safehouse.x + 40, SPOTS.safehouse.y, Math.PI / 2,
        { name: 'Palm Cab', color: '#f2b705', top: 455, accel: 385 }, 'parked');
      cab.cab = true;
    }
    if (job.id === 'j2' && jobs.state.step === 0) {
      spawnJobCar('Solara GT', SPOTS.marina.x, SPOTS.marina.y, false);
    }
    if (job.id === 'j3' && jobs.state.step === 0) {
      // Eddie left a pistol in the glovebox: the brawl is fought armed, as the
      // briefing promises. (The job reward tops the ammo up again.)
      hero.weapon = 'pistol';
      hero.ammo += 24;
    }
    if (job.id === 'j3' && jobs.state.step === 1) {
      spawnSharks(SPOTS.boardwalk.x, SPOTS.boardwalk.y, 5);
      jobs.state.beaten = 0;
    }
    if (job.id === 'j6' && jobs.state.step === 1) {
      spawnJobCar("Silas's Phantom", SPOTS.downtown.x + 60, SPOTS.downtown.y, true);
      jobs.state.beaten = 0;
    }
    if (job.id === 'j6' && jobs.state.step === 2) {
      spawnSharks(SPOTS.downtown.x, SPOTS.downtown.y, 4);
      jobs.state.beaten = 0;
    }
  }

  function hurtHero(amount) {
    let left = amount;
    if (hero.armor > 0) {
      const soak = Math.min(hero.armor, left);
      hero.armor -= soak;
      left -= soak;
    }
    hero.health -= left;
  }

  // ---- phases -------------------------------------------------------------

  function phaseEnterExit(actions) {
    if (!actions.has('enter')) return;
    if (hero.inCar) {
      getOut();
      return;
    }
    const car = closestCar(hero.x, hero.y, 78);
    if (car) {
      getIn(car);
      return;
    }
    const fare = people.list.find((p) => p.mode === 'fare' && Math.hypot(p.x - hero.x, p.y - hero.y) < 46);
    if (fare && !jobs.state.fare) {
      const dest = rng.from([SPOTS.diner, SPOTS.boardwalk, SPOTS.downtown, SPOTS.docks, SPOTS.hospital]);
      const dist = Math.hypot(dest.x - hero.x, dest.y - hero.y);
      jobs.startFare({ x: hero.x, y: hero.y }, dest, 40 + Math.round(dist / 40), dist / 300 + 18);
      fare.mode = 'stroll';
    }
  }

  function phaseHero(dt, input) {
    if (hero.inCar && hero.car) {
      const wasSkid = hero.car.skid;
      cars.drive(hero.car, dt, input.throttle(), input.steer(), input.handbrake(), city);
      if (hero.car.skid > 0 && wasSkid <= 0) fx.skidMark(hero.car.x, hero.car.y, hero.car.angle);
      hero.x = hero.car.x;
      hero.y = hero.car.y;
      hero.angle = hero.car.angle;
      hero.speed = Math.abs(hero.car.speed);
      input.takeClick(); // a click while driving does nothing
      return [];
    }
    const events = [];
    const v = input.moveVec();
    const len = Math.hypot(v.x, v.y) || 1;
    const speed = input.sprinting() ? CFG.hero.sprint : CFG.hero.walk;
    hero.moving = v.x !== 0 || v.y !== 0;
    hero.speed = hero.moving ? speed : 0;
    if (hero.moving) {
      hero.angle = Math.atan2(v.y / len, v.x / len);
      const nx = hero.x + (v.x / len) * speed * dt;
      const ny = hero.y + (v.y / len) * speed * dt;
      if (!inSea(nx, hero.y) && !city.blocked(nx, hero.y, CFG.hero.radius)) hero.x = nx;
      if (!inSea(hero.x, ny) && !city.blocked(hero.x, ny, CFG.hero.radius)) hero.y = ny;
      hero.x = clampNum(hero.x, 20, CFG.mapW - 20);
      hero.y = clampNum(hero.y, 20, CFG.mapH - 20);
    }
    if (hero.fistT > 0) hero.fistT -= dt;
    // Aim follows the pointer; click (or Space) shoots / punches.
    const pointer = input.pointer();
    if (pointer && state.cam.scale) {
      const wx = state.cam.x + (pointer.x - state.cam.screenW / 2) / state.cam.scale;
      const wy = state.cam.y + (pointer.y - state.cam.screenH / 2) / state.cam.scale;
      hero.aim = Math.atan2(wy - hero.y, wx - hero.x);
    }
    if (input.takeClick()) {
      if (hero.weapon === 'pistol' && hero.ammo > 0) {
        hero.ammo -= 1;
        fx.fire(hero.x, hero.y, hero.aim, true);
        events.push('shot');
      } else if (hero.fistT <= 0) {
        hero.fistT = CFG.hero.fistDelay;
        const hit = fx.punch(hero.x, hero.y, hero.aim, [...state.sharks, ...people.list]);
        if (hit && hit.shark && hit.health <= 0) jobs.state.beaten += 1;
        events.push('punch');
      }
    }
    return events;
  }

  function phaseStreets(dt) {
    cars.maintain(dt, hero.x, hero.y);
    for (const car of cars.list) {
      if (car.kind === 'traffic') cars.driveTraffic(car, dt, city);
    }
    for (let i = 0; i < cars.list.length; i += 1) {
      for (let j = i + 1; j < cars.list.length; j += 1) {
        cars.bump(cars.list[i], cars.list[j]);
      }
    }
    // Car vs walker: running someone over is a crime.
    for (const car of cars.list) {
      if (Math.abs(car.speed) < 120) continue;
      for (const w of people.list) {
        if (w.mode === 'down') continue;
        if (Math.hypot(w.x - car.x, w.y - car.y) < 34) {
          w.mode = 'down';
          w.health = 0;
          fx.burst(w.x, w.y, 6, '#ff5d5d', 200);
          if (car.driver === 'hero') police.addHeat(state, 1);
        }
      }
    }
    people.step(dt, hero.x, hero.y, hero.weapon === 'pistol' ? { x: hero.x, y: hero.y } : null);
    // Sharks close in and swing at the hero.
    for (const shark of state.sharks) {
      if (!shark.hostile || shark.health <= 0 || shark.mode === 'down') continue;
      const d = Math.hypot(hero.x - shark.x, hero.y - shark.y);
      if (d > 420) continue;
      shark.angle = Math.atan2(hero.y - shark.y, hero.x - shark.x);
      const speed = hero.inCar ? 0 : 150;
      const nx = shark.x + Math.cos(shark.angle) * speed * dt;
      const ny = shark.y + Math.sin(shark.angle) * speed * dt;
      if (!city.blocked(nx, ny, 10) && !inSea(nx, ny)) {
        shark.x = nx;
        shark.y = ny;
      }
      if (d < 30 && !hero.inCar) {
        shark.swingT = (shark.swingT || 0) - dt;
        if (shark.swingT <= 0) {
          shark.swingT = 1.2;
          hurtHero(8);
        }
      }
    }
    // Silas flees: steer away from the hero, flat out.
    const jc = state.jobCar;
    if (jc && jc.kind === 'job' && jc.flees) {
      const away = Math.atan2(jc.y - hero.y, jc.x - hero.x);
      const steer = clampNum(((away - jc.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
      cars.drive(jc, dt, 1, steer, false, city);
    }
  }

  function phaseCombat(dt) {
    fx.tick(dt, city, (x, y) => {
      for (const shark of state.sharks) {
        if (shark.health > 0 && shark.mode !== 'down' && Math.hypot(shark.x - x, shark.y - y) < 16) {
          shark.health -= 34;
          if (shark.health <= 0) {
            shark.mode = 'down';
            jobs.state.beaten += 1;
            police.addHeat(state, 1);
          }
          return true;
        }
      }
      for (const w of people.list) {
        if (w.mode !== 'down' && Math.hypot(w.x - x, w.y - y) < 14) {
          w.mode = 'down';
          w.health = 0;
          police.addHeat(state, 1);
          return true;
        }
      }
      for (const car of cars.list) {
        if (car.kind === 'police' && Math.hypot(car.x - x, car.y - y) < 30) {
          car.health -= 20;
          police.addHeat(state, 1);
          return true;
        }
      }
      if (state.jobCar && Math.hypot(state.jobCar.x - x, state.jobCar.y - y) < 30) {
        state.jobCar.health -= 20;
        return true;
      }
      return false;
    }, (x, y) => {
      if (!hero.inCar && Math.hypot(hero.x - x, hero.y - y) < 16) {
        hurtHero(12);
        return true;
      }
      return false;
    });
  }

  function phaseLoot(dt) {
    const events = [];
    for (let i = 0; i < city.packages.length; i += 1) {
      const pkg = city.packages[i];
      if (!pkg.taken && Math.hypot(pkg.x - hero.x, pkg.y - hero.y) < 32) {
        pkg.taken = true;
        state.cash += 50;
        state.earned += 50;
        fx.note(pkg.x, pkg.y - 24, '+$50 package', '#ffd23e');
        events.push('pickup');
      }
    }
    for (const item of state.loot) {
      if (item.taken) {
        item.timer -= dt;
        if (item.timer <= 0) item.taken = false;
        continue;
      }
      if (Math.hypot(item.x - hero.x, item.y - hero.y) < 34 && !hero.inCar) {
        item.taken = true;
        item.timer = 45;
        if (item.kind === 'health') hero.health = Math.min(CFG.hero.health, hero.health + 50);
        else if (item.kind === 'armor') hero.armor = Math.min(100, hero.armor + 50);
        else if (item.kind === 'ammo') {
          if (hero.weapon === 'fists') hero.weapon = 'pistol';
          hero.ammo += 24;
          fx.note(hero.x, hero.y - 30, '+24 ammo', '#ffd23e');
        }
        events.push('pickup');
      }
    }
    // Spray 'n Go: drive through to lose the heat for $100.
    if (state.sprayT > 0) state.sprayT -= dt;
    if (hero.inCar && state.wanted > 0 && state.sprayT <= 0) {
      const d = Math.hypot(hero.x - SPOTS.spray.x, hero.y - SPOTS.spray.y);
      if (d < 80 && police.clearHeat(state, CFG.sprayCost)) {
        state.sprayT = 5;
        fx.note(hero.x, hero.y - 40, 'Clean getaway -$100', '#22d3ee');
        events.push('cash');
      }
    }
    // Eddie's Garage: drive a battered car in and it comes out fixed, $50.
    if (state.repairT > 0) state.repairT -= dt;
    if (hero.inCar && hero.car && hero.car.health < CFG.car.health && state.repairT <= 0) {
      const d = Math.hypot(hero.x - SPOTS.garage.x, hero.y - SPOTS.garage.y);
      if (d < 90 && state.cash >= CFG.repairCost) {
        state.cash -= CFG.repairCost;
        hero.car.health = CFG.car.health;
        hero.car.smoke = 0;
        state.repairT = 5;
        fx.note(hero.x, hero.y - 40, 'Fixed up -$50', '#7ac74f');
        events.push('cash');
      }
    }
    return events;
  }

  function phaseJobs(dt) {
    const events = [];
    const job = jobs.current();
    // A wrecked job car fails the job that needs it.
    if (job && (job.id === 'j2' || job.id === 'j6')
      && state.jobCar && state.jobCar.health <= 0 && !jobs.state.failed) {
      jobs.fail('Your ride was wrecked');
      events.push('job-failed');
    }
    if (job && job.limit && !jobs.state.failed) {
      jobs.state.timer -= dt;
      if (jobs.state.timer <= 0) {
        jobs.fail('Out of time');
        events.push('job-failed');
      }
    }
    if (job && !jobs.state.failed) {
      const step = jobs.step();
      if (step) {
        const d = Math.hypot(hero.x - step.x, hero.y - step.y);
        let done = false;
        if (step.kind === 'enter') done = hero.inCar;
        else if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'collect') done = d < step.r;
        else if (step.kind === 'steal') done = hero.inCar && hero.car === state.jobCar;
        else if (step.kind === 'beat') done = jobs.state.beaten >= (step.need || 1);
        else if (step.kind === 'ram') done = state.jobCar && state.jobCar.health <= 0;
        if (done) {
          const result = jobs.advance();
          if (result === 'done') {
            state.cash += job.pay;
            state.earned += job.pay;
            if (job.id === 'j3') {
              hero.weapon = 'pistol';
              hero.ammo += 24;
            }
            jobs.state.index += 1;
            jobs.state.step = 0;
            jobs.state.beaten = 0;
            jobs.state.timer = 0;
            if (jobs.state.index < JOBS.length) armStep();
            events.push('job-done');
          } else {
            armStep();
          }
        }
      }
    }
    // Taxi fare clock.
    const fare = jobs.state.fare;
    if (fare) {
      fare.timeLeft -= dt;
      if (Math.hypot(hero.x - fare.to.x, hero.y - fare.to.y) < 70) {
        state.cash += fare.fare;
        state.earned += fare.fare;
        fx.note(hero.x, hero.y - 30, `+$${fare.fare}`, '#7ac74f');
        jobs.state.fare = null;
        events.push('cash');
      } else if (fare.timeLeft <= 0) {
        jobs.state.fare = null;
      }
    }
    return events;
  }

  /** One fixed tick. `input` is the live input; `actions` the latched set. */
  function tick(dt, input, actions) {
    const events = [];
    state.elapsed += dt;
    state.time = (state.time + dt * (86400 / CFG.daySeconds)) % 86400;

    phaseEnterExit(actions);
    events.push(...phaseHero(dt, input));
    phaseStreets(dt);
    state.prevWanted = state.wanted;
    const busted = police.step(dt, state, hero, city);
    if (busted & EV_BUSTED) events.push('busted');
    // Shook the heat clean: the stars fell away on their own, not at the
    // spray shop — that earns a quiet bonus for laying low.
    if (state.prevWanted > 0 && state.wanted === 0) {
      state.cash += CFG.evadeBonus;
      state.earned += CFG.evadeBonus;
      fx.note(hero.x, hero.y - 40, `Clean getaway +$${CFG.evadeBonus}`, '#7ac74f');
      events.push('cash');
    }
    // Slow heal while nobody is looking for you.
    if (state.wanted === 0 && hero.health > 0 && hero.health < CFG.hero.health) {
      hero.health = Math.min(CFG.hero.health, hero.health + CFG.hero.regenPerSec * dt);
    }
    phaseCombat(dt);
    events.push(...phaseLoot(dt));
    events.push(...phaseJobs(dt));

    // Camera follows the hero.
    state.cam.x = clampNum(hero.x, 0, CFG.mapW);
    state.cam.y = clampNum(hero.y, 0, CFG.mapH);

    if (hero.health <= 0) events.push('wasted');
    return events;
  }

  /** After Wasted/Busted: respawn, lose some cash, fail the active job. */
  function respawn(busted) {
    if (jobs.current() && !jobs.state.failed) jobs.fail(busted ? 'Busted' : 'Wasted');
    state.cash = Math.max(0, state.cash - (busted ? 100 : Math.floor(state.cash / 2)));
    state.wanted = 0;
    state.prevWanted = 0;
    hero.health = CFG.hero.health;
    hero.armor = 0;
    hero.inCar = false;
    hero.car = null;
    hero.x = busted ? SPOTS.downtown.x : SPOTS.hospital.x;
    hero.y = busted ? SPOTS.downtown.y : SPOTS.hospital.y;
    hero.angle = -Math.PI / 2;
    state.sharks = [];
    if (jobs.current()) {
      jobs.start(jobs.state.index);
      armStep();
    }
  }

  reset();
  return { state, hero, reset, tick, respawn, closestCar, getIn, getOut, armStep, honk };
}
