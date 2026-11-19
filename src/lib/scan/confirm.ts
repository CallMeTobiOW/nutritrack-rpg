/**
 * Turns a stream of raw camera reads into confirmed barcodes.
 *
 * A single frame can be misread (a glare line, a half-visible code), so a
 * code only counts once the same digits are read `required` times within
 * `windowMs`, and pass the GS1 check digit. After a code is accepted, the
 * same code is ignored until it has been out of view for `cooldownMs`, so
 * holding the camera on one product in whole-meal mode adds it only once.
 */
import { isPlausibleBarcode } from '../openFoodFacts';

export interface ConfirmOptions {
  required: number;
  windowMs: number;
  cooldownMs: number;
}

export const DEFAULT_CONFIRM: ConfirmOptions = { required: 2, windowMs: 900, cooldownMs: 2500 };

export class ScanConfirmer {
  private code: string | null = null;
  private hits = 0;
  private firstAt = 0;
  private accepted: { code: string; at: number } | null = null;
  private readonly opts: ConfirmOptions;

  constructor(opts: Partial<ConfirmOptions> = {}) {
    this.opts = { ...DEFAULT_CONFIRM, ...opts };
  }

  /** Feed one read. Returns the code when it is confirmed, otherwise null. */
  push(raw: string, now: number): string | null {
    const code = raw.replace(/\D/g, '');
    if (!isPlausibleBarcode(code)) return null;
    if (this.accepted && this.accepted.code === code && now - this.accepted.at < this.opts.cooldownMs) {
      this.accepted.at = now; // still in view: keep ignoring it
      return null;
    }
    if (code !== this.code || now - this.firstAt > this.opts.windowMs) {
      this.code = code;
      this.hits = 1;
      this.firstAt = now;
    } else {
      this.hits++;
    }
    if (this.hits < this.opts.required) return null;
    this.accepted = { code, at: now };
    this.code = null;
    this.hits = 0;
    return code;
  }

  /** Forget partial reads (e.g. when the camera pauses). Keeps the cooldown. */
  clearPartial() {
    this.code = null;
    this.hits = 0;
  }

  /** Forget everything, including the cooldown. */
  reset() {
    this.clearPartial();
    this.accepted = null;
  }
}
