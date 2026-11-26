// render3d.js — The software 3D renderer: sky, sun, terrain mesh, lake,
// runway, pines, fires, smoke, target rings and the water-drop plume.
// One job: turn plane + world state into one chase-view frame on a canvas.
// No libraries, no network — every pixel is computed here.
import { AIRSTRIP, CONFIG, LAKE, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';
import { TREES, groundHeight, isRunway, isWater, slopeAt } from './terrain.js';

const HALF = CONFIG.WORLD_SIZE / 2;

// Camera basis from a lookAt: position, target, world up.
function cameraBasis(pos, target) {
  const fwd = norm3([target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]);
  const right = norm3(cross3(fwd, [0, 1, 0]));
  const up = cross3(right, fwd);
  return { pos, fwd, right, up };
}
function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Project a world point to screen space. Returns null behind the camera.
function makeProjector(cam, w, h) {
  const focal = (h / 2) / Math.tan((CONFIG.FOV_DEG * Math.PI / 180) / 2);
  const cx = w / 2, cy = h * 0.46;
  return function project(x, y, z) {
    const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2];
    const vx = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
    const vy = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
    const vz = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
    if (vz < 2) return null;
    return { x: cx + (vx / vz) * focal, y: cy - (vy / vz) * focal, d: vz, s: focal / vz };
  };
}

function shadeForHeight(h, slope) {
  // Valley floor green -> dry meadow -> rock -> high ridge brown.
  if (h < 2) return '#2e6f8e';
  if (slope > 0.62) return '#7d5f49';
  if (h < 62) return '#6d8a42';
  if (h < 110) return '#5d7a3a';
  if (h < 190) return '#7a6a4a';
  return '#6e4f3d';
}

