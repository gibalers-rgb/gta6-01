// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s ticks (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between title, play, paused, wasted and
// busted.
//
// ?seed=N fixes the city's random pattern. ?shot=start|chase|mission|night (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { CFG } from './tuning.js';
import { makeRng } from './rng.js';
import { makeWorld } from './world.js';
import { ACT_CONFIRM, ACT_HORN, ACT_PAUSE, makeInput } from './input.js';
import { makeRenderer } from './render.js';
import { makeHud } from './hud.js';
import { makeAudio } from './audio.js';
import { SCR_BUSTED, SCR_PAUSED, SCR_PLAY, SCR_TITLE, SCR_WASTED, makeScreens } from './screens.js';
import { stageShot } from './shots.js';
import { storeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const TICK = CFG.tick;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = makeWorld(makeRng(seed));
const renderer = makeRenderer(canvas);
const hud = makeHud(canvas);
const audio = makeAudio();
const screens = makeScreens();
const { ui, say, showFlag, tick: tickScreens, resetHints } = screens;

function paint(state, screen) {
  renderer.drawWorld(state);
  if (screen === SCR_PLAY || screen === SCR_PAUSED) hud.drawHud(state, ui);
  if (screen !== SCR_PLAY) hud.drawScreen(state, ui, screen, { respawn: 'Marisol General' });
}

function runShot(name) {
  const scene = stageShot(name, world, { say });
  let painted = 0;
  function again() {
    paint(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(again);
    else window.__shotReady = true;
  }
  requestAnimationFrame(again);
}

function runGame() {
  const input = makeInput(canvas);
  let screen = SCR_TITLE;
  let acc = 0;
  let last = performance.now();
  let lastJob = -1;
  let lastStep = -1;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) audio.toggleMute();
  });

  function announce(message) {
    status.textContent = message;
  }

  function begin() {
    world.reset();
    resetHints();
    acc = 0;
    lastJob = -1;
    lastStep = -1;
    screen = SCR_PLAY;
    audio.unlock();
    announce('Playing. Marisol Bay.');
    const job = world.state.jobs.current();
    if (job) say(job.text, 7);
  }

  function finish(wasted) {
    screen = wasted ? SCR_WASTED : SCR_BUSTED;
    audio.busted();
    storeSave(world.state);
    announce(wasted ? 'Wasted.' : 'Busted.');
  }

  function onEvents(events) {
    const state = world.state;
    if (events.includes('shot')) audio.shoot();
    if (events.includes('punch')) audio.punch();
    if (events.includes('cash') || events.includes('pickup')) {
      audio.cash();
      storeSave(state);
    }
    if (events.includes('job-done')) {
      audio.jobDone();
      showFlag(state.jobs.state.flagText, '#7ac74f', 3.5);
      storeSave(state);
      const job = state.jobs.current();
      if (job) say(job.text, 7);
    }
    if (events.includes('job-failed')) {
      audio.jobFailed();
      showFlag(state.jobs.state.flagText, '#ff5d5d', 3);
    }
    if (events.includes('wasted')) finish(true);
    else if (events.includes('busted')) finish(false);
  }

  function onActions(actions) {
    const state = world.state;
    if (actions.has(ACT_HORN) && screen === SCR_PLAY) {
      if (world.honk()) audio.honk();
    }
    if (actions.has(ACT_CONFIRM)) {
      if (screen === SCR_TITLE) begin();
      else if (screen === SCR_WASTED) {
        world.respawn(false);
        screen = SCR_PLAY;
        announce('Playing.');
      } else if (screen === SCR_BUSTED) {
        world.respawn(true);
        screen = SCR_PLAY;
        announce('Playing.');
      } else if (screen === SCR_PAUSED) {
        screen = SCR_PLAY;
        announce('Playing.');
      } else if (screen === SCR_PLAY && state.jobs.state.failed) {
        const index = state.jobs.state.index;
        state.jobs.start(index);
        world.armStep();
        say(state.jobs.current().text, 6);
      }
    }
    if (actions.has(ACT_PAUSE)) {
      if (screen === SCR_PLAY) {
        screen = SCR_PAUSED;
        announce('Paused.');
      } else if (screen === SCR_PAUSED) {
        screen = SCR_PLAY;
        announce('Playing.');
      }
    }
  }

  function stepOnce(actions) {
    const state = world.state;
    if (screen === SCR_TITLE) {
      // The title screen's backdrop: the city lives, nobody gets hurt.
      world.tick(TICK, {
        moveVec: () => ({ x: 0, y: 0 }),
        sprinting: () => false,
        throttle: () => 0,
        steer: () => 0,
        handbrake: () => false,
        pointer: () => ({ x: 640, y: 360, isDown: false }),
        takeClick: () => false,
      }, new Set());
      return;
    }
    const events = world.tick(TICK, input, actions || new Set());
    // Job briefing when a job or step changes.
    const jobIndex = state.jobs.state.index;
    const stepIndex = state.jobs.state.step;
    if (jobIndex !== lastJob) {
      lastJob = jobIndex;
      lastStep = stepIndex;
      const job = state.jobs.current();
      if (job) say(job.text, 7);
    } else if (stepIndex !== lastStep) {
      lastStep = stepIndex;
      const step = state.jobs.step();
      if (step) say(stepLabel(step), 3);
    }
    onEvents(events);
  }

  function stepLabel(step) {
    const labels = {
      enter: 'Get in the cab',
      goto: 'Head to the marker',
      steal: 'Take the car',
      deliver: 'Deliver it',
      beat: 'Deal with them',
      collect: 'Grab it',
      ram: "Wreck the car",
    };
    return labels[step.kind] || 'Keep going';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    onActions(actions);
    if (screen === SCR_TITLE || screen === SCR_PLAY) {
      while (acc >= TICK && (screen === SCR_TITLE || screen === SCR_PLAY)) {
        stepOnce(actions);
        acc -= TICK;
      }
    } else {
      acc = 0;
    }
    tickScreens(TICK);
    const state = world.state;
    audio.engine(state.hero.speed || 0, state.hero.inCar);
    audio.siren(TICK, state.wanted);
    audio.music(TICK, screen === SCR_PLAY);
    paint(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCR_PLAY) {
      screen = SCR_PAUSED;
      announce('Paused.');
    }
  });

  announce('Marisol Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
