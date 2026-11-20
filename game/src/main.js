// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between title, play, paused, wasted and busted.
//
// ?seed=N fixes the city's random pattern. ?shot=start|chase|mission|night (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUSTED_FLAG, EVENT_CASH, EVENT_MISSION_FAIL, EVENT_MISSION_PASS,
  EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createUi, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './ui.js';
import { stageShot } from './shots.js';
import { writeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const { ui, say, showBanner, step: stepUi } = createUi();

function draw(state, screen) {
  renderer.drawWorld(state);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
    hud.drawHud(state, ui);
  }
  if (screen !== SCREEN_PLAY) {
    hud.drawScreen(state, ui, screen, { respawn: 'Leonida General' });
  }
}

function runShot(name) {
  const scene = stageShot(name, world, { say });
  let painted = 0;
  function paint() {
    draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let prevMission = -1;
  let prevObjective = -1;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) audio.toggleMute();
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    prevMission = -1;
    prevObjective = -1;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Leonida Bay.');
    const mission = world.state.missions.current();
    if (mission) say(mission.briefing, 7);
  }

  function endGame(wasted) {
    screen = wasted ? SCREEN_WASTED : SCREEN_BUSTED;
    audio.busted();
    writeSave(world.state);
    announce(wasted ? 'Wasted.' : 'Busted.');
  }

  function handleEvents(events) {
    const state = world.state;
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & (EVENT_CASH | EVENT_PICKUP)) {
      audio.cash();
      writeSave(state);
    }
    if (events & EVENT_MISSION_PASS) {
      audio.missionPass();
      showBanner(state.missions.state.splashText, '#7ac74f', 3.5);
      writeSave(state);
      const mission = state.missions.current();
      if (mission) say(mission.briefing, 7);
    }
    if (events & EVENT_MISSION_FAIL) {
      audio.missionFail();
      showBanner(state.missions.state.splashText, '#ff5d5d', 3);
    }
    if (events & EVENT_WASTED) endGame(true);
    else if (events & EVENT_BUSTED_FLAG) endGame(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    const state = world.state;
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_WASTED) {
        world.respawn(false);
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_BUSTED) {
        world.respawn(true);
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PLAY && state.missions.state.failed) {
        const index = state.missions.state.index;
        state.missions.startMission(index);
        world.activateObjective();
        say(state.missions.current().briefing, 6);
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    const state = world.state;
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: the city lives, nobody gets hurt.
      world.step(STEP, {
        move: () => ({ x: 0, y: 0 }),
        running: () => false,
        throttle: () => 0,
        steer: () => 0,
        handbrake: () => false,
        mouse: () => ({ x: 640, y: 360, down: false }),
        takeClick: () => false,
      }, 0);
      return;
    }
    const events = world.step(STEP, input, input.takeActions());
    // Mission briefing when a mission or objective changes.
    const missionIndex = state.missions.state.index;
    const objectiveIndex = state.missions.state.objective;
    if (missionIndex !== prevMission) {
      prevMission = missionIndex;
      prevObjective = objectiveIndex;
      const mission = state.missions.current();
      if (mission) say(mission.briefing, 7);
    } else if (objectiveIndex !== prevObjective) {
      prevObjective = objectiveIndex;
      const obj = state.missions.objective();
      if (obj) say(obj.label, 3);
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    stepUi(STEP);
    const state = world.state;
    audio.engine(state.player.speed || 0, state.player.inCar);
    audio.siren(STEP, state.wanted);
    draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Leonida Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
