// Save and load: cash, story progress, hidden packages and best earnings, kept in
// localStorage (this browser only). A missing or corrupt save is just a fresh start.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    return {
      cash: typeof save.cash === 'number' ? save.cash : 0,
      missionIndex: typeof save.missionIndex === 'number' ? save.missionIndex : 0,
      packages: Array.isArray(save.packages) ? save.packages : [],
      earned: typeof save.earned === 'number' ? save.earned : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const taken = [];
    state.city.packages.forEach((p, i) => {
      if (p.taken) taken.push(i);
    });
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missions.state.index,
      packages: taken,
      earned: state.earned,
    }));
  } catch {
    // Storage can be off (private windows): the game still plays, it just forgets.
  }
}
