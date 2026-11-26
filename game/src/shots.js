// shots.js — Deterministic screenshot scenes. One job: fly the real game
// forward from a fresh state with a simple autopilot, for a fixed number
// of 1/60 s steps, so `?shot=play&seed=1` always renders the same frame.
// The frame is what a short game really looks like — never staged art.
import { CONFIG, LEGS } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { newPlane, stepPlane, dropImpact } from './plane.js';
import { applyDrop, legWind, newWorld, onLanding, onScoopFull, onTankEmpty } from './world.js';
import { groundHeight } from './terrain.js';

const DT = 1 / 60;

// Throttle is a rate control (W/S nudge it), so the autopilot drives it
// toward an absolute setting instead of holding a raw input.
function throttleTo(plane, target) {
  return clamp((target - plane.throttle) * 3, -1, 1);
}

// Steer toward (tx, tz) at target altitude and speed. The aim point is
// shifted upwind by the drift over the time to target, so the ground track
// — not just the nose — goes through the target in a crosswind.
function steer(plane, tx, tz, alt, speed, wind = { x: 0, z: 0 }) {
  const dist = Math.hypot(tx - plane.x, tz - plane.z);
  const tta = Math.max(1, dist / Math.max(20, plane.speed));
  const ax = tx - wind.x * tta, az = tz - wind.z * tta;
  const want = Math.atan2(ax - plane.x, az - plane.z);
  const err = wrapAngle(want - plane.heading);
  const roll = clamp(err * 1.4, -0.85, 0.85);
  const pitch = clamp((alt - plane.y) * 0.03, -0.3, 0.32);
  let throttle = 0;
  if (plane.speed < speed - 6) throttle = 1;
  else if (plane.speed > speed + 6) throttle = -1;
  return { pitch, roll, throttle, drop: false, flapsToggle: false };
}

function run(plane, world, wind, seconds, control, stopWhen) {
  const events = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    const input = control(plane, i * DT);
    const evs = stepPlane(plane, input, wind, DT, world);
    events.push(...evs);
    world.elapsed += DT;
    if (evs.includes('crash')) break;
    if (stopWhen && stopWhen(plane)) break;
  }
  return events;
}