export function renderScene(ctx, w, h, plane, world, fx, view) {
  // --- Sky: sunset gradient, sun, drifting cloud bands ---
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunX = w * 0.72, sunY = h * 0.30;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
  glow.addColorStop(0, 'rgba(255,220,160,0.95)');
  glow.addColorStop(0.25, 'rgba(255,170,90,0.55)');
  glow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.cloud;
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 317 + world.elapsed * 6) % (w + 360)) - 180;
    const cy = h * (0.10 + (i % 4) * 0.055);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 150 + (i % 3) * 50, 13 + (i % 3) * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Camera: chase behind the plane, or the cockpit view ---
  const fx0 = Math.sin(plane.heading), fz0 = Math.cos(plane.heading);
  let camPos, target;
  if (view === 'cockpit') {
    camPos = [plane.x + fx0 * 1.2, plane.y + 1.4, plane.z + fz0 * 1.2];
    target = [plane.x + fx0 * 120 - Math.sin(plane.bank) * 8, plane.y + Math.sin(plane.pitch) * 60, plane.z + fz0 * 120];
  } else {
    camPos = [plane.x - fx0 * CONFIG.CAM_DIST, plane.y + CONFIG.CAM_HEIGHT - Math.sin(plane.pitch) * 6, plane.z - fz0 * CONFIG.CAM_DIST];
    target = [plane.x + fx0 * 90, plane.y - 4, plane.z + fz0 * 90];
  }
  const cam = cameraBasis(camPos, target);
  const project = makeProjector(cam, w, h);

  // --- Terrain mesh: quads around the camera, painter-sorted ---
  const quads = [];
  const gx0 = Math.max(-HALF, Math.floor((camPos[0] - 1500) / CONFIG.CELL) * CONFIG.CELL);
  const gz0 = Math.max(-HALF, Math.floor((camPos[2] - 1500) / CONFIG.CELL) * CONFIG.CELL);
  const gx1 = Math.min(HALF - CONFIG.CELL, gx0 + 3000);
  const gz1 = Math.min(HALF - CONFIG.CELL, gz0 + 3000);
  for (let gx = gx0; gx <= gx1; gx += CONFIG.CELL) {
    for (let gz = gz0; gz <= gz1; gz += CONFIG.CELL) {
      const cxm = gx + CONFIG.CELL / 2, czm = gz + CONFIG.CELL / 2;
      const dx = cxm - camPos[0], dz = czm - camPos[2];
      const ahead = dx * cam.fwd[0] + dz * cam.fwd[2];
      if (ahead < -80 || ahead > CONFIG.VIEW_DIST) continue;
      const side = Math.abs(dx * cam.right[0] + dz * cam.right[2]);
      if (side > ahead * 1.15 + 300) continue;
      const h00 = groundHeight(gx, gz), h10 = groundHeight(gx + CONFIG.CELL, gz);
      const h01 = groundHeight(gx, gz + CONFIG.CELL), h11 = groundHeight(gx + CONFIG.CELL, gz + CONFIG.CELL);
      const mid = (h00 + h10 + h01 + h11) / 4;
      const water = mid < CONFIG.WATER_LEVEL && isWater(cxm, czm);
      const runway = isRunway(cxm, czm);
      quads.push({ gx, gz, h00, h10, h01, h11, mid, water, runway, d: ahead });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    const p00 = project(q.gx, q.h00, q.gz), p10 = project(q.gx + CONFIG.CELL, q.h10, q.gz);
    const p01 = project(q.gx, q.h01, q.gz + CONFIG.CELL), p11 = project(q.gx + CONFIG.CELL, q.h11, q.gz + CONFIG.CELL);
    if (!p00 || !p10 || !p01 || !p11) continue;
    if (q.water) {
      ctx.fillStyle = (Math.floor(q.gx / 300) + Math.floor(q.gz / 300)) % 2 ? PALETTE.water : PALETTE.waterDeep;
    } else if (q.runway) {
      ctx.fillStyle = PALETTE.runway;
    } else {
      ctx.fillStyle = shadeForHeight(q.mid, slopeAt(q.gx + 75, q.gz + 75));
    }
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
    ctx.closePath(); ctx.fill();
    // Runway centreline dashes.
    if (q.runway) {
      const mid = project(q.gx + CONFIG.CELL / 2, q.h00 + 0.6, q.gz + CONFIG.CELL / 2);
      if (mid && Math.floor(q.gz / CONFIG.CELL) % 2 === 0) {
        ctx.fillStyle = PALETTE.runwayLine;
        ctx.fillRect(mid.x - 2, mid.y - 3, 4, 7);
      }
    }
  }

  // --- Lake shimmer: a bright band where the sun hits the water ---
  const lakeC = project(LAKE.x, 1, LAKE.z);
  if (lakeC && lakeC.d < CONFIG.VIEW_DIST) {
    const shimmer = ctx.createRadialGradient(lakeC.x, lakeC.y, 2, lakeC.x, lakeC.y, 130 * lakeC.s);
    shimmer.addColorStop(0, 'rgba(255,220,160,0.35)');
    shimmer.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(lakeC.x - 140 * lakeC.s, lakeC.y - 60 * lakeC.s, 280 * lakeC.s, 120 * lakeC.s);
  }

  // --- Pines: near ones only, as two triangles each ---
  let drawn = 0;
  for (const t of TREES) {
    const dx = t.x - camPos[0], dz = t.z - camPos[2];
    const ahead = dx * cam.fwd[0] + dz * cam.fwd[2];
    if (ahead < 0 || ahead > 1100) continue;
    const side = Math.abs(dx * cam.right[0] + dz * cam.right[2]);
    if (side > ahead * 1.1 + 150) continue;
    const p = project(t.x, t.h, t.z);
    if (!p) continue;
    const s = p.s * t.s;
    if (s < 2) continue;
    ctx.fillStyle = `rgba(20,52,28,${0.9 * t.shade})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.4); ctx.lineTo(p.x - s * 0.9, p.y); ctx.lineTo(p.x + s * 0.9, p.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(46,82,48,${0.95 * t.shade})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 3.4); ctx.lineTo(p.x - s * 0.62, p.y - s * 1.1); ctx.lineTo(p.x + s * 0.62, p.y - s * 1.1);
    ctx.closePath(); ctx.fill();
    if (++drawn > 260) break;
  }

  // --- Target ring: amber circle floating over the current objective ---
  const obj = fx.objective;
  if (obj) {
    const rp = project(obj.x, obj.y, obj.z);
    if (rp && rp.d > 0) {
      const r = 62 * rp.s;
      ctx.strokeStyle = 'rgba(255,176,46,0.95)';
      ctx.lineWidth = Math.max(2, r * 0.07);
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, r, r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,176,46,0.35)';
      ctx.lineWidth = Math.max(4, r * 0.14);
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, r, r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb02e';
      ctx.font = `bold ${Math.max(11, Math.min(17, r * 0.22))}px sans-serif`;
      ctx.textAlign = 'center';
      const dist = Math.round(Math.hypot(obj.x - plane.x, obj.z - plane.z));
      // Below the ring while a banner is up (it sits high and would print
      // over a label above the ring), above it otherwise — the plane
      // flies right under a close ring, so a label below would hide
      // behind the aircraft.
      const labelY = fx.banner ? rp.y + r * 0.32 + 18 : rp.y - r * 0.32 - 10;
      ctx.fillText(`${obj.label}  ·  ${dist} m`, rp.x, labelY);
    }
    // Guidance arrow at the screen edge when the ring is off-screen.
    if (!rp || rp.x < 40 || rp.x > w - 40 || rp.y < 60 || rp.y > h - 160) {
      const ang = Math.atan2(Math.sin(objAngle(plane, obj)), Math.cos(objAngle(plane, obj)));
      const ax = w / 2 + Math.sin(ang) * 120, ay = h * 0.42 - Math.cos(ang) * 90;
      ctx.save();
      ctx.translate(clamp(ax, 60, w - 60), clamp(ay, 80, h - 200));
      ctx.rotate(ang);
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // --- Fires: glow, flames, smoke columns (only the living ones) ---
  for (const f of world.fires) {
    if (!f.alive) continue;
    const dx = f.x - camPos[0], dz = f.z - camPos[2];
    const ahead = dx * cam.fwd[0] + dz * cam.fwd[2];
    if (ahead < -40 || ahead > CONFIG.VIEW_DIST) continue;
    const gy = groundHeight(f.x, f.z);
    const p = project(f.x, gy + 2, f.z);
    if (!p) continue;
    const s = p.s * f.size;
    const flick = 0.85 + 0.3 * Math.sin(world.elapsed * 9 + f.id * 2.4);
    const glowR = s * 2.6 * flick;
    const g = ctx.createRadialGradient(p.x, p.y - s * 0.4, 2, p.x, p.y - s * 0.4, glowR);
    g.addColorStop(0, 'rgba(255,122,26,0.75)');
    g.addColorStop(0.5, 'rgba(212,42,14,0.35)');
    g.addColorStop(1, 'rgba(212,42,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - glowR, p.y - s * 0.4 - glowR, glowR * 2, glowR * 2);
    // Flame tongues.
    for (let i = 0; i < 3; i++) {
      const fx2 = p.x + (i - 1) * s * 0.5;
      const fh = s * (1.1 + 0.35 * Math.sin(world.elapsed * 11 + f.id * 3 + i * 2));
      ctx.fillStyle = i === 1 ? PALETTE.fireCore : PALETTE.fireMid;
      ctx.beginPath();
      ctx.moveTo(fx2 - s * 0.28, p.y);
      ctx.quadraticCurveTo(fx2 - s * 0.1, p.y - fh * 0.7, fx2, p.y - fh);
      ctx.quadraticCurveTo(fx2 + s * 0.1, p.y - fh * 0.7, fx2 + s * 0.28, p.y);
      ctx.closePath(); ctx.fill();
    }
    // Smoke column drifting with the wind.
    for (let j = 0; j < 5; j++) {
      const rise = ((world.elapsed * 14 + j * 26 + f.id * 7) % 130);
      const sx = p.x + world.wind.x * rise * 0.14 * p.s + Math.sin(j * 2.1 + f.id) * 6;
      const sy = p.y - rise * p.s * 0.9;
      const sr = (8 + rise * 0.35) * p.s * 0.55;
      ctx.fillStyle = `rgba(60,52,48,${0.42 - rise * 0.0022})`;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, sr), 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- Water drop plume ---
  if (fx.drops.length) {
    for (const d of fx.drops) {
      for (const pt of d.particles) {
        const p = project(pt.x, pt.y, pt.z);
        if (!p) continue;
        ctx.fillStyle = 'rgba(160,210,255,0.85)';
        ctx.fillRect(p.x - 1.5, p.y - 4, 3, 8);
      }
    }
  }

  // --- Distant ridge silhouette, for depth ---
  ctx.fillStyle = 'rgba(43,30,78,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.42);
  for (let x = 0; x <= w; x += 40) {
    ctx.lineTo(x, h * 0.42 - Math.sin(x / 260 + 2) * 22 - Math.sin(x / 90) * 8);
  }
  ctx.lineTo(w, h * 0.42); ctx.closePath();
  ctx.fill();

  return { cam, project };
}

function objAngle(plane, obj) {
  const want = Math.atan2(obj.x - plane.x, obj.z - plane.z);
  let d = want - plane.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
