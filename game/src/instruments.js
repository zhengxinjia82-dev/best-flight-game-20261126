// instruments.js — The lit instrument panel: attitude indicator, airspeed,
// altimeter, heading tape, fuel, water tank, throttle lever and vertical
// speed. One job: gauges that look flown — needles and horizons that move
// with the real flight state, never a static sticker.
import { CONFIG, PALETTE } from './config.js';
import { clamp } from './random.js';
import { feet, knots } from './plane.js';

function dial(ctx, x, y, r, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#10131a';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f4ead8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  // Backing plate, same reason as the readout: the compass numbers
  // rotate right under the title.
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(-lw / 2 - 3, -r + 2, lw + 6, 13);
  ctx.fillStyle = '#f4ead8';
  ctx.fillText(label, 0, -r + 13);
  ctx.restore();
}

function needle(ctx, x, y, r, angle, color = '#ff4a3c', width = 2.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -r + 8); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function ticks(ctx, x, y, r, count, start, sweep) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(244,234,216,0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= count; i++) {
    const a = start + (sweep * i) / count;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (r - 9), -Math.cos(a) * (r - 9));
    ctx.lineTo(Math.sin(a) * (r - 4), -Math.cos(a) * (r - 4));
    ctx.stroke();
  }
  ctx.restore();
}

