// Missions and side work. The story follows Nia Solano, new in Leonida Bay, and her
// fixer Rook Delgado across six missions; each mission is a list of objectives
// (go to, steal a car, beat thugs, survive a chase, collect, deliver). Taxi fares
// and hidden packages are the repeatable money-makers between missions.
import { PLACES } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'm1', title: 'New in Town', reward: 150,
    briefing: 'Rook: "Fresh off the bus, huh? Grab that taxi by the safehouse and meet me at the Sunset Diner. Drive like you mean it."',
    objectives: [
      { type: 'enter', label: 'Get in the taxi by the safehouse', x: PLACES.safehouse.x + 40, y: PLACES.safehouse.y, radius: 60 },
      { type: 'goto', label: 'Drive to the Sunset Diner', x: PLACES.diner.x, y: PLACES.diner.y, radius: 70 },
    ],
  },
  {
    id: 'm2', title: 'Borrowed Time', reward: 300,
    briefing: 'Rook: "See that red Comet GT at the beach lot? It\'s not stealing if you bring it back... to my garage. Port side. Keep the paint on it."',
    objectives: [
      { type: 'steal', label: 'Steal the red Comet GT at the beach lot', x: PLACES.beachLot.x, y: PLACES.beachLot.y, radius: 80 },
      { type: 'deliver', label: 'Deliver it to the Port Garage', x: PLACES.garage.x, y: PLACES.garage.y, radius: 80 },
    ],
  },
  {
    id: 'm3', title: 'Beachfront Brawl', reward: 400,
    briefing: 'Nia: "The Vipers think the beach is theirs. It\'s ours. Take your fists — or the pistol Rook left in the glovebox — and remind them."',
    objectives: [
      { type: 'goto', label: 'Go to Ocean Beach', x: PLACES.beach.x, y: PLACES.beach.y, radius: 90 },
      { type: 'defeat', label: 'Deal with the Vipers', count: 5, x: PLACES.beach.x, y: PLACES.beach.y, radius: 200 },
      { type: 'collect', label: 'Grab the package they were guarding', x: PLACES.beach.x + 60, y: PLACES.beach.y - 40, radius: 50 },
    ],
  },
  {
    id: 'm4', title: 'Heat Wave', reward: 600,
    briefing: 'Rook: "Cops are all over downtown. Three drops, ninety seconds, and whatever you do — don\'t stop moving."',
    objectives: [
      { type: 'goto', label: 'Reach the downtown drop (1/3)', x: PLACES.downtown.x, y: PLACES.downtown.y, radius: 80, wanted: 3 },
      { type: 'goto', label: 'Reach the diner drop (2/3)', x: PLACES.diner.x, y: PLACES.diner.y, radius: 80 },
      { type: 'goto', label: 'Reach the hideout (3/3) — lose the cops', x: PLACES.hideout.x, y: PLACES.hideout.y, radius: 80 },
    ],
    timeLimit: 90,
  },
  {
    id: 'm5', title: 'Port of Call', reward: 800,
    briefing: 'Nia: "Three crates came in on the night boat. Port security is jumpy — grab them fast and get them to Warehouse 7."',
    objectives: [
      { type: 'collect', label: 'Collect crate 1/3 at the port', x: 380, y: 2250, radius: 55 },
      { type: 'collect', label: 'Collect crate 2/3 at the port', x: 560, y: 2250, radius: 55 },
      { type: 'collect', label: 'Collect crate 3/3 at the port', x: 720, y: 2250, radius: 55 },
      { type: 'deliver', label: 'Deliver the crates to Warehouse 7', x: PLACES.warehouse.x, y: PLACES.warehouse.y, radius: 90 },
    ],
  },
  {
    id: 'm6', title: 'King of the Bay', reward: 1500,
    briefing: 'Rook: "Vic Marino runs this bay. Tonight he stops. Ram his car off the road, handle his guards, take the briefcase — and come home a legend."',
    objectives: [
      { type: 'goto', label: 'Find Vic Marino downtown', x: PLACES.downtown.x, y: PLACES.downtown.y, radius: 120, wanted: 2 },
      { type: 'ram', label: "Wreck Vic's car", count: 1, x: PLACES.downtown.x, y: PLACES.downtown.y, radius: 300 },
      { type: 'defeat', label: 'Deal with his guards', count: 4, x: PLACES.downtown.x, y: PLACES.downtown.y, radius: 260 },
      { type: 'collect', label: 'Take the briefcase', x: PLACES.downtown.x + 40, y: PLACES.downtown.y + 40, radius: 55 },
      { type: 'deliver', label: 'Escape to the safehouse', x: PLACES.safehouse.x, y: PLACES.safehouse.y, radius: 90, wanted: 4 },
    ],
  },
];

export function createMissions() {
  const state = {
    index: 0, // which mission is active; MISSION_DEFS.length means the story is done
    objective: 0,
    timer: 0,
    defeated: 0,
    failed: false,
    complete: false,
    splash: 0, // seconds left on the "mission passed" banner
    splashText: '',
    taxi: null, // active fare {from, to, timeLeft, fare}
    fareCooldown: 0,
  };

  function current() {
    return MISSION_DEFS[state.index] || null;
  }

  function objective() {
    const mission = current();
    return mission ? mission.objectives[state.objective] || null : null;
  }

  function startMission(index) {
    state.index = index;
    state.objective = 0;
    state.defeated = 0;
    state.failed = false;
    state.timer = 0;
    const mission = current();
    if (mission && mission.timeLimit) state.timer = mission.timeLimit;
  }

  function nextObjective() {
    state.objective += 1;
    state.defeated = 0;
    const mission = current();
    if (mission && state.objective >= mission.objectives.length) {
      state.complete = true;
      state.splash = 3.5;
      state.splashText = `MISSION PASSED — ${mission.title}`;
      return 'complete';
    }
    return 'next';
  }

  function fail(reason) {
    state.failed = true;
    state.splash = 3;
    state.splashText = `MISSION FAILED — ${reason}`;
  }

  function startTaxi(from, to, fare, timeLimit) {
    state.taxi = { from, to, fare, timeLeft: timeLimit };
  }

  return { state, current, objective, startMission, nextObjective, fail, startTaxi };
}
