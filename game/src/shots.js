// The screenshot scenes behind ?shot=start|chase|mission|night. Each one stages
// a real game state — a fresh world, a scripted situation, a few seconds of
// the real rules played forward — so the frame is what playing really looks
// like, and the same seed always gives the same frame.
import { CFG, SPOTS } from './tuning.js';
import { SCR_PLAY, SCR_TITLE } from './screens.js';

const TICK = CFG.tick;

function clampNum(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A scripted driver: full throttle, steering from a function. */
function autoDriver(steerFn) {
  return {
    moveVec: () => ({ x: 0, y: 0 }),
    sprinting: () => false,
    throttle: () => 1,
    steer: steerFn,
    handbrake: () => false,
    pointer: () => ({ x: 640, y: 360, isDown: false }),
    takeClick: () => false,
  };
}

function idleDriver() {
  return {
    moveVec: () => ({ x: 0, y: 0 }),
    sprinting: () => false,
    throttle: () => 0,
    steer: () => 0,
    handbrake: () => false,
    pointer: () => ({ x: 640, y: 360, isDown: false }),
    takeClick: () => false,
  };
}

/** Drive the world forward `seconds` with a scripted driver. `afterTick` runs after each tick. */
function driveFor(world, seconds, driver, afterTick) {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n; i += 1) {
    world.tick(TICK, driver, new Set());
    if (afterTick) afterTick(world.state);
  }
}

/** Steer toward a fixed compass heading, as a function of the hero angle. */
function holdHeading(world, heading) {
  return () => {
    const a = world.hero.angle;
    return clampNum(((heading - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 1.4;
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `ui` carries the subtitle the scene shows.
 */
export function stageShot(name, world, ui) {
  const state = world.state;
  world.reset();
  if (name === 'chase') {
    // Sunset getaway downtown: three stars, two cruisers on the tail.
    state.time = 17.6 * 3600;
    state.jobs.start(3); // Rush Hour: a chase with three stars
    const car = state.cars.add(1120, 1080, 0,
      { name: 'Solara GT', color: '#2ec4b6', top: 565, accel: 480 }, 'parked');
    car.speed = 380;
    world.getIn(car);
    state.wanted = 3;
    // Cruisers behind the hero on the same street, visibly in pursuit: a
    // rolling start, so they stay in frame instead of being outrun.
    const cruiser = { name: 'MPD Interceptor', color: '#14264d', top: 565, accel: 510 };
    const c1 = state.cars.add(820, 1056, 0, cruiser, 'police');
    const c2 = state.cars.add(940, 1104, 0, cruiser, 'police');
    c1.speed = 500;
    c2.speed = 500;
    state.cash = 2450;
    state.earned = 2450;
    // Keep the getaway lane clear for the whole drive: maintain() spawns fresh
    // traffic on the hero's street as it goes, and a crossing car at full speed
    // would wedge the hero and the frame would show a crawl, not a chase.
    const clearLane = (st) => {
      for (let i = st.cars.list.length - 1; i >= 0; i -= 1) {
        const c = st.cars.list[i];
        if (c !== car && c.kind !== 'police' && c.x > st.hero.x - 100 && c.x < st.hero.x + 900
          && Math.abs(c.y - st.hero.y) < 90) {
          st.cars.list.splice(i, 1);
        }
      }
    };
    ui.say('Eddie: "Three stars and the whole MPD behind us. Don\'t stop."', 30);
    driveFor(world, 1.8, autoDriver(() => clampNum(-state.hero.angle * 2.2, -1, 1)), clearLane);
    return { screen: SCR_PLAY };
  }
  if (name === 'mission') {
    // Boardwalk Brawl, on foot with the pistol, the Sharks closing in.
    state.time = 11 * 3600;
    state.jobs.start(2);
    state.jobs.state.step = 1;
    world.armStep();
    state.hero.x = SPOTS.boardwalk.x - 160;
    state.hero.y = SPOTS.boardwalk.y - 110;
    state.hero.weapon = 'pistol';
    state.hero.ammo = 24;
    state.hero.aim = Math.atan2(SPOTS.boardwalk.y - state.hero.y, SPOTS.boardwalk.x - state.hero.x);
    state.cash = 1830;
    state.earned = 1830;
    ui.say('Lux: "The Sharks think the boardwalk is theirs. It\'s ours."', 30);
    // Run the fight with no heat so no cruisers pile into the scene; the star
    // is set afterwards, for the HUD.
    driveFor(world, 3, idleDriver());
    // Clear any traffic that wandered into the fight, then show the wanted star.
    for (let i = state.cars.list.length - 1; i >= 0; i -= 1) {
      const c = state.cars.list[i];
      if ((c.kind === 'traffic' || c.kind === 'parked') && Math.hypot(c.x - state.hero.x, c.y - state.hero.y) < 340) {
        state.cars.list.splice(i, 1);
      }
    }
    state.wanted = 1;
    return { screen: SCR_PLAY };
  }
  if (name === 'night') {
    // Neon downtown at night, two stars, cruising past the towers.
    state.time = 22 * 3600;
    state.jobs.state.index = 7; // story done: free-roam tracker line
    // Start at the south edge of downtown and drive north, so the frame keeps
    // the towers and their lit windows in view.
    const car = state.cars.add(1920, 1420, -Math.PI / 2,
      { name: 'Neon Coupe', color: '#ff2e88', top: 535, accel: 455 }, 'parked');
    car.speed = 300;
    world.getIn(car);
    state.wanted = 2;
    // One cruiser behind the hero on the same street, in pursuit.
    state.cars.add(1920, 1800, -Math.PI / 2,
      { name: 'MPD Interceptor', color: '#14264d', top: 565, accel: 510 }, 'police');
    state.cash = 3120;
    state.earned = 3120;
    ui.say('Downtown Marisol Bay — the city never sleeps, and neither do the cops.', 30);
    driveFor(world, 1.2, autoDriver(holdHeading(world, -Math.PI / 2)));
    return { screen: SCR_PLAY };
  }
  // start: the title screen over a living morning street.
  state.time = 10 * 3600;
  driveFor(world, 5, idleDriver());
  return { screen: SCR_TITLE };
}
