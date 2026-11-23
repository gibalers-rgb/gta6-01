// Jobs and side work. The story follows Lucia "Lux" Vega, new in Marisol Bay,
// and her fixer Eddie Marlow across seven jobs. Each job is a list of steps —
// go to, steal a car, beat thugs, survive a chase, collect, deliver — with a
// pay day at the end. Taxi fares and hidden packages are the repeatable
// money-makers between jobs.
//
// A step is {kind, x, y, r, need, heat}: kind is the verb, (x, y, r) the
// place and radius, need a count for 'beat' steps, heat the stars the step
// brings with it.
import { SPOTS } from './tuning.js';

export const JOBS = [
  {
    id: 'j1', name: 'Fresh Off the Ferry', pay: 150,
    text: 'Eddie: "Fresh off the ferry, huh? Grab that cab by the safehouse and meet me at the Marisol Diner. Drive like you mean it."',
    steps: [
      { kind: 'enter', x: SPOTS.safehouse.x + 40, y: SPOTS.safehouse.y, r: 60 },
      { kind: 'goto', x: SPOTS.diner.x, y: SPOTS.diner.y, r: 70 },
    ],
  },
  {
    id: 'j2', name: 'Hot Wheels', pay: 300,
    text: 'Eddie: "See that teal Solara GT at the marina lot? It\'s not stealing if you bring it back... to my garage. Keep the paint on it."',
    steps: [
      { kind: 'steal', x: SPOTS.marina.x, y: SPOTS.marina.y, r: 80 },
      { kind: 'deliver', x: SPOTS.garage.x, y: SPOTS.garage.y, r: 80 },
    ],
  },
  {
    id: 'j3', name: 'Boardwalk Brawl', pay: 400,
    text: 'Lux: "The Sharks think the boardwalk is theirs. It\'s ours. Take your fists — or the pistol Eddie left in the glovebox — and remind them."',
    steps: [
      { kind: 'goto', x: SPOTS.boardwalk.x, y: SPOTS.boardwalk.y, r: 90 },
      { kind: 'beat', x: SPOTS.boardwalk.x, y: SPOTS.boardwalk.y, r: 200, need: 5 },
      { kind: 'collect', x: SPOTS.boardwalk.x + 60, y: SPOTS.boardwalk.y - 40, r: 50 },
    ],
  },
  {
    id: 'j4', name: 'Rush Hour', pay: 600,
    text: 'Eddie: "MPD is all over downtown. Three drops, ninety seconds, and whatever you do — don\'t stop moving."',
    limit: 90,
    steps: [
      { kind: 'goto', x: SPOTS.downtown.x, y: SPOTS.downtown.y, r: 80, heat: 3 },
      { kind: 'goto', x: SPOTS.diner.x, y: SPOTS.diner.y, r: 80 },
      { kind: 'goto', x: SPOTS.hideout.x, y: SPOTS.hideout.y, r: 80 },
    ],
  },
  {
    id: 'j5', name: 'Dockside', pay: 800,
    text: 'Lux: "Three crates came in on the night boat. Dock security is jumpy — grab them fast and get them to Warehouse 9."',
    steps: [
      { kind: 'collect', x: 400, y: 2280, r: 55 },
      { kind: 'collect', x: 580, y: 2280, r: 55 },
      { kind: 'collect', x: 740, y: 2280, r: 55 },
      { kind: 'deliver', x: SPOTS.warehouse.x, y: SPOTS.warehouse.y, r: 90 },
    ],
  },
  {
    id: 'j6', name: 'Queen of the Bay', pay: 1500,
    text: 'Eddie: "Silas Vane runs this bay. Tonight he stops. Ram his car off the road, handle his guards, take the ledger — and come home a legend."',
    steps: [
      { kind: 'goto', x: SPOTS.downtown.x, y: SPOTS.downtown.y, r: 120, heat: 2 },
      { kind: 'ram', x: SPOTS.downtown.x, y: SPOTS.downtown.y, r: 300, need: 1 },
      { kind: 'beat', x: SPOTS.downtown.x, y: SPOTS.downtown.y, r: 260, need: 4 },
      { kind: 'collect', x: SPOTS.downtown.x + 40, y: SPOTS.downtown.y + 40, r: 55 },
      { kind: 'deliver', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 90, heat: 4 },
    ],
  },
  {
    id: 'j7', name: 'The Long Game', pay: 1000,
    text: 'Eddie: "Silas is gone, but his boys still run drops all over town. Three stashes, two minutes, and bring it all home. Prove the bay is yours."',
    limit: 120,
    steps: [
      { kind: 'collect', x: SPOTS.downtown.x, y: SPOTS.downtown.y, r: 70, heat: 2 },
      { kind: 'collect', x: SPOTS.diner.x, y: SPOTS.diner.y, r: 70 },
      { kind: 'collect', x: SPOTS.hideout.x, y: SPOTS.hideout.y, r: 70 },
      { kind: 'deliver', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 90 },
    ],
  },
];

export function makeJobs() {
  const state = {
    index: 0, // active job; JOBS.length means the story is done
    step: 0,
    timer: 0,
    beaten: 0,
    failed: false,
    done: false,
    flagT: 0, // seconds left on the "job done" banner
    flagText: '',
    fare: null, // active taxi fare {from, to, timeLeft, fare}
  };

  function current() {
    return JOBS[state.index] || null;
  }

  function step() {
    const job = current();
    return job ? job.steps[state.step] || null : null;
  }

  function start(index) {
    state.index = index;
    state.step = 0;
    state.beaten = 0;
    state.failed = false;
    state.timer = 0;
    const job = current();
    if (job && job.limit) state.timer = job.limit;
  }

  /** Move to the next step; returns 'done' when the job is complete. */
  function advance() {
    state.step += 1;
    state.beaten = 0;
    const job = current();
    if (job && state.step >= job.steps.length) {
      state.done = true;
      state.flagT = 3.5;
      state.flagText = `JOB DONE — ${job.name}`;
      return 'done';
    }
    return 'next';
  }

  function fail(why) {
    state.failed = true;
    state.flagT = 3;
    state.flagText = `JOB FAILED — ${why}`;
  }

  function startFare(from, to, fare, limit) {
    state.fare = { from, to, fare, timeLeft: limit };
  }

  return { state, current, step, start, advance, fail, startFare };
}