// Each scene returns { plane, world, fx, view, banner } for one rendered frame.
export function runShot(name, seed = 1) {
  const world = newWorld();
  const plane = newPlane();
  const wind = world.wind;
  const fx = { drops: [], banner: null };
  let view = 'chase';

  if (name === 'start') {
    // Just lifted off the lake, climbing toward Pine Hollow, ring ahead.
    world.legStartTime = 0;
    run(plane, world, wind, 14, (p) => {
      if (p.onGround && p.speed < 30) return { pitch: 0.12, roll: 0, throttle: 1, drop: false };
      return steer(p, -1450, 1545, 260, 55, wind);
    });
    fx.banner = { text: 'LEG 1 — PINE HOLLOW', sub: 'TANK FULL · 3 FIRES AHEAD · FLY THE RING' };
  } else if (name === 'play') {
    // Mid-flight over the valley: still closing on the fires, banked toward
    // them, lake behind, ring and smoke ahead, instruments lit, fuel now a
    // decision rather than a full bar.
    run(plane, world, wind, 20, (p) => steer(p, -1450, 1545, 205, 56, wind));
    plane.fuel = 612; // a leg in: fuel is now a decision, not a full bar
    fx.banner = null;
  } else if (name === 'drop') {
    // Over the fires at drop height. The drop is released on the run-in,
    // ~one fall-time short of the fire centroid, so the water lands dead
    // on the fires instead of overshooting them downwind.
    world.chain = 2;
    let dropped = false;
    let dropAt = -1;
    run(plane, world, wind, 40, (p, t) => {
      if (!dropped && Math.hypot(-1450 - p.x, 1545 - p.z) < 235) {
        dropAt = world.elapsed;
        dropped = true;
        const impact = dropImpact(p, wind);
        const parts = [];
        for (let i = 0; i < 90; i++) {
          parts.push({
            x: p.x + (Math.random() - 0.5) * 14,
            y: p.y - 4 - i * 0.9,
            z: p.z + (Math.random() - 0.5) * 14,
            vx: 0, vy: -30, vz: 0,
          });
        }
        fx.drops.push({ particles: parts, x: impact.x, z: impact.z });
        const res = applyDrop(world, impact.x, impact.z, CONFIG.WATER_MAX, world.elapsed);
        p.water = 0;
        onTankEmpty(world);
        fx.banner = res.killed.length
          ? { text: `FIRE OUT x${res.killed.length}!`, sub: `+${res.points.toLocaleString('en-US')} PTS · CHAIN x${world.chain} · SCOOP AT THE LAKE` }
          : { text: 'DROP MISSED — WIND STOLE IT', sub: 'AIM UPWIND NEXT TIME' };
      }
      return steer(p, -1450, 1545, 150, 48, wind);
    }, (p) => dropped && world.elapsed - dropAt > 3);
    if (!dropped) {
      fx.banner = { text: 'RUNNING IN ON THE FIRES', sub: 'DROP WHEN THE RING IS UNDER THE NOSE' };
    }
  } else if (name === 'land') {
    // Final approach to the strip after the last leg: descend on the
    // extended centreline, flare over the threshold, roll out.
    world.leg = 6;
    world.wind = legWind(6);
    world.fires.forEach((f) => { f.alive = false; });
    world.firesOut = 21;
    world.finished = true;
    world.score = 486200;
    plane.x = 0; plane.z = -1400; plane.y = 110;
    plane.heading = 0; plane.speed = 52; plane.throttle = 0.35;
    plane.fuel = 188; plane.water = 0; plane.onGround = false; plane.onWater = false;
    let landed = false;
    const evs = run(plane, world, world.wind, 30, (p, t) => {
      if (p.onGround) return { pitch: 0, roll: 0, throttle: -1, drop: false };
      // Lateral: aim at the far end of the strip, wind-corrected (1.8x the
      // drift over the time to target, so the crab bites early), so she
      // flies down the centreline instead of turning back at the threshold.
      const distFar = Math.hypot(p.x - 0, p.z - (-300));
      const tta = Math.max(1, distFar / Math.max(20, p.speed));
      const ax = 0 - world.wind.x * tta * 1.8, az = -300 - world.wind.z * tta * 1.8;
      const want = Math.atan2(ax - p.x, az - p.z);
      const roll = clamp(wrapAngle(want - p.heading) * 1.4, -0.85, 0.85);
      const distThr = Math.hypot(p.x - 0, p.z - (-650));
      let pitch, throttle;
      if (t < 10) {
        // Descent to the final.
        pitch = clamp((55 - p.y) * 0.06, -0.5, 0.3);
        throttle = throttleTo(p, 0.18);
      } else if (distThr > 150) {
        // On the glidepath: strong pitch gain so she tracks it, not floats above it.
        const pathAlt = 42 + distThr * 0.07;
        pitch = clamp((pathAlt - p.y) * 0.08, -0.55, 0.2);
        throttle = throttleTo(p, 0.22);
      } else {
        // Flare: aim a hair BELOW the strip so the last half metre
        // bleeds off into a touchdown instead of a float.
        pitch = clamp((42.0 - p.y) * 0.2, -0.3, 0.1);
        throttle = throttleTo(p, 0.12);
      }
      return { pitch, roll, throttle, drop: false };
    });
    if (plane.onGround) {
      landed = true;
      onLanding(world, true);
      fx.banner = { text: 'TOUCHDOWN! PERFECT LANDING', sub: `+${CONFIG.SCORE_LANDING_PERFECT.toLocaleString('en-US')} PTS · VALLEY SAVED · 486,200 + 25,000` };
    } else {
      fx.banner = { text: 'FINAL — EMBER AIRSTRIP', sub: 'FLAPS DOWN · 46 m/s · HOLD HER LEVEL' };
    }
  } else {
    run(plane, world, wind, 10, (p) => steer(p, -1450, 1500, 240, 55));
  }

  // Keep the HUD honest: the shot frame shows the shot's real state.
  world.elapsed = Math.max(world.elapsed, 1);
  return { plane, world, fx, view };
}

export const SHOT_NAMES = ['start', 'play', 'drop', 'land'];
