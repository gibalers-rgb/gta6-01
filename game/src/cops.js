// The wanted system: stars rise with crimes, MPD cruisers and foot officers
// hunt the player, stars fall when the player stays unseen, and getting caught
// means Busted. Cruisers steer at where the player will be, not where they
// are; foot officers run the player down and grab them up close.
import { CFG, angDiff } from './tuning.js';

export const EV_BUSTED = 1;

export function makeCops(rng, cars) {
  const officers = []; // foot officers {x, y, angle, speed}
  let quietFor = 0;
  let fallIn = 0;
  let spawnIn = 0;

  function cruiserCount() {
    return cars.list.filter((c) => c.kind === 'police').length;
  }

  function addHeat(state, stars) {
    state.wanted = Math.min(CFG.heat.max, state.wanted + stars);
    quietFor = 0;
  }

  function step(dt, state, hero, city) {
    const px = hero.x;
    const py = hero.y;
    // Match the police presence to the wanted level.
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = 0.8;
      if (cruiserCount() < CFG.heat.cruisers[state.wanted]) cars.spawnCruiser(px, py);
      if (officers.length < CFG.heat.officers[state.wanted]) {
        const ride = cars.spawnCruiser(px, py);
        if (ride) {
          cars.list.splice(cars.list.indexOf(ride), 1);
          officers.push({ x: ride.x, y: ride.y, angle: 0, speed: 200 });
        }
      }
    }
    // Chase. Cruisers aim at a point ahead of the hero so they intercept
    // instead of tailing forever; officers just run at the hero. Each cruiser
    // gets its own target, staggered back along the hero's heading, so they
    // form a pursuit line instead of converging on one point and wedging
    // each other to a stop.
    let nearest = Infinity;
    let chaseIdx = 0;
    for (const car of cars.list) {
      if (car.kind !== 'police') continue;
      const dist = Math.hypot(car.x - px, car.y - py);
      nearest = Math.min(nearest, dist);
      const heading = hero.inCar && hero.car ? hero.car.angle : hero.angle;
      const hSpeed = hero.inCar && hero.car ? hero.car.speed : 0;
      const lookAhead = 0.9;
      const back = chaseIdx * 150;
      const tx = px + Math.cos(heading) * hSpeed * lookAhead - Math.cos(heading) * back;
      const ty = py + Math.sin(heading) * hSpeed * lookAhead - Math.sin(heading) * back;
      if (car.ramSide === 0) car.ramSide = rng.chance(0.5) ? -1 : 1;
      const side = car.ramSide * 46;
      const ax = tx + Math.cos(Math.atan2(ty - car.y, tx - car.x) + Math.PI / 2) * side;
      const ay = ty + Math.sin(Math.atan2(ty - car.y, tx - car.x) + Math.PI / 2) * side;
      const want = Math.atan2(ay - car.y, ax - car.x);
      const steer = Math.max(-1, Math.min(1, angDiff(want, car.angle) * 2.2));
      const throttle = dist > 150 ? 1 : dist > 60 ? 0.5 : 0.15;
      cars.drive(car, dt, throttle, steer, false, city);
      chaseIdx += 1;
    }
    for (const officer of officers) {
      const dist = Math.hypot(officer.x - px, officer.y - py);
      nearest = Math.min(nearest, dist);
      officer.angle = Math.atan2(py - officer.y, px - officer.x);
      // At four stars and up the MPD sends its fittest officers: they run
      // faster, so a high-heat foot chase is harder to walk away from.
      const speed = hero.inCar ? 0 : (state.wanted >= 4 ? 250 : 210);
      officer.x += Math.cos(officer.angle) * speed * dt;
      officer.y += Math.sin(officer.angle) * speed * dt;
      city.pushOut(officer, 12);
    }
    // Busted: an officer grabs the player on foot while wanted.
    if (!hero.inCar && state.wanted > 0) {
      for (const officer of officers) {
        if (Math.hypot(officer.x - px, officer.y - py) < 26) return EV_BUSTED;
      }
    }
    // Wanted decay: unseen for a while, then a star falls every few seconds.
    if (state.wanted > 0) {
      if (nearest > 520) {
        quietFor += dt;
        if (quietFor > CFG.heat.unseenSecs) {
          fallIn += dt;
          if (fallIn > CFG.heat.fallEvery) {
            fallIn = 0;
            state.wanted -= 1;
          }
        }
      } else {
        quietFor = 0;
        fallIn = 0;
      }
    }
    // Despawn cruisers when the heat is gone, when wrecked, or when far away.
    for (let i = cars.list.length - 1; i >= 0; i -= 1) {
      const car = cars.list[i];
      if (car.kind === 'police' && (state.wanted === 0 || car.health <= 0)) {
        cars.list.splice(i, 1);
      }
    }
    if (state.wanted === 0) officers.length = 0;
    return 0;
  }

  /** Spray 'n Go: repaint and lose the heat, for cash. */
  function clearHeat(state, cost) {
    if (state.wanted === 0 || state.cash < cost) return false;
    state.cash -= cost;
    state.wanted = 0;
    return true;
  }

  return { officers, addHeat, step, clearHeat };
}
