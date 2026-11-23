// Solmar Heat — game loop and state machine.
// Owns the game state, the frame loop, the camera, saving, and the
// ?scene= parameter used to stage real screenshots of the game.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H } from './config.js';
import { buildCity } from './city.js';
import { initInput, isDown, wasPressed, endFrameInput } from './input.js';
import {
  createPlayer, createTraffic, createParked, createPeds, updatePlayer,
  updateTraffic, updatePeds, updatePolice, updateWanted, trySteal,
  exitCar, cameraTarget, addWanted, spawnPolice,
} from './actors.js';
import { startMission, updateMission, checkSprayShop } from './missions.js';
import { render } from './render.js';
import { ensureAudio, setEngine, setSiren, toggleMute, sfxBusted } from './audio.js';

const SAVE_KEY = 'solmar-heat-best-cash';

function loadBest() {
  try {
    return Number(localStorage.getItem(SAVE_KEY) || 0) || 0;
  } catch (_e) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(SAVE_KEY, String(value));
  } catch (_e) {
    // Saving is a nicety; the game plays on without it.
  }
}

export function newGame() {
  const city = buildCity();
  const state = {
    city,
    mode: 'title',
    time: 0,
    player: createPlayer(city),
    cars: [],
    peds: createPeds(city),
    cash: 0,
    bestCash: loadBest(),
    wanted: 0,
    crimeTimer: 0,
    quietTimer: 0,
    policeTimer: 0,
    missionIndex: 0,
    mission: { def: null, marker: null, bags: [], collected: 0, timer: 0, hint: '', done: false },
    pendingMission: null,
    pendingAt: 0,
    missionDoneAt: 0,
    freeRoamTimer: 0,
    message: '',
    messageAt: -99,
    camera: { x: 0, y: 0 },
    shake: 0,
    muted: false,
    bustedAt: 0,
  };
  state.cars = [...createTraffic(city), ...createParked(city)];
  return state;
}

function startRun(state) {
  ensureAudio();
  state.mode = 'playing';
  state.message = 'Welcome to Solmar Bay. First job: Borrowed Wheels.';
  state.messageAt = state.time;
  startMission(state, 0);
}

function endRun(state) {
  if (state.cash > state.bestCash) {
    state.bestCash = state.cash;
    saveBest(state.bestCash);
  }
  setEngine(0);
  setSiren(false);
  sfxBusted();
}

// Put the player in a car on a straight east-west road (y = 608 runs the
// whole width with no buildings on it), facing east with a clear run.
function stageCar(state, speed) {
  const car = state.cars.find((c) => c.driver === 'parked') || state.cars[0];
  car.x = 1000; car.y = 608; car.angle = 0; car.speed = speed;
  car.driver = 'player';
  const p = state.player;
  p.x = car.x; p.y = car.y; p.angle = 0;
  p.car = car;
  p.onFoot = false;
  return car;
}

// Stage a scene for screenshots: ?scene=drive|chase|mission (or start).
// The scene starts the run and places the player, cars and heat so the
// screenshot shows the game mid-action instead of an empty street.
export function applyScene(state) {
  const scene = new URLSearchParams(window.location.search).get('scene') || 'start';
  if (scene === 'start') return;
  startRun(state);
  if (scene === 'drive') {
    stageCar(state, 260);
    state.cash = 350;
  } else if (scene === 'chase') {
    stageCar(state, 300);
    state.cash = 1250;
    addWanted(state, 3, 'The whole city is after you!');
    // Two police cars on the same road, right behind the player, placed
    // synchronously so the screenshot catches the chase in frame.
    for (let i = 0; i < 2; i++) {
      const cop = spawnPolice(state);
      if (cop) {
        cop.x = 820 - i * 110;
        cop.y = 608 + (i === 0 ? -18 : 22);
        cop.angle = 0;
        cop.speed = 430;
      }
    }
    startMission(state, 2);
    state.mission.collected = 3;
    state.mission.hint = 'Collect the 5 green cash bags (3/5)';
  } else if (scene === 'mission') {
    stageCar(state, 180);
    state.cash = 700;
    startMission(state, 1);
  }
  // Centre the camera on the player at once, no slow lerp-in.
  const target = cameraTarget(state);
  state.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, target.x - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, target.y - VIEW_H / 2));
}

function updatePlaying(state, dt) {
  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateMission(state, dt);
  checkSprayShop(state);

  if (state.pendingMission !== null && state.time >= state.pendingAt) {
    const next = state.pendingMission;
    state.pendingMission = null;
    if (next < 4) startMission(state, next);
    else {
      state.missionIndex = 4;
      state.mission = {
        def: { title: 'King of Solmar', hint: 'Free roam — cash bags keep appearing.' },
        marker: null, bags: [], collected: 0, timer: 0, hint: '', done: false,
      };
      state.message = 'All jobs done — you run Solmar Bay now. Free roam!';
      state.messageAt = state.time;
    }
  }

  if (wasPressed('action')) {
    if (state.player.onFoot) trySteal(state);
    else exitCar(state);
  }
  if (wasPressed('pause')) state.mode = 'paused';
  if (wasPressed('mute')) state.muted = toggleMute();

  // Audio follows the game: engine by speed, siren by heat.
  if (!state.player.onFoot && state.player.car) {
    setEngine(Math.abs(state.player.car.speed) / 430);
  } else {
    setEngine(0);
  }
  setSiren(state.wanted > 0);

  // Camera chases the player smoothly.
  const target = cameraTarget(state);
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, target.x - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, target.y - VIEW_H / 2));
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  state.shake = Math.max(0, state.shake - dt * 26);

  if (state.mode === 'busted' || state.mode === 'wasted') endRun(state);
}

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  initInput();
  const state = newGame();
  window.__solmar = state; // handy for debugging in the console
  applyScene(state);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.time += dt;

    if (state.mode === 'title') {
      if (wasPressed('start')) startRun(state);
      if (wasPressed('mute')) state.muted = toggleMute();
    } else if (state.mode === 'playing') {
      updatePlaying(state, dt);
    } else if (state.mode === 'paused') {
      if (wasPressed('pause')) state.mode = 'playing';
      if (wasPressed('restart')) {
        const fresh = newGame();
        Object.assign(state, fresh);
        startRun(state);
      }
    } else if (state.mode === 'busted' || state.mode === 'wasted') {
      if (wasPressed('restart')) {
        const fresh = newGame();
        Object.assign(state, fresh);
        startRun(state);
      }
    }
    // Keep the title-screen camera drifting over the city.
    if (state.mode === 'title') {
      state.camera.x = 480 + Math.sin(state.time * 0.05) * 320;
      state.camera.y = 480 + Math.cos(state.time * 0.04) * 220;
    }

    render(ctx, state);
    endFrameInput();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
