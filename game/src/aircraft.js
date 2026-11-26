// aircraft.js — The Emberwing herself, drawn as a vector sprite in the
// chase view, plus the cockpit frame for the cockpit camera. One job: make
// the aircraft look built — fuselage, high wing, floats, spinning prop,
// red cheatline and her name on the side — and bank her with the roll.
import { PALETTE } from './config.js';

export function drawAircraft(ctx, w, h, plane, time) {
  const cx = w / 2, cy = h * 0.52;
  const S = Math.min(w, h) / 720; // scale
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.85);
  ctx.translate(0, plane.pitch * -90 * S);
  ctx.scale(S, S);

  // Prop blur disc at the nose.
  ctx.fillStyle = 'rgba(220,225,235,0.28)';
  ctx.beginPath(); ctx.ellipse(0, -8, 16, 52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,42,50,0.55)';
  ctx.beginPath(); ctx.ellipse(0, -8, 4, 50, 0, 0, Math.PI * 2); ctx.fill();

  // Tail: horizontal stabiliser + fin.
  ctx.fillStyle = '#c8342a';
  ctx.beginPath();
  ctx.moveTo(-14, 108); ctx.lineTo(-118, 138); ctx.lineTo(-112, 150); ctx.lineTo(-10, 128);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 108); ctx.lineTo(118, 138); ctx.lineTo(112, 150); ctx.lineTo(10, 128);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8342a';
  ctx.beginPath();
  ctx.moveTo(-8, 96); ctx.lineTo(-4, 34); ctx.lineTo(14, 40); ctx.lineTo(12, 100);
  ctx.closePath(); ctx.fill();

  // High wing, spanning the frame.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-238, 26); ctx.lineTo(-30, -6); ctx.lineTo(30, -6); ctx.lineTo(238, 26);
  ctx.lineTo(228, 44); ctx.lineTo(28, 16); ctx.lineTo(-28, 16); ctx.lineTo(-228, 44);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8342a';
  ctx.fillRect(-238, 26, 60, 7);
  ctx.fillRect(178, 26, 60, 7);

  // Fuselage: red belly, cream top, cheatline.
  ctx.fillStyle = '#f2ecdc';
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.quadraticCurveTo(-30, 30, -18, 108);
  ctx.quadraticCurveTo(0, 122, 18, 108);
  ctx.quadraticCurveTo(30, 30, 26, -46);
  ctx.quadraticCurveTo(0, -62, -26, -46);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8342a';
  ctx.beginPath();
  ctx.moveTo(-29, 52); ctx.quadraticCurveTo(-28, 88, -18, 108);
  ctx.quadraticCurveTo(0, 122, 18, 108); ctx.quadraticCurveTo(28, 88, 29, 52);
  ctx.quadraticCurveTo(0, 66, -29, 52);
  ctx.closePath(); ctx.fill();
  // Cockpit windows.
  ctx.fillStyle = '#1d3a4d';
  ctx.beginPath();
  ctx.moveTo(-20, -38); ctx.lineTo(-16, -6); ctx.lineTo(-2, -6); ctx.lineTo(-2, -38);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, -38); ctx.lineTo(16, -6); ctx.lineTo(2, -6); ctx.lineTo(2, -38);
  ctx.closePath(); ctx.fill();
  // Name on the fuselage + registration.
  ctx.fillStyle = '#3a2c22';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMBERWING', 0, 84);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N07-FIRE', 0, 98);

  // Floats with struts.
  ctx.strokeStyle = '#5a5148';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-16, 96); ctx.lineTo(-30, 138); ctx.moveTo(16, 96); ctx.lineTo(30, 138); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = '#d8d2c2';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 44 - 12, 132);
    ctx.quadraticCurveTo(sx * 44, 122, sx * 44 + 12, 132);
    ctx.lineTo(sx * 44 + 10, 158);
    ctx.quadraticCurveTo(sx * 44, 164, sx * 44 - 10, 158);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8342a';
    ctx.fillRect(sx * 44 - 12, 140, 24, 5);
    ctx.fillStyle = '#d8d2c2';
  }

  // Water-tank belly light: amber when full, dark when empty.
  ctx.restore();

  // Engine note: a faint heat shimmer line behind the prop is skipped;
  // the prop disc above already reads as "engine running".
  return { cx, cy };
}

// Cockpit view: dashboard sill, windscreen struts and glare, over the gauges.
export function drawCockpitFrame(ctx, w, h) {
  ctx.fillStyle = 'rgba(20,18,22,0.92)';
  ctx.beginPath();
  ctx.moveTo(0, h); ctx.lineTo(0, h * 0.82);
  ctx.quadraticCurveTo(w * 0.5, h * 0.76, w, h * 0.82);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  // Windscreen centre strut and side pillars.
  ctx.fillStyle = 'rgba(20,18,22,0.9)';
  ctx.fillRect(w / 2 - 5, 0, 10, h * 0.14);
  ctx.save();
  ctx.translate(0, 0);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w * 0.10, 0); ctx.lineTo(w * 0.16, h * 0.2); ctx.lineTo(0, h * 0.24);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0); ctx.lineTo(w * 0.90, 0); ctx.lineTo(w * 0.84, h * 0.2); ctx.lineTo(w, h * 0.24);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
