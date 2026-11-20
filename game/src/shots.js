// The screenshot scenes behind ?shot=start|chase|mission|night. Each one stages a
// real game state — a fresh world, a scripted situation, a few seconds of the real
// rules played forward — so the frame is what playing really looks like, and the
// same seed always gives the same frame.
import { PLACES, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './ui.js';

function scriptedInput(steerFn, throttle) {
  return {
    move: () => ({ x: 0, y: 0 }),
    running: () => false,
    throttle: () => throttle,
    steer: steerFn,
    handbrake: () => false,
    mouse: () => ({ x: 640, y: 360, down: false }),
    takeClick: () => false,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `ui` carries the subtitle/banner the scene shows.
 */
export function stageShot(name, world, ui) {
  const state = world.state;
  world.reset();
  if (name === 'chase') {
    // Sunset getaway downtown: three stars, two interceptors on the tail.
    state.time = 17.6 * 3600;
    state.missions.startMission(3); // Heat Wave: a chase with three stars
    const car = state.vehicles.makeCar(1100, 1050, 0, { name: 'Comet GT', color: '#e53238', top: 560, accel: 470 }, 'parked');
    car.speed = 380;
    world.enterCar(car);
    state.wanted = 3;
    // Interceptors behind the player on the same road, visibly in pursuit.
    const policeModel = { name: 'LCPD Interceptor', color: '#1d2b53', top: 560, accel: 500 };
    state.vehicles.makeCar(800, 1026, 0, policeModel, 'police');
    state.vehicles.makeCar(920, 1074, 0, policeModel, 'police');
    state.cash = 2450;
    state.earned = 2450;
    ui.say('Rook: "Three stars and the whole LCPD behind us. Don\'t stop."', 30);
    const drive = scriptedInput(() => clamp(-state.player.angle * 2.2, -1, 1), 1);
    for (let i = 0; i < 2.5 / STEP; i += 1) world.step(STEP, drive, 0);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Beachfront Brawl, on foot with the pistol, the Vipers closing in.
    state.time = 11 * 3600;
    state.missions.startMission(2);
    state.missions.state.objective = 1;
    world.activateObjective();
    state.player.x = PLACES.beach.x - 160;
    state.player.y = PLACES.beach.y - 110;
    state.player.weapon = 'pistol';
    state.player.ammo = 24;
    state.player.aimAngle = Math.atan2(PLACES.beach.y - state.player.y, PLACES.beach.x - state.player.x);
    state.cash = 1830;
    state.earned = 1830;
    ui.say('Nia: "The Vipers think the beach is theirs. It\'s ours."', 30);
    const idle = scriptedInput(() => 0, 0);
    // Run the fight with no heat so no police cars pile into the scene; the star
    // is set afterwards, for the HUD.
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, idle, 0);
    // Clear any traffic that wandered into the fight, then show the wanted star.
    for (let i = state.vehicles.cars.length - 1; i >= 0; i -= 1) {
      const c = state.vehicles.cars[i];
      if ((c.kind === 'traffic' || c.kind === 'parked') && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 340) {
        state.vehicles.cars.splice(i, 1);
      }
    }
    state.wanted = 1;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'night') {
    // Neon downtown at night, two stars, cruising past the towers.
    state.time = 22 * 3600;
    state.missions.state.index = 6; // story done: free-roam tracker line
    const car = state.vehicles.makeCar(1900, 1250, Math.PI / 2, { name: 'Neon Coupe', color: '#ff2e88', top: 530, accel: 450 }, 'parked');
    car.speed = 300;
    world.enterCar(car);
    state.wanted = 2;
    // One interceptor behind the player on the same road, in pursuit.
    state.vehicles.makeCar(1900, 880, Math.PI / 2, { name: 'LCPD Interceptor', color: '#1d2b53', top: 560, accel: 500 }, 'police');
    state.cash = 3120;
    state.earned = 3120;
    ui.say('Downtown Leonida Bay — the city never sleeps, and neither do the cops.', 30);
    const drive = scriptedInput(() => clamp(((Math.PI / 2 - state.player.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 1.4, 1);
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, drive, 0);
    return { screen: SCREEN_PLAY };
  }
  // start: the title screen over a living morning street.
  state.time = 10 * 3600;
  const idle = scriptedInput(() => 0, 0);
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, idle, 0);
  return { screen: SCREEN_TITLE };
}
