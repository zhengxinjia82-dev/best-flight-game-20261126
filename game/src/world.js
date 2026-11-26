// world.js — The mission: seven legs, twenty-one fires, the objective chain
// (scoop → drop → next leg), wind, and the score. One job: know what the
// player has to do next and what it is worth.
import { CONFIG, LAKE, LEGS } from './config.js';
import { clamp } from './random.js';

export function newWorld() {
  const fires = [];
  LEGS.forEach((leg, li) => {
    leg.fires.forEach(([x, z], fi) => {
      fires.push({ leg: li, id: li * 3 + fi, x, z, alive: true, heat: 0.7 + Math.random() * 0.3, size: 26 + Math.random() * 14 });
    });
  });
  return {
    leg: 0, phase: 'drop', // 'drop' (tank full, go to the fires) or 'scoop' (tank empty, go to the lake)
    fires,
    score: 0, chain: 0, bestChain: 0,
    legStartTime: 0, elapsed: 0,
    drops: 0, scoops: 0, landings: 0, perfectLandings: 0,
    firesOut: 0, refuels: 0,
    wind: legWind(0),
    message: '', messageUntil: 0,
    finished: false, victory: false,
  };
}

export function legWind(i) {
  const w = LEGS[i].wind;
  const rad = ((w.from + 180) % 360) * Math.PI / 180; // wind FROM -> drift TO
  return { from: w.from, speed: w.speed, x: Math.sin(rad) * w.speed, z: Math.cos(rad) * w.speed };
}

export function activeFires(w) { return w.fires.filter((f) => f.alive && f.leg === w.leg); }
export function firesLeft(w) { return w.fires.filter((f) => f.alive).length; }

// Where the amber target ring floats: the lake while scooping, the centre
// of the current leg's fires while dropping, the runway once all fires are out.
export function currentObjective(w) {
  if (w.finished) return { kind: 'land', x: 0, z: -650, y: 60, label: 'LAND — EMBER AIRSTRIP' };
  if (w.phase === 'scoop') return { kind: 'scoop', x: LAKE.x, z: LAKE.z, y: 26, label: 'SCOOP — TWIN LAKES' };
  const fires = activeFires(w);
  const cx = fires.reduce((s, f) => s + f.x, 0) / Math.max(1, fires.length);
  const cz = fires.reduce((s, f) => s + f.z, 0) / Math.max(1, fires.length);
  return { kind: 'drop', x: cx, z: cz, y: 150, label: `DROP — ${LEGS[w.leg].name}` };
}

export function objectiveDistance(w, plane) {
  const o = currentObjective(w);
  return Math.hypot(o.x - plane.x, o.z - plane.z);
}

// A drop lands at (x, z) with `litres` of water. Returns the fires it killed
// and the points earned, with the chain multiplier applied.
export function applyDrop(w, x, z, litres, now) {
  const killed = [];
  let points = 0;
  for (const f of activeFires(w)) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < CONFIG.DOUSE_RADIUS && litres >= CONFIG.DOUSE_LITRES) {
      f.alive = false;
      killed.push(f);
      const accuracy = clamp(1 - d / CONFIG.DOUSE_RADIUS, 0, 1);
      points += Math.round((CONFIG.SCORE_FIRE + accuracy * CONFIG.SCORE_ACCURACY_MAX) * (1 + 0.25 * w.chain));
    }
  }
  if (killed.length) {
    w.chain += killed.length;
    w.bestChain = Math.max(w.bestChain, w.chain);
    w.firesOut += killed.length;
    w.score += points;
    w.drops += 1;
  } else {
    w.chain = 0; // a dry drop breaks the chain
  }
  // Leg done when its fires are out: time bonus, then the next leg.
  if (activeFires(w).length === 0 && !w.finished) {
    const legTime = now - w.legStartTime;
    const bonus = Math.round(clamp(1 - legTime / 240, 0.15, 1) * CONFIG.SCORE_LEG_BONUS_MAX);
    w.score += bonus;
    const doneLeg = w.leg;
    w.leg += 1;
    if (w.leg >= LEGS.length) {
      w.finished = true;
    } else {
      w.wind = legWind(w.leg);
      w.legStartTime = now;
      w.phase = w.phase; // keep phase: tank is empty after a drop, so scoop next
    }
    return { killed, points, legBonus: bonus, legDone: doneLeg };
  }
  return { killed, points, legBonus: 0, legDone: -1 };
}

export function onScoopFull(w) {
  w.scoops += 1;
  w.score += CONFIG.SCORE_SCOOP;
  w.phase = 'drop';
}

export function onTankEmpty(w) {
  if (!w.finished) w.phase = 'scoop';
}

export function onLanding(w, perfect) {
  w.landings += 1;
  if (perfect) {
    w.perfectLandings += 1;
    w.score += CONFIG.SCORE_LANDING_PERFECT;
  } else {
    w.score += CONFIG.SCORE_LANDING_OK;
  }
}

export function onRefuel(w) {
  w.refuels += 1;
}

// Fuel state as a decision, not just a bar: can the plane still reach the
// objective and get back to the strip? (HUD shows the verdict.)
export function fuelVerdict(w, plane) {
  const dist = objectiveDistance(w, plane);
  const need = dist * 0.55 + 120; // kg to get there and divert to the strip
  if (plane.fuel <= CONFIG.FUEL_BINGO) return { level: 'bingo', text: 'BINGO FUEL — DIVERT TO STRIP' };
  if (plane.fuel < need) return { level: 'tight', text: 'FUEL TIGHT — FLY DIRECT OR DIVERT' };
  return { level: 'ok', text: 'FUEL OK FOR THIS LEG' };
}
