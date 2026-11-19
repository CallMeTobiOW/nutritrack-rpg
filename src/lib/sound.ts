/**
 * Optional sound effects, synthesised with the Web Audio API so the app
 * ships no audio files (and therefore no copyrighted audio).
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

export const sfx = {
  /** Bright two-note chime for a completed quest. */
  quest() {
    const ac = audio();
    if (!ac) return;
    tone(ac, 880, 0, 0.18, 'triangle');
    tone(ac, 1318.5, 0.08, 0.3, 'triangle');
  },
  /** Rising arpeggio for achievements and level-ups. */
  fanfare() {
    const ac = audio();
    if (!ac) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, i * 0.09, 0.35, 'triangle', 0.1));
    tone(ac, 1567.98, 0.38, 0.6, 'sine', 0.06);
  },
  /** Soft tick for small confirmations (water added, food logged). */
  tick() {
    const ac = audio();
    if (!ac) return;
    tone(ac, 1200, 0, 0.07, 'sine', 0.05);
  },
  /** Crisp double beep for a barcode read. */
  scan() {
    const ac = audio();
    if (!ac) return;
    tone(ac, 1568, 0, 0.06, 'square', 0.035);
    tone(ac, 2093, 0.07, 0.09, 'square', 0.035);
  },
  /** Low blip when a scan needs attention (not found / offline). */
  miss() {
    const ac = audio();
    if (!ac) return;
    tone(ac, 330, 0, 0.16, 'triangle', 0.06);
  },
  /** Low hum for the briefing intro. */
  briefing() {
    const ac = audio();
    if (!ac) return;
    tone(ac, 220, 0, 0.9, 'sine', 0.05);
    tone(ac, 330, 0.12, 0.8, 'sine', 0.04);
    tone(ac, 440, 0.3, 0.7, 'triangle', 0.035);
  },
};
