// input.js — Keyboard and mouse, nothing else. One job: keep a live map of
// which control keys are held, and hand the game single-press events.
import { KEYS } from './config.js';

export function newInput() {
  const held = new Set();
  const pressed = new Set(); // consumed once per frame by the game
  const input = {
    held, pressed,
    pitch: 0, roll: 0, throttle: 0, drop: false,
    consume(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
    anyPressed(codes) { return codes.some((c) => this.consume(c)); },
  };
  const down = (e) => {
    if (e.repeat) { e.preventDefault(); return; }
    held.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => held.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => held.clear());
  input.poll = () => {
    const has = (codes) => codes.some((c) => held.has(c));
    input.pitch = (has(KEYS.pitchUp) ? 1 : 0) - (has(KEYS.pitchDown) ? 1 : 0);
    input.roll = (has(KEYS.rollRight) ? 1 : 0) - (has(KEYS.rollLeft) ? 1 : 0);
    input.throttle = (has(KEYS.throttleUp) ? 1 : 0) - (has(KEYS.throttleDown) ? 1 : 0);
    input.drop = has(KEYS.drop);
  };
  input.clearPressed = () => pressed.clear();
  return input;
}