function readout(ctx, x, y, text, color = '#f4ead8', size = 13) {
  // Backing plate: the readout sits over the dial's own numbers (the
  // compass labels sweep right under it), so punch a clean hole first.
  ctx.font = `bold ${size}px monospace`;
  const wdt = ctx.measureText(text).width;
  ctx.fillStyle = '#10131a';
  ctx.beginPath();
  ctx.roundRect(x - wdt / 2 - 4, y - size - 1, wdt + 8, size + 5, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

// Draws the whole bottom panel. It floats above the 34px controls strip,
// so the DOM bottom bar never covers a gauge. Panel height is 118px.
export function drawInstruments(ctx, w, h, plane, world, view) {
  const ph = 118;
  const y0 = h - ph - 34;
  // Panel backing.
  ctx.fillStyle = 'rgba(10,12,18,0.88)';
  ctx.fillRect(0, y0, w, ph);
  ctx.fillStyle = 'rgba(255,176,46,0.5)';
  ctx.fillRect(0, y0, w, 2);
  const cy = y0 + ph / 2 + 6;
  const R = 44;

  // --- Attitude indicator (artificial horizon, banked and pitched) ---
  const ax = w * 0.5 - 330;
  dial(ctx, ax, cy, R, 'ATT');
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, cy, R - 3, 0, Math.PI * 2); ctx.clip();
  ctx.translate(ax, cy);
  ctx.rotate(-plane.bank);
  ctx.translate(0, plane.pitch * 90);
  ctx.fillStyle = '#3a6ea8';
  ctx.fillRect(-R, -R * 2, R * 2, R * 2);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-R, 0, R * 2, R * 2);
  ctx.strokeStyle = '#f4ead8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(ax, cy);
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-5, 0); ctx.lineTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(16, 0); ctx.stroke();
  ctx.restore();

  // --- Airspeed (knots) ---
  const sx = w * 0.5 - 210;
  dial(ctx, sx, cy, R, 'AIRSPEED');
  ticks(ctx, sx, cy, R, 8, -Math.PI * 0.85, Math.PI * 1.7);
  needle(ctx, sx, cy, R, -Math.PI * 0.85 + (clamp(knots(plane.speed), 0, 180) / 180) * Math.PI * 1.7);
  readout(ctx, sx, cy + 26, `${Math.round(knots(plane.speed))} KT`);

  // --- Altimeter (feet) ---
  const alx = w * 0.5 - 90;
  dial(ctx, alx, cy, R, 'ALTITUDE');
  ticks(ctx, alx, cy, R, 10, -Math.PI * 0.85, Math.PI * 1.7);
  const alt = feet(Math.max(0, plane.y));
  needle(ctx, alx, cy, R, -Math.PI * 0.85 + ((alt % 1000) / 1000) * Math.PI * 1.7);
  needle(ctx, alx, cy, R * 0.62, -Math.PI * 0.85 + ((alt % 10000) / 10000) * Math.PI * 1.7, '#7fd4ff', 2);
  readout(ctx, alx, cy + 26, `${Math.round(alt)} FT`);

  // --- Heading compass ---
  const hx = w * 0.5 + 30;
  dial(ctx, hx, cy, R, 'HEADING');
  const hdg = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.save();
  ctx.translate(hx, cy);
  ctx.rotate(-(plane.heading));
  ctx.fillStyle = '#f4ead8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  for (let d = 0; d < 360; d += 30) {
    const a = (d * Math.PI) / 180;
    const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10);
    ctx.fillText(label, Math.sin(a) * (R - 20), -Math.cos(a) * (R - 20) + 3);
  }
  ctx.restore();
  // Title redrawn last, on its plate: the rotating numbers are painted
  // after dial(), so they would print straight over the title otherwise.
  ctx.fillStyle = '#10131a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  const hw = ctx.measureText('HEADING').width;
  ctx.fillRect(hx - hw / 2 - 3, cy - R + 2, hw + 6, 13);
  ctx.fillStyle = '#f4ead8';
  ctx.fillText('HEADING', hx, cy - R + 13);
  // Lubber mark on the rim, just above the title plate.
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(hx - 6, cy - R - 4); ctx.lineTo(hx + 6, cy - R - 4); ctx.lineTo(hx, cy - R + 2);
  ctx.closePath(); ctx.fill();
  readout(ctx, hx, cy + 26, `${String(Math.round(hdg)).padStart(3, '0')}°`);

  // --- Vertical speed ---
  const vx = w * 0.5 + 150;
  dial(ctx, vx, cy, R * 0.82, 'V/S');
  ticks(ctx, vx, cy, R * 0.82, 6, -Math.PI * 0.85, Math.PI * 1.7);
  needle(ctx, vx, cy, R * 0.82, -Math.PI * 0.85 + (clamp(plane.vspeed, -12, 12) / 24 + 0.5) * Math.PI * 1.7, '#7ee081', 2);
  readout(ctx, vx, cy + 26, `${plane.vspeed >= 0 ? '+' : ''}${plane.vspeed.toFixed(1)} m/s`, '#f4ead8', 11);

  // --- Fuel + water: vertical bars with litres/kg readouts ---
  const fx0 = w * 0.5 + 235;
  bar(ctx, fx0, y0 + 16, 26, ph - 32, plane.fuel / CONFIG.FUEL_MAX, plane.fuel <= CONFIG.FUEL_BINGO ? '#ff4a3c' : '#ffb02e', 'FUEL', `${Math.round(plane.fuel)} kg`);
  bar(ctx, fx0 + 44, y0 + 16, 26, ph - 32, plane.water / CONFIG.WATER_MAX, '#7fd4ff', 'WATER', `${Math.round(plane.water)} L`);

  // --- Throttle lever ---
  const tx = w * 0.5 + 345;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(tx - 14, y0 + 16, 28, ph - 32);
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 2;
  ctx.strokeRect(tx - 14, y0 + 16, 28, ph - 32);
  const leverY = y0 + 16 + (1 - plane.throttle) * (ph - 40);
  ctx.fillStyle = plane.throttle > 0.85 ? '#ff4a3c' : '#ffb02e';
  ctx.fillRect(tx - 20, leverY - 4, 40, 8);
  ctx.fillStyle = '#f4ead8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', tx, y0 + 12);
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, tx, y0 + ph - 4);

  // --- Stall / overspeed / damage warnings, lit when true ---
  let warnX = w * 0.5 - 430;
  const warns = [
    [plane.stalled, 'STALL', '#ff4a3c'],
    [plane.overspeed, 'OVERSPEED', '#ff4a3c'],
    [plane.fuel <= CONFIG.FUEL_BINGO, 'BINGO FUEL', '#ff4a3c'],
    [plane.damage > 55, 'DAMAGE ' + Math.round(plane.damage) + '%', '#ffb02e'],
    [plane.flaps, 'FLAPS', '#7ee081'],
  ];
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  for (const [on, text, color] of warns) {
    if (!on) continue;
    const tw = ctx.measureText(text).width + 14;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(world.elapsed * 8);
    ctx.fillRect(warnX, y0 + 8, tw, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10131a';
    ctx.fillText(text, warnX + 7, y0 + 21);
    warnX += tw + 8;
    if (warnX > w * 0.5 - 60) break;
  }
}

function bar(ctx, x, y, bw, bh, frac, color, label, value) {
  ctx.fillStyle = '#10131a';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = color;
  const fh = bh * clamp(frac, 0, 1);
  ctx.fillRect(x + 2, y + bh - fh, bw - 4, fh);
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, bw, bh);
  ctx.fillStyle = '#f4ead8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + bw / 2, y - 4);
  ctx.font = 'bold 9px monospace';
  ctx.fillText(value, x + bw / 2, y + bh + 11);
}
