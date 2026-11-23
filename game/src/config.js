// Solmar Heat — tuning constants.
// One place for every number that shapes how the city and the chase feel,
// so balancing the game means editing this file, not hunting through logic.

export const TILE = 64; // pixels per city tile
export const COLS = 38; // city width in tiles
export const ROWS = 28; // city height in tiles
export const WORLD_W = COLS * TILE; // 2432 px
export const WORLD_H = ROWS * TILE; // 1792 px

export const VIEW_W = 960; // canvas width
export const VIEW_H = 600; // canvas height

// City layout: roads sit on every 5th tile line; the south rows are beach.
export const ROAD_EVERY = 5;
export const BEACH_START_ROW = 26; // rows 26-27 are sand, row 27 is the sea edge

// On-foot movement (pixels per second).
export const WALK_SPEED = 175;
export const RUN_SPEED = 265;

// Driving (pixels per second, radians per second).
export const CAR_ACCEL = 520;
export const CAR_BRAKE = 760;
export const CAR_REVERSE_MAX = 150;
export const CAR_MAX_SPEED = 430;
export const CAR_TURN_RATE = 2.9;
export const CAR_DRAG = 0.55; // per second, eases off the throttle
export const TRAFFIC_SPEED = 120;
export const POLICE_SPEED = 470; // slightly faster than the player's top speed

// Health and damage.
export const MAX_HEALTH = 100;
export const CRASH_DAMAGE = 9; // hard hit against a building
export const RAM_DAMAGE = 7; // a police ram
export const PED_HIT_DAMAGE = 0; // hitting a pedestrian costs heat, not health
export const HEALTH_REGEN = 4; // per second after 6 s without damage

// Wanted level.
export const MAX_WANTED = 5;
export const WANTED_DECAY_QUIET = 10; // seconds without a crime before stars drop
export const WANTED_DECAY_STEP = 8; // seconds per star lost while quiet
export const WITNESS_RANGE = 330; // a steal seen inside this range raises heat
export const POLICE_SIGHT_RANGE = 430; // police notice crimes inside this range
export const SPRAY_SHOP_COST = 150; // clears the whole wanted level

// Police.
export const MAX_POLICE = 3; // active chasers at once
export const POLICE_SPAWN_INTERVAL = 2.5; // seconds between spawns while wanted
export const BUST_GRAB_RANGE = 34; // a cop on foot-grab distance

// Missions.
export const GETAWAY_TIME = 75; // seconds for the final mission
export const CASH_BAG_COUNT = 5;
export const CASH_BAG_VALUE = 60;

// Population.
export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 10;
export const PED_COUNT = 22;

// Palette: a sun-soaked coastal city, all original colours.
export const COLORS = {
  grass: '#5da24f',
  sidewalk: '#b8a88f',
  road: '#33313a',
  roadLine: '#e8d44f',
  sand: '#e9c886',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  buildingRoof: ['#ff9d76', '#ffd166', '#7ec8e3', '#f78fb3', '#a3e635', '#c084fc'],
  buildingEdge: '#4a4038',
  palmTrunk: '#8a6b46',
  palmLeaf: '#2f9e44',
  player: '#ffcf3f',
  cop: '#1c2733',
  copWhite: '#f2f2f2',
  cash: '#37d67a',
  marker: '#ffe14d',
  hideout: '#b366ff',
};
