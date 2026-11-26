// hud.js — The DOM heads-up display: top bar, flight-plan panel, next
// waypoint panel, controls strip, celebration banners and the title /
// pause / end screens. One job: make the game readable at a glance —
// about thirty information points on screen at once, like the champions.
import { CONFIG, LEGS } from './config.js';
import { fmt } from './random.js';
import { activeFires, currentObjective, firesLeft, fuelVerdict, objectiveDistance } from './world.js';

let els = {};
let bannerTimer = 0;

export function initHud() {
  els = {
    top: document.getElementById('hud-top'),
    mission: document.getElementById('hud-mission'),
    leg: document.getElementById('hud-leg'),
    winlose: document.getElementById('hud-winlose'),
    timer: document.getElementById('hud-timer'),
    score: document.getElementById('hud-score'),
    best: document.getElementById('hud-best'),
    plan: document.getElementById('hud-plan'),
    fuel: document.getElementById('hud-fuel'),
    damage: document.getElementById('hud-damage'),
    water: document.getElementById('hud-water'),
    fuelVerdict: document.getElementById('hud-fuel-verdict'),
    next: document.getElementById('hud-next'),
    nextDist: document.getElementById('hud-next-dist'),
    wind: document.getElementById('hud-wind'),
    weather: document.getElementById('hud-weather'),
    fires: document.getElementById('hud-fires'),
    chain: document.getElementById('hud-chain'),
    banner: document.getElementById('hud-banner'),
    bannerSub: document.getElementById('hud-banner-sub'),
    screen: document.getElementById('screen'),
    bottom: document.getElementById('hud-bottom'),
  };
}

export function showBanner(text, sub = '', ms = 2600) {
  els.banner.textContent = text;
  els.bannerSub.textContent = sub;
  els.banner.parentElement.classList.add('show');
  bannerTimer = ms;
}

export function tickBanner(dt) {
  if (bannerTimer > 0) {
    bannerTimer -= dt * 1000;
    if (bannerTimer <= 0) els.banner.parentElement.classList.remove('show');
  }
}

// The canvas needs to know: a visible banner sits high on the screen, so
// the target-ring label must drop below the ring instead of above it.
export function bannerVisible() {
  return bannerTimer > 0;
}

