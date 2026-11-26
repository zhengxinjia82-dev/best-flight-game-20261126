// plane.js — The flight model. One job: turn stick, throttle and wind into
// position, speed, fuel and damage, with stall, overspeed and hard landings
// that the HUD can show and the player can feel.
import { AIRSTRIP, CONFIG } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { groundHeight, isRunway, isWater } from './terrain.js';

export function newPlane() {
  return {
    x: -950, z: 750, y: 0.4, // floating on the lake at the start, on the water
    heading: 1.35, pitch: 0, bank: 0,
    speed: 0, throttle: 0, flaps: false,
    fuel: CONFIG.FUEL_MAX, water: CONFIG.WATER_MAX,
    damage: 0, vspeed: 0, onGround: true, onWater: true,
    stalled: false, overspeed: false, scraping: false,
    gearDown: true, time: 0,
  };
}

// input: {pitch:-1..1 (up positive), roll:-1..1 (right positive),
//          throttle:-1..1, drop:bool, flapsToggle:bool}
// wind: {x, z} drift in m/s. Returns events: ['takeoff'|'touchdown'|'crash'|...]
export function stepPlane(p, input, wind, dt, world) {
  const events = [];
  p.time += dt;

  // --- Throttle and drag ---
  p.throttle = clamp(p.throttle + input.throttle * dt * 0.55, 0, 1);
  const thrust = p.throttle * 62; // m/s^2 at full throttle
  const drag = 0.0042 * p.speed * p.speed + (p.flaps ? 3.2 : 0) + (p.onWater && p.speed > 4 ? 5.5 : 0);
  const stallSpeed = p.flaps ? CONFIG.STALL_FLAPS : CONFIG.STALL_SPEED;
  p.stalled = !p.onGround && p.speed < stallSpeed;

  // --- Attitude: bank into turns, pitch with the stick ---
  const targetBank = input.roll * CONFIG.MAX_BANK;
  p.bank += clamp(targetBank - p.bank, -1.9 * dt, 1.9 * dt);
  const targetPitch = input.pitch * CONFIG.MAX_PITCH * (p.stalled ? 0.4 : 1);
  p.pitch += clamp(targetPitch - p.pitch, -1.4 * dt, 1.4 * dt);

  // --- Turn: banked lift turns the nose ---
  const turnRate = (CONFIG.TURN_G * Math.tan(p.bank)) / Math.max(18, p.speed);
  p.heading = wrapAngle(p.heading + turnRate * dt);

  // --- Speed: thrust minus drag, minus the climb penalty ---
  const climbFactor = Math.sin(p.pitch);
  let accel = thrust - drag - CONFIG.TURN_G * climbFactor * 0.9;
  if (p.stalled) accel -= 6; // a stalled wing sinks and slows
  p.speed = Math.max(0, p.speed + accel * dt);

  // --- Vertical speed from pitch and lift ---
  const liftSpeed = Math.max(0, p.speed - stallSpeed);
  let vs = Math.sin(p.pitch) * p.speed * 0.85;
  if (!p.onGround) vs += clamp((liftSpeed - 14) * 0.12, -6, 9);
  if (p.stalled) vs -= 5; // a stalled wing sinks firmly, not like a stone
  p.vspeed = vs;

  // --- Position, with wind drift (only while airborne: a parked plane
  // does not blow down the runway) ---
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const drift = p.onGround ? 0 : 1;
  p.x += (fx * p.speed * Math.cos(p.pitch) + wind.x * drift) * dt;
  p.z += (fz * p.speed * Math.cos(p.pitch) + wind.z * drift) * dt;
  p.y += vs * dt;

  // --- Fuel: throttle discipline matters — full power burns ~4x cruise ---
  const burn = (0.22 + p.throttle * p.throttle * 1.55) * dt;
  p.fuel = Math.max(0, p.fuel - burn);
  if (p.fuel <= 0 && p.throttle > 0) { p.throttle = 0; events.push('flameout'); }

  // --- Overspeed damage in a dive ---
  p.overspeed = p.speed > CONFIG.MAX_SPEED;
  if (p.overspeed && !p.onGround) {
    p.damage = Math.min(100, p.damage + 4 * dt);
    events.push('overspeed');
  }

  // --- Ground / water contact ---
  // Ground stickiness: a hair of positive vertical speed at taxi speed is
  // not flight. The plane only leaves the ground once it is fast enough
  // to fly; until then it stays planted and no landing is evaluated.
  const ground = groundHeight(p.x, p.z);
  const overWater = isWater(p.x, p.z);
  const overRunway = isRunway(p.x, p.z);
  const floorY = overWater ? CONFIG.WATER_LEVEL : ground;
  const wasOnGround = p.onGround;
  if (p.y <= floorY + 0.4) {
    const hard = p.vspeed < -3.6 || Math.abs(p.bank) > 0.55 || p.speed > 62;
    const level = Math.abs(p.pitch) < 0.16 && Math.abs(p.bank) < 0.3;
    if (!wasOnGround) {
      if (overWater && p.speed < 55 && level) {
        events.push('splashdown'); // floats kiss the lake: a good water landing
      } else if (overRunway && p.speed < 58 && level) {
        events.push(hard ? 'hard-landing' : 'touchdown');
      } else if (p.speed < 50 && level && Math.abs(p.x - AIRSTRIP.x) < 70 &&
        Math.abs(p.z - AIRSTRIP.z) < AIRSTRIP.length / 2 + 100) {
        events.push(hard ? 'hard-landing' : 'touchdown'); // graded grass beside the strip
      } else if (p.speed < 12 && level) {
        events.push('touchdown');
      } else {
        events.push('crash');
      }
    }
    // A gentle kiss at low vertical speed is never "hard": only a genuine
    // landing from the air, falling fast, damages the airframe.
    const reallyHard = !wasOnGround && hard && p.vspeed < -3.6;
    if (reallyHard) {
      p.damage = Math.min(100, p.damage + 14);
      events.push('hard-landing');
    }
    p.y = floorY + 0.4;
    p.onGround = true;
    p.onWater = overWater;
    p.pitch *= 0.4; p.bank *= 0.5;
    // Rolling friction on ground, water drag while planing.
    p.speed = Math.max(0, p.speed - (overWater ? 9 : 5.5) * dt);
    if (p.speed < 2 && input.throttle <= 0) p.speed = 0;
  } else if (wasOnGround && p.speed < stallSpeed + 6) {
    // Not fast enough to fly yet: stay on the water / runway.
    p.y = floorY + 0.4;
    p.onGround = true;
    p.onWater = overWater;
    p.speed = Math.max(0, p.speed - (overWater ? 9 : 5.5) * dt);
  } else {
    if (wasOnGround && p.speed > stallSpeed + 6 && p.pitch > 0.06) {
      events.push('takeoff');
    }
    p.onGround = false;
    p.onWater = false;
  }

  // --- Terrain scrape while genuinely about to hit the ground ---
  // Scrape: fast descent within half a metre of terrain (a gentle
  // flare settle just above the strip is a landing, not a strike).
  if (!p.onGround && p.y < ground + 0.5 && p.vspeed < -2 && !overWater) {
    p.scraping = true;
    p.damage = Math.min(100, p.damage + 10 * dt);
    events.push('scrape');
  } else p.scraping = false;

  // --- Water scoop: skimming the lake fills the tank ---
  if (p.onWater && p.speed > 12 && p.speed < 48 && world) {
    const before = p.water;
    p.water = Math.min(CONFIG.WATER_MAX, p.water + CONFIG.SCOOP_RATE * dt);
    if (p.water >= CONFIG.WATER_MAX && before < CONFIG.WATER_MAX) events.push('tank-full');
    else if (p.water > before + 1) events.push('scooping');
  }

  if (p.damage >= 100) events.push('crash');
  return events;
}

// Drop water: returns the impact point on the ground ahead-below, or null.
export function dropImpact(p, wind) {
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const fallTime = Math.sqrt(Math.max(0.1, (2 * p.y) / 9.81));
  const dist = p.speed * fallTime * 0.9;
  return {
    x: p.x + fx * dist + wind.x * fallTime,
    z: p.z + fz * dist + wind.z * fallTime,
    fallTime,
  };
}

export function knots(ms) { return ms * 1.94384; }
export function feet(m) { return m * 3.28084; }
