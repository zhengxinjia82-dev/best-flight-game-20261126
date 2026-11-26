// main.js — The game loop and state machine: title → flying → paused /
// over, plus the deterministic screenshot mode (?shot=start|play|drop|land).
// One job: wire input, flight model, world, renderer, instruments, HUD and
// audio together, and keep every frame honest.
import { CONFIG, KEYS } from './config.js';
import { newPlane, stepPlane, dropImpact, knots } from './plane.js';
import { applyDrop, currentObjective, firesLeft, newWorld, onLanding, onRefuel, onScoopFull, onTankEmpty } from './world.js';
import { renderScene } from './render3d.js';
import { drawAircraft, drawCockpitFrame } from './aircraft.js';
import { drawInstruments } from './instruments.js';
import { newInput } from './input.js';
import { ensureAudio, playAlarm, playDrop, playFireOut, playLegDone, playScoop, playThud, setCrackle, setEngine, toggleMute } from './audio.js';
import { bannerVisible, endScreen, hideScreen, initHud, pauseScreen, showBanner, showScreen, tickBanner, titleScreen, updateHud } from './hud.js';
import { runShot } from './shots.js';
import { groundHeight, isRunway } from './terrain.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 1280, H = 720;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  // Assigning canvas.width clears the backing store even when the value
  // is unchanged, so only touch it when the size really moved.
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

const BEST_KEY = 'emberwing-best';
let best = Number(localStorage.getItem(BEST_KEY) || 0);
function saveBest() {
  if (game.world.score > best) {
    best = game.world.score;
    localStorage.setItem(BEST_KEY, String(best));
  }
}

const input = newInput();
const game = {
  state: 'title', // title | playing | paused | over
  plane: newPlane(),
  world: newWorld(),
  view: 'chase',
  fx: { drops: [], pending: [] },
  dropping: false,
  refuelTimer: 0,
  alarmTimer: 0,
  over: null,
};

function resetGame() {
  game.plane = newPlane();
  game.world = newWorld();
  game.fx = { drops: [], pending: [] };
  game.dropping = false;
  game.state = 'playing';
  game.over = null;
  hideScreen();
  showBanner('LEG 1 — PINE HOLLOW', 'TANK FULL · 3 FIRES AHEAD · FLY THE RING', 3200);
}

function startFromTitle() {
  ensureAudio();
  resetGame();
}

// --- Event handling: turn flight-model events into banners, sound, score ---
function handleEvents(events, dt) {
  const p = game.plane, w = game.world;
  for (const ev of events) {
    if (ev === 'takeoff') showBanner('AIRBORNE!', 'GEAR UP · CLIMB TO 200 m', 2200);
    if (ev === 'splashdown') { showBanner('SPLASHDOWN', 'FLOATS DOWN · SHE IS A BOAT NOW', 2200); playThud(); }
    if (ev === 'scooping') { /* tank filling: HUD water bar climbs */ }
    if (ev === 'tank-full') { onScoopFull(w); showBanner('TANK FULL — 3,000 L!', '+1,500 PTS · GO DROP IT', 2600); playScoop(); }
    if (ev === 'touchdown') {
      const perfect = p.vspeed > -3 && Math.abs(p.bank) < 0.25;
      onLanding(w, perfect);
      showBanner(perfect ? 'TOUCHDOWN! PERFECT LANDING' : 'TOUCHDOWN', perfect ? '+25,000 PTS' : '+10,000 PTS', 2800);
      playThud();
      if (w.finished) endGame(true, 'landed');
    }
    if (ev === 'hard-landing') { showBanner('HARD LANDING!', 'DAMAGE +14% · EASE HER DOWN NEXT TIME', 2600); playThud(); }
    if (ev === 'crash') { endGame(false, 'crash'); return; }
    if (ev === 'flameout') { showBanner('FLAMEOUT — NO FUEL', 'SHE IS A GLIDER NOW', 3000); playAlarm(); }
    if (ev === 'overspeed') { if (game.alarmTimer <= 0) { playAlarm(); game.alarmTimer = 1.2; } }
    if (ev === 'scrape') { showBanner('TERRAIN! PULL UP!', '', 1200); }
  }
  if (p.stalled && game.alarmTimer <= 0) { playAlarm(); game.alarmTimer = 1.5; }
  game.alarmTimer -= dt;
}

// --- Water drop: doors open, plume falls, douse lands after fall time ---
function updateDrops(dt) {
  const p = game.plane, w = game.world;
  if (game.dropping) {
    p.water = Math.max(0, p.water - CONFIG.DROP_RATE * dt);
    const n = 6;
    for (let i = 0; i < n; i++) {
      game.fx.drops.push({
        x: p.x + (Math.random() - 0.5) * 10, y: p.y - 3, z: p.z + (Math.random() - 0.5) * 10,
        vy: -6, t: 0,
      });
    }
    if (p.water <= 0) { game.dropping = false; onTankEmpty(w); }
  }
  for (const d of game.fx.drops) { d.t += dt; d.y += d.vy * dt; d.vy -= 22 * dt; }
  game.fx.drops = game.fx.drops.filter((d) => d.y > groundHeight(d.x, d.z) - 2 && d.t < 6);
  // Pending douses land when their water reaches the ground.
  for (const pd of game.fx.pending) {
    pd.t -= dt;
    if (pd.t <= 0) {
      const res = applyDrop(w, pd.x, pd.z, pd.litres, w.elapsed);
      if (res.killed.length) {
        showBanner(`FIRE OUT x${res.killed.length}!`, `+${res.points.toLocaleString('en-US')} PTS · CHAIN x${w.chain}`, 2600);
        playFireOut();
        if (res.legDone >= 0) {
          playLegDone();
          if (!w.finished) showBanner(`LEG ${res.legDone + 1} CLEAR — ${'PINE HOLLOW,COPPER RIDGE,EMBER BLUFF,SAGE FLATS,TWIN LAKES,OLD MILL,SUNSET PASS'.split(',')[res.legDone]} SAVED`, `LEG BONUS +${res.legBonus.toLocaleString('en-US')} PTS · SCOOP FOR THE NEXT LEG`, 3400);
          else showBanner('ALL 21 FIRES OUT!', 'NOW LAND HER ON THE STRIP — RTB', 3600);
        }
      } else {
        showBanner('DROP MISSED', 'THE WIND STOLE IT — AIM UPWIND', 2200);
      }
    }
  }
  game.fx.pending = game.fx.pending.filter((pd) => pd.t > 0);
}