function mmss(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function updateHud(plane, world, best) {
  if (!els.top) return;
  const leg = LEGS[Math.min(world.leg, LEGS.length - 1)];
  els.mission.textContent = world.finished ? 'RTB — EMBER AIRSTRIP' : `LEG ${world.leg + 1} — ${leg.name}`;
  els.leg.textContent = `LEG ${Math.min(world.leg + 1, 7)}/7`;
  els.winlose.textContent = world.finished ? 'WIN: LAND ON THE STRIP' : 'WIN: ALL 21 FIRES OUT  ·  LOSE: FUEL 0 / CRASH';
  els.timer.textContent = mmss(world.elapsed);
  els.score.textContent = fmt(world.score);
  els.best.textContent = `BEST ${fmt(best)}`;

  // Left: flight plan with ticks, fuel / damage / water readouts.
  let plan = '';
  LEGS.forEach((l, i) => {
    const state = i < world.leg ? '✓ DONE' : i === world.leg ? '▶ FLYING' : '· QUEUED';
    const cls = i < world.leg ? 'done' : i === world.leg ? 'now' : '';
    plan += `<div class="plan-row ${cls}"><span>${i + 1}. ${l.name}</span><span>${state}</span></div>`;
  });
  plan += `<div class="plan-row"><span>FIRES OUT</span><span>${world.firesOut} / 21</span></div>`;
  plan += `<div class="plan-row"><span>SCOOPS</span><span>${world.scoops}</span></div>`;
  plan += `<div class="plan-row"><span>LANDINGS</span><span>${world.landings} (${world.perfectLandings} PERFECT)</span></div>`;
  els.plan.innerHTML = plan;
  els.fuel.textContent = `${Math.round(plane.fuel)} kg (${Math.round((plane.fuel / CONFIG.FUEL_MAX) * 100)}%)`;
  els.damage.textContent = `${Math.round(plane.damage)}%`;
  els.damage.parentElement.classList.toggle('bad', plane.damage > 55);
  els.water.textContent = `${Math.round(plane.water)} L`;
  const verdict = fuelVerdict(world, plane);
  els.fuelVerdict.textContent = verdict.text;
  els.fuelVerdict.className = `verdict ${verdict.level}`;

  // Right: next objective, wind, weather, chain.
  const obj = currentObjective(world);
  els.next.textContent = obj.label;
  els.nextDist.textContent = `${fmt(Math.round(objectiveDistance(world, plane)))} m`;
  els.wind.textContent = `${world.wind.from}° · ${world.wind.speed} m/s`;
  els.weather.textContent = `${leg.weather} · 12km`;
  els.fires.textContent = `${firesLeft(world)} LEFT · ${activeFires(world).length} THIS LEG`;
  els.chain.textContent = world.chain > 1 ? `CHAIN x${world.chain} — KEEP DROPPING!` : world.chain === 1 ? 'CHAIN x1' : 'NO CHAIN — DROP ON A FIRE';
}

export function showScreen(html) {
  els.screen.innerHTML = html;
  els.screen.classList.add('show');
}

export function hideScreen() {
  els.screen.classList.remove('show');
  els.screen.innerHTML = '';
}

export function titleScreen(best) {
  return `
  <div class="panel title">
    <div class="kicker">MAKE.FUN · BEST FLIGHT GAME</div>
    <h1>EMBERWING</h1>
    <div class="sub">WILDFIRE WATER BOMBER — 7 LEGS · 21 FIRES · 1 VALLEY</div>
    <p class="story">The canyon is burning. You fly the Emberwing, an amphibious water
    bomber: skim the lake to fill her 3,000&nbsp;L tank, climb out over the pines,
    and drop it on the fire — dead on, or the wind steals it. Fuel is a decision:
    push on with a light tank, or divert to the strip and refuel while the fire spreads.</p>
    <div class="facts">
      <div><b>7</b><span>LEGS</span></div>
      <div><b>21</b><span>FIRES</span></div>
      <div><b>3,000 L</b><span>TANK</span></div>
      <div><b>900 kg</b><span>FUEL</span></div>
      <div><b>5</b><span>WIND STATES</span></div>
    </div>
    <button class="big" id="btn-start">▶ &nbsp;FLY LEG 1 — PINE HOLLOW</button>
    <div class="hint">BEST SCORE ${fmt(best)} · Click or press Enter to fly · M mutes · C switches cockpit view</div>
    <div class="controls">
      <span><b>↑ ↓</b> pitch</span><span><b>← →</b> bank &amp; turn</span>
      <span><b>W / S</b> throttle</span><span><b>SPACE</b> drop water</span>
      <span><b>F</b> flaps</span><span><b>P</b> pause</span>
    </div>
  </div>`;
}

export function pauseScreen() {
  return `<div class="panel small"><h2>PAUSED</h2>
    <p>Emberwing is holding over the valley. Press P to keep flying.</p>
    <button class="big" id="btn-resume">RESUME</button></div>`;
}

export function endScreen(world, plane, best, victory, cause) {
  const title = victory ? 'VALLEY SAVED!' : cause === 'crash' ? 'EMBERWING DOWN' : 'OUT OF FUEL';
  const line = victory
    ? 'All 21 fires are out. The valley breathes again — and the Emberwing is famous.'
    : cause === 'crash'
      ? 'The airframe gave up over the canyon. The fires are still burning.'
      : 'The tanks ran dry over the valley. A bomber with no fuel is a glider with a deadline.';
  return `<div class="panel small">
    <h2>${title}</h2><p>${line}</p>
    <div class="facts">
      <div><b>${fmt(world.score)}</b><span>SCORE</span></div>
      <div><b>${world.firesOut}/21</b><span>FIRES OUT</span></div>
      <div><b>x${world.bestChain}</b><span>BEST CHAIN</span></div>
      <div><b>${world.perfectLandings}</b><span>PERFECT LANDINGS</span></div>
      <div><b>${mmss(world.elapsed)}</b><span>TIME</span></div>
    </div>
    <div class="hint">BEST ${fmt(best)}</div>
    <button class="big" id="btn-again">↻ &nbsp;FLY AGAIN</button>
    <div class="hint">R restarts · the valley resets, the fires come back</div></div>`;
}
