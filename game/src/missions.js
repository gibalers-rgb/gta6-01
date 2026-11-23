// Solmar Heat — missions.
// A short story chain: steal a car, run a delivery, grab street cash, then
// a timed getaway with the cops on your tail. Each mission knows how to
// start, how to check itself, and what it pays. After the last one the city
// stays open: cash bags keep spawning for free-roam play.

import { GETAWAY_TIME, CASH_BAG_COUNT, CASH_BAG_VALUE, SPRAY_SHOP_COST } from './config.js';
import { addWanted, spawnPolice } from './actors.js';
import { sfxMissionDone, sfxPickup } from './audio.js';

function markerAt(x, y, label, color) {
  return { x, y, label, color: color || '#ffe14d' };
}

function cashBagSpots(city) {
  // Fixed, spread-out spots so the run is learnable, not random.
  return [
    { x: 6 * 64 + 32, y: 19 * 64 + 32 },
    { x: 24 * 64 + 32, y: 4 * 64 + 32 },
    { x: 34 * 64 + 32, y: 14 * 64 + 32 },
    { x: 14 * 64 + 32, y: 24 * 64 + 32 },
    { x: 29 * 64 + 32, y: 9 * 64 + 32 },
  ];
}

export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    briefing: 'Rio needs wheels. Walk up to any parked or cruising car and press E to take it.',
    reward: 200,
    start(state) {
      state.mission.marker = null;
      state.mission.hint = 'Find a car and press E to steal it';
    },
    update(state) {
      if (!state.player.onFoot) return true;
      return false;
    },
  },
  {
    id: 'dockside-drop',
    title: 'Dockside Drop',
    briefing: 'A package is riding with you. Get it to the Docks on the south-east shore — in one piece.',
    reward: 350,
    start(state) {
      const d = state.city.docks;
      state.mission.marker = markerAt(d.x + d.w / 2, d.y + d.h / 2, 'DOCKS');
      state.mission.hint = 'Drive to the yellow marker at the Docks';
    },
    update(state) {
      const m = state.mission.marker;
      const d = Math.hypot(state.player.x - m.x, state.player.y - m.y);
      return d < 90;
    },
  },
  {
    id: 'street-cash',
    title: 'Street Cash',
    briefing: 'Five cash bags are stashed around Solmar. Scoop them all up — on foot or by car.',
    reward: 500,
    start(state) {
      state.mission.bags = cashBagSpots(state.city).map((s) => ({ ...s, taken: false }));
      state.mission.collected = 0;
      state.mission.marker = null;
      state.mission.hint = 'Collect the 5 green cash bags (0/5)';
    },
    update(state) {
      let changed = false;
      for (const bag of state.mission.bags) {
        if (bag.taken) continue;
        const d = Math.hypot(state.player.x - bag.x, state.player.y - bag.y);
        if (d < 46) {
          bag.taken = true;
          state.mission.collected += 1;
          state.cash += CASH_BAG_VALUE;
          sfxPickup();
          changed = true;
        }
      }
      if (changed) {
        state.mission.hint = `Collect the 5 green cash bags (${state.mission.collected}/5)`;
        state.message = `Cash bag! +$${CASH_BAG_VALUE}`;
        state.messageAt = state.time;
      }
      return state.mission.collected >= CASH_BAG_COUNT;
    },
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    briefing: 'The cops are onto you. Lose them and reach the Hideout in the north-west before the clock runs out.',
    reward: 800,
    start(state) {
      const h = state.city.hideout;
      state.mission.marker = markerAt(h.x + h.w / 2, h.y + h.h / 2, 'HIDEOUT', '#b366ff');
      state.mission.timer = GETAWAY_TIME;
      state.mission.hint = `Reach the Hideout in ${GETAWAY_TIME}s — cops are coming`;
      if (state.wanted < 2) addWanted(state, 2 - state.wanted, 'The cops are onto you!');
      spawnPolice(state);
      spawnPolice(state);
    },
    update(state, dt) {
      state.mission.timer -= dt;
      const m = state.mission.marker;
      const d = Math.hypot(state.player.x - m.x, state.player.y - m.y);
      state.mission.hint = `Reach the Hideout — ${Math.max(0, Math.ceil(state.mission.timer))}s left`;
      if (d < 100) return true;
      if (state.mission.timer <= 0) {
        // Failed run: the mission restarts, the game does not end.
        state.message = 'Too slow — the getaway failed. Try again!';
        state.messageAt = state.time;
        this.start(state);
      }
      return false;
    },
  },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  state.missionIndex = index;
  state.mission = {
    def, marker: null, bags: [], collected: 0, timer: 0,
    hint: '', done: false,
  };
  def.start(state);
  state.message = `MISSION: ${def.title} — ${def.briefing}`;
  state.messageAt = state.time;
}

export function updateMission(state, dt) {
  if (state.missionIndex >= MISSIONS.length) {
    updateFreeRoam(state, dt);
    return;
  }
  const done = state.mission.def.update(state, dt);
  if (done && !state.mission.done) {
    state.mission.done = true;
    state.cash += state.mission.def.reward;
    sfxMissionDone();
    state.message = `Mission complete: ${state.mission.def.title}  +$${state.mission.def.reward}`;
    state.messageAt = state.time;
    state.missionDoneAt = state.time;
    // Brief pause on the banner, then the next mission starts.
    state.pendingMission = state.missionIndex + 1;
    state.pendingAt = state.time + 2.2;
  }
}

// After the story: cash bags respawn every so often for free-roam scoring.
export function updateFreeRoam(state, dt) {
  state.mission.hint = 'Free roam — King of Solmar. Cash bags keep appearing.';
  state.freeRoamTimer = (state.freeRoamTimer || 0) + dt;
  if (state.freeRoamTimer > 14) {
    state.freeRoamTimer = 0;
    const spots = cashBagSpots(state.city);
    const spot = spots[Math.floor(Math.random() * spots.length)];
    state.mission.bags = [{ ...spot, taken: false }];
  }
  for (const bag of state.mission.bags || []) {
    if (bag.taken) continue;
    const d = Math.hypot(state.player.x - bag.x, state.player.y - bag.y);
    if (d < 46) {
      bag.taken = true;
      state.cash += CASH_BAG_VALUE;
      sfxPickup();
      state.message = `Cash bag! +$${CASH_BAG_VALUE}`;
      state.messageAt = state.time;
    }
  }
}

// Spray shop: drive into its forecourt to wipe the wanted level for cash.
export function checkSprayShop(state) {
  if (state.wanted === 0) return;
  const s = state.city.sprayShop;
  const cx = s.x + s.w / 2; const cy = s.y + s.h / 2;
  const d = Math.hypot(state.player.x - cx, state.player.y - cy);
  if (d < 120 && !state.player.onFoot && state.cash >= SPRAY_SHOP_COST) {
    state.cash -= SPRAY_SHOP_COST;
    state.wanted = 0;
    state.quietTimer = 0;
    state.message = `New paint, new plates — heat cleared (-$${SPRAY_SHOP_COST})`;
    state.messageAt = state.time;
    sfxPickup();
  }
}