function endGame(victory, cause) {
  game.state = 'over';
  game.over = { victory, cause };
  saveBest();
  showScreen(endScreen(game.world, game.plane, best, victory, cause));
  wireButtons();
}

function wireButtons() {
  const start = document.getElementById('btn-start');
  if (start) start.addEventListener('click', startFromTitle);
  const resume = document.getElementById('btn-resume');
  if (resume) resume.addEventListener('click', () => { game.state = 'playing'; hideScreen(); });
  const again = document.getElementById('btn-again');
  if (again) again.addEventListener('click', () => { resetGame(); });
}

// --- One frame of the live game ---
let last = performance.now();
let hudTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'playing') {
    input.poll();
    const p = game.plane, w = game.world;
    w.elapsed += dt;
    if (input.anyPressed(KEYS.camera)) game.view = game.view === 'chase' ? 'cockpit' : 'chase';
    if (input.anyPressed(KEYS.pause)) { game.state = 'paused'; showScreen(pauseScreen()); wireButtons(); }
    if (input.anyPressed(KEYS.mute)) toggleMute();
    if (input.anyPressed(KEYS.restart)) resetGame();
    if (input.consume('KeyF')) p.flaps = !p.flaps;
    if (input.drop && p.water > 0 && !p.onGround && !game.dropping) {
      game.dropping = true;
      const impact = dropImpact(p, w.wind);
      game.fx.pending.push({ x: impact.x, z: impact.z, litres: Math.min(p.water, CONFIG.WATER_MAX), t: impact.fallTime });
      playDrop();
    }
    if (!input.drop) game.dropping = false;
    const events = stepPlane(p, input, w.wind, dt, w);
    handleEvents(events, dt);
    updateDrops(dt);
    // Refuel on the strip: hold still on the runway and she fills up.
    if (p.onGround && isRunway(p.x, p.z) && p.speed < 2 && p.fuel < CONFIG.FUEL_MAX) {
      p.fuel = Math.min(CONFIG.FUEL_MAX, p.fuel + 70 * dt);
      game.refuelTimer += dt;
      if (game.refuelTimer > 1.2) { showBanner('REFUELLING…', `${Math.round(p.fuel)} kg — THE FIRE WAITS FOR NO ONE`, 1200); game.refuelTimer = 0; onRefuel(w); }
    } else game.refuelTimer = 0;
    // Out of fuel on the ground with no way forward.
    if (p.fuel <= 0 && p.onGround && p.speed < 1 && !w.finished) endGame(false, 'fuel');
    setEngine(p.throttle, p.speed * 1.944);
    const near = w.fires.filter((f) => f.alive).reduce((m, f) => Math.min(m, Math.hypot(f.x - p.x, f.z - p.z)), 1e9);
    setCrackle(near);
  }
  tickBanner(dt);
  render();
  hudTimer += dt;
  if (hudTimer > 0.2 && game.state !== 'title') { updateHud(game.plane, game.world, best); hudTimer = 0; }
}

function render() {
  const p = game.plane, w = game.world;
  const fx = { objective: currentObjective(w), banner: bannerVisible(), drops: game.fx.drops.map((d) => ({ particles: [d] })) };
  renderScene(ctx, W, H, p, w, fx, game.view);
  if (game.view === 'chase') drawAircraft(ctx, W, H, p, w.elapsed);
  else drawCockpitFrame(ctx, W, H);
  drawInstruments(ctx, W, H, p, w, game.view);
}

// --- Screenshot mode: run the shot synchronously, render once, stop ---
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  initHud();
  const seed = Number(params.get('seed') || 1);
  const s = runShot(shot, seed);
  game.plane = s.plane; game.world = s.world; game.state = 'playing';
  game.fx.drops = s.fx.drops.flatMap((d) => d.particles.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z, vy: -30, t: 0 })));
  if (s.fx.banner) showBanner(s.fx.banner.text, s.fx.banner.sub, 60000);
  // Render inside animation frames, not only synchronously: a viewport
  // resize after load resets the canvas backing store (clearing it), and a
  // frame-time render is what the compositor actually presents.
  const present = () => {
    resize();
    render();
    updateHud(game.plane, game.world, best);
    document.title = 'SHOT-READY';
  };
  present();
  requestAnimationFrame(present);
  requestAnimationFrame(() => requestAnimationFrame(present));
  // Keep repainting on a timer too: in headless --screenshot mode a late
  // viewport resize can clear the canvas after the last frame, and the
  // shot is taken from whatever the compositor holds at budget expiry.
  setInterval(present, 50);
} else {
  initHud();
  showScreen(titleScreen(best));
  wireButtons();
  window.addEventListener('keydown', (e) => {
    if (game.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) startFromTitle();
    if (game.state === 'over' && e.code === 'KeyR') resetGame();
  });
  requestAnimationFrame(frame);
}
