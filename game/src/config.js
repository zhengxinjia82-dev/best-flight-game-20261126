// config.js — Tuning, world layout, legs, scoring and palette for EMBERWING.
// One job: every number the rest of the game reads, in one place.
export const CONFIG = {
  // World: metres, centred on the valley. Terrain is a 6000 x 6000 m heightfield.
  WORLD_SIZE: 6000,
  CELL: 150,
  WATER_LEVEL: 0,
  // Flight model.
  CRUISE_SPEED: 55, // m/s, the efficient cruise the HUD rewards
  MAX_SPEED: 88, // overspeed above this damages the airframe
  STALL_SPEED: 26, // clean stall; 21 with flaps
  STALL_FLAPS: 21,
  MAX_PITCH: 0.42, // rad
  MAX_BANK: 1.05, // rad
  TURN_G: 9.81,
  FUEL_MAX: 900, // kg
  FUEL_BINGO: 150, // kg — BINGO warning
  WATER_MAX: 3000, // litres
  SCOOP_RATE: 1200, // L/s while skimming the lake
  DROP_RATE: 2500, // L/s while the doors are open
  DOUSE_RADIUS: 58, // m — water kills fires inside this of the impact point
  DOUSE_LITRES: 400, // litres inside the radius needed to kill one fire
  // Scoring (big numbers, like the champions' screenshots).
  SCORE_FIRE: 12500,
  SCORE_ACCURACY_MAX: 8000,
  SCORE_LEG_BONUS_MAX: 40000,
  SCORE_LANDING_PERFECT: 25000,
  SCORE_LANDING_OK: 10000,
  SCORE_SCOOP: 1500,
  // Camera.
  CAM_DIST: 26, // m behind the plane
  CAM_HEIGHT: 7, // m above the plane
  FOV_DEG: 72,
  VIEW_DIST: 2600, // m — terrain drawn out to this
};

// The seven fire zones, in leg order. Each zone's three fire fronts sit in
// one tight cluster (about 80 m across), so one well-aimed drop can kill
// two or three at once — that is the skill the game rewards.
export const LEGS = [
  { name: 'PINE HOLLOW', fires: [[-1450, 1520], [-1408, 1562], [-1492, 1552]], wind: { from: 315, speed: 6 }, weather: 'SMOKE HAZE' },
  { name: 'COPPER RIDGE', fires: [[1210, 1445], [1252, 1485], [1168, 1495]], wind: { from: 280, speed: 9 }, weather: 'GUSTING NW' },
  { name: 'EMBER BLUFF', fires: [[1790, -268], [1832, -228], [1748, -238]], wind: { from: 250, speed: 11 }, weather: 'DRY WIND' },
  { name: 'SAGE FLATS', fires: [[-263, -1505], [-221, -1465], [-305, -1475]], wind: { from: 200, speed: 7 }, weather: 'CLEAR' },
  { name: 'TWIN LAKES', fires: [[-1843, -595], [-1801, -555], [-1885, -565]], wind: { from: 160, speed: 10 }, weather: 'CROSSWIND' },
  { name: 'OLD MILL', fires: [[573, -1095], [615, -1055], [531, -1065]], wind: { from: 90, speed: 8 }, weather: 'SMOKE HAZE' },
  { name: 'SUNSET PASS', fires: [[-650, 2162], [-608, 2202], [-692, 2192]], wind: { from: 330, speed: 12 }, weather: 'GUSTING NW' },
];

export const LAKE = { x: -950, z: 750, rx: 620, rz: 480 }; // scoop water here
export const AIRSTRIP = { x: 0, z: -650, heading: 0, length: 650, width: 42 }; // dirt runway, heading north
export const START = { x: -950, z: 750, heading: 1.35, speed: 0, onWater: true };

export const PALETTE = {
  skyTop: '#2b1e4e', skyMid: '#b34a2e', skyLow: '#f2a35e',
  sun: '#ffd9a0', cloud: 'rgba(255,214,180,0.55)',
  valley: '#5d7a3a', meadow: '#7d9b4a', forest: '#2e5230', rock: '#8a6a52',
  ridge: '#6e4f3d', sand: '#c2a06b', water: '#2e6f8e', waterDeep: '#1d4e6b',
  runway: '#3a3630', runwayLine: '#e8e0c8',
  fireCore: '#ffdf6b', fireMid: '#ff7a1a', fireEdge: '#d42a0e',
  smoke: 'rgba(60,52,48,0.5)',
  amber: '#ffb02e', red: '#ff4a3c', green: '#7ee081', cyan: '#7fd4ff',
  panel: 'rgba(12,14,20,0.78)', panelEdge: 'rgba(255,176,46,0.45)',
  text: '#f4ead8', dim: '#c9bda6',
};

export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyI'], pitchDown: ['ArrowDown', 'KeyK'],
  rollLeft: ['ArrowLeft', 'KeyJ'], rollRight: ['ArrowRight', 'KeyL'],
  throttleUp: ['KeyW', 'ShiftLeft', 'ShiftRight'], throttleDown: ['KeyS', 'ControlLeft'],
  drop: ['Space'], flaps: ['KeyF'], camera: ['KeyC'], pause: ['KeyP', 'Escape'],
  mute: ['KeyM'], restart: ['KeyR'],
};
