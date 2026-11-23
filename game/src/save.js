// Save and load, versioned so an old save never confuses a new build.
// Cash, story progress, hidden packages, best earnings — localStorage only,
// this browser only. A missing or corrupt save is just a fresh start.
import { CFG } from './tuning.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null || save.v !== 3) return null;
    return {
      cash: typeof save.cash === 'number' ? save.cash : 0,
      job: typeof save.job === 'number' ? save.job : 0,
      pkgs: Array.isArray(save.pkgs) ? save.pkgs : [],
      earned: typeof save.earned === 'number' ? save.earned : 0,
    };
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    const pkgs = [];
    state.city.packages.forEach((p, i) => {
      if (p.taken) pkgs.push(i);
    });
    window.localStorage.setItem(CFG.saveKey, JSON.stringify({
      v: 3,
      cash: state.cash,
      job: state.jobs.state.index,
      pkgs,
      earned: state.earned,
    }));
  } catch {
    // Storage can be off (private windows): the game still plays, it forgets.
  }
}
