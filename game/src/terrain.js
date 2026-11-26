// terrain.js — The valley itself: heightfield, lake, airstrip, pine forest.
// One job: answer "how high is the ground here?" and hand the renderer
// the trees, the water and the runway. Everything is seeded, so the valley
// never changes between runs.
import { AIRSTRIP, CONFIG, LAKE, LEGS } from './config.js';
import { clamp, makeNoise, mulberry32 } from './random.js';

const noise = makeNoise(20261126);
const HALF = CONFIG.WORLD_SIZE / 2;

// Ridge walls rise toward the edges so the valley reads as a canyon.
function wallHeight(x, z) {
  const ex = Math.max(0, Math.abs(x) - 1900) / 1100;
  const ez = Math.max(0, Math.abs(z) - 1900) / 1100;
  return (ex * ex + ez * ez) * 420;
}

// A winding ridge spine down the east side, for a recognisable silhouette.
function spine(x, z) {
  const d = Math.abs(x - (900 + 350 * Math.sin(z / 900)));
  return Math.max(0, 1 - d / 700) * 130;
}

export function groundHeight(x, z) {
  const nx = clamp(x, -HALF, HALF), nz = clamp(z, -HALF, HALF);
  const n = noise(nx / 620 + 31.7, nz / 620 + 11.3, 4);
  let h = 42 + (n - 0.5) * 150 + wallHeight(nx, nz) + spine(nx, nz);
  // Lake basin: carved flat below the waterline.
  const lx = (nx - LAKE.x) / LAKE.rx, lz = (nz - LAKE.z) / LAKE.rz;
  const inLake = lx * lx + lz * lz;
  if (inLake < 1.15) h = Math.min(h, -6 + inLake * 8);
  // Airstrip + southern approach corridor: graded flat, so landings from
  // the south come down a valley floor, not into a hillside. The corridor
  // fades out 675 m south of the threshold and 130 m either side.
  const ax = Math.abs(nx - AIRSTRIP.x);
  const dz = nz - AIRSTRIP.z; // negative south of the strip centre
  let flat = 0;
  if (ax < AIRSTRIP.width && Math.abs(dz) < AIRSTRIP.length / 2 + 60) {
    flat = 1;
  } else if (dz < -(AIRSTRIP.length / 2) && dz > -1000) {
    const south = clamp(1 - (-(AIRSTRIP.length / 2) - dz) / 350, 0, 1);
    const side = clamp(1 - (ax - AIRSTRIP.width) / 130, 0, 1);
    flat = Math.min(south, side);
  }
  if (flat > 0) h = h * (1 - flat) + 42 * flat;
  return h;
}

export function isWater(x, z) {
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz;
  return lx * lx + lz * lz < 1 && groundHeight(x, z) < CONFIG.WATER_LEVEL;
}

export function isRunway(x, z) {
  return Math.abs(x - AIRSTRIP.x) < AIRSTRIP.width / 2 &&
    Math.abs(z - AIRSTRIP.z) < AIRSTRIP.length / 2;
}

// Slope (0 flat .. 1 cliff) from a small finite difference.
export function slopeAt(x, z) {
  const dx = groundHeight(x + 8, z) - groundHeight(x - 8, z);
  const dz = groundHeight(x, z + 8) - groundHeight(x, z - 8);
  return Math.min(1, Math.hypot(dx, dz) / 26);
}

// Pine forest: seeded positions on gentle, low ground, clear of the lake,
// the runway and the fire zones (so fires stay readable).
export const TREES = (() => {
  const rand = mulberry32(77123);
  const trees = [];
  let guard = 0;
  while (trees.length < 700 && guard++ < 20000) {
    const x = (rand() * 2 - 1) * 2600;
    const z = (rand() * 2 - 1) * 2600;
    const h = groundHeight(x, z);
    if (h < 48 || h > 150 || slopeAt(x, z) > 0.45) continue;
    if (isWater(x, z) || isRunway(x, z)) continue;
    if (LEGS.some((leg) => leg.fires.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 130))) continue;
    trees.push({ x, z, h, s: 9 + rand() * 9, shade: 0.75 + rand() * 0.45 });
  }
  return trees;
})();

// Fire-zone labels the HUD and the world agree on.
export function zoneName(i) { return LEGS[i].name; }
