// random.js — Seeded randomness and value noise. One job: deterministic
// numbers, so a fixed seed always builds the same valley, trees and fires.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise from a seeded lattice, with fBm octaves.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const SIZE = 64;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (ix, iz) => grid[((iz % SIZE + SIZE) % SIZE) * SIZE + ((ix % SIZE + SIZE) % SIZE)];
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  return function fbm(x, z, octaves = 4) {
    let v = 0, amp = 1, freq = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      v += noise(x * freq, z * freq) * amp;
      total += amp; amp *= 0.5; freq *= 2.03;
    }
    return v / total; // 0..1
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function degToRad(d) { return (d * Math.PI) / 180; }
export function fmt(n, digits = 0) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
