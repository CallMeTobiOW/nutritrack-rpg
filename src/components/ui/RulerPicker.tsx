import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { prefersReducedMotion } from '../../lib/motion';
import { firstAlignedIndex, offsetForValue, snapToScale, stepCount, stepDecimals, valueForOffset, type RulerScale } from '../../lib/ruler';

interface RulerPickerProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Pixels per step. */
  px: number;
  /** Steps between minor ticks (default 1). */
  tickEvery?: number;
  /** Steps between medium ticks (optional). */
  midEvery?: number;
  /** Steps between labelled major ticks. */
  majorEvery: number;
  /** Label for a major tick. Pass a stable (module-level) function. */
  formatLabel?: (v: number) => string;
  /** Accessible name, e.g. "Age". */
  label: string;
  /** Accessible value, e.g. "30 years". */
  valueText?: string;
  className?: string;
}

const tick = (color: string) => `linear-gradient(to right, ${color} 0 2px, transparent 2px)`;
const MINOR = 'color-mix(in srgb, var(--text) 22%, transparent)';
const MID = 'color-mix(in srgb, var(--text) 38%, transparent)';
const MAJOR = 'color-mix(in srgb, var(--text) 62%, transparent)';
const FADE = 'linear-gradient(to right, transparent, #000 16%, #000 84%, transparent)';

/**
 * A horizontal measuring tape. Drag (touch, trackpad or mouse) to move it;
 * the value under the centre marker is reported in `step`s. Keyboard users
 * get slider semantics: arrows, Page Up/Down, Home and End.
 */
export function RulerPicker({
  value,
  onChange,
  min,
  max,
  step,
  px,
  tickEvery = 1,
  midEvery,
  majorEvery,
  formatLabel = String,
  label,
  valueText,
  className,
}: RulerPickerProps) {
  const scale = useMemo<RulerScale>(() => ({ min, max, step, px }), [min, max, step, px]);
  const count = stepCount(scale);
  const width = count * px;
  const ref = useRef<HTMLDivElement>(null);
  const [half, setHalf] = useState(0);
  /** Value the ruler is showing, and for which scale, so outside changes can be told apart from our own. */
  const shown = useRef<{ value: number; scale: RulerScale } | null>(null);
  const touching = useRef(false);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const settleTimer = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHalf(el.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Typing, the arrow buttons or a unit switch move the tape to the new value.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !half) return;
    const v = snapToScale(value, scale);
    if (shown.current && shown.current.value === v && shown.current.scale === scale) return;
    el.scrollLeft = offsetForValue(v, scale);
    shown.current = { value: v, scale };
  }, [value, scale, half]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  /** Glide to the nearest step once the tape comes to rest. */
  const settle = () => {
    const el = ref.current;
    if (!el || touching.current || drag.current) return;
    const target = offsetForValue(valueForOffset(el.scrollLeft, scale), scale);
    if (Math.abs(el.scrollLeft - target) > 0.5) el.scrollTo({ left: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const scheduleSettle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 120);
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el || !half) return;
    const v = valueForOffset(el.scrollLeft, scale);
    if (!shown.current || shown.current.value !== v) {
      shown.current = { value: v, scale };
      onChange(v);
    }
    scheduleSettle();
  };

  // Mouse drag (touch and trackpads scroll natively).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && ref.current) ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    settle();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = (steps: number) => snapToScale(value + steps * step, scale);
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? by(tickEvery)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? by(-tickEvery)
      : e.key === 'PageUp' ? by(majorEvery)
      : e.key === 'PageDown' ? by(-majorEvery)
      : e.key === 'Home' ? min
      : e.key === 'End' ? snapToScale(max, scale)
      : undefined;
    if (next === undefined) return;
    e.preventDefault();
    onChange(next);
  };

  const firstMinor = firstAlignedIndex(scale, tickEvery);
  const firstMajor = firstAlignedIndex(scale, majorEvery);
  const firstMid = midEvery ? firstAlignedIndex(scale, midEvery) : 0;

  const labels = useMemo(() => {
    const out: ReactNode[] = [];
    const d = stepDecimals(step);
    for (let i = firstMajor; i <= count; i += majorEvery) {
      const v = Number((min + i * step).toFixed(d));
      out.push(
        <span
          key={i}
          className="font-hud tabular absolute top-11 -translate-x-1/2 text-[15px] font-semibold text-muted"
          style={{ left: half + i * px }}
        >
          {formatLabel(v)}
        </span>,
      );
    }
    return out;
  }, [firstMajor, count, majorEvery, min, step, half, px, formatLabel]);

  const layers = [
    { img: tick(MAJOR), size: `${majorEvery * px}px 34px`, x: firstMajor * px },
    ...(midEvery ? [{ img: tick(MID), size: `${midEvery * px}px 24px`, x: firstMid * px }] : []),
    { img: tick(MINOR), size: `${tickEvery * px}px 15px`, x: firstMinor * px },
  ];

  return (
    <div className={cn('relative', className)}>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={snapToScale(max, scale)}
        aria-valuenow={snapToScale(value, scale)}
        aria-valuetext={valueText}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={() => {
          touching.current = true;
        }}
        onTouchEnd={() => {
          touching.current = false;
          scheduleSettle();
        }}
        onTouchCancel={() => {
          touching.current = false;
          scheduleSettle();
        }}
        className="no-scrollbar relative cursor-grab touch-pan-x select-none overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none active:cursor-grabbing focus-visible:outline-none [&:focus-visible+div]:opacity-100"
        style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      >
        <div className="relative h-[76px]" style={{ width: width + half * 2 }}>
          <div
            className="absolute top-0 h-[34px]"
            style={{
              left: half - 1,
              width: width + 2,
              backgroundImage: layers.map((l) => l.img).join(','),
              backgroundSize: layers.map((l) => l.size).join(','),
              backgroundPosition: layers.map((l) => `${l.x}px 0`).join(','),
              backgroundRepeat: 'repeat-x',
            }}
          />
          {labels}
        </div>
      </div>
      {/* Focus ring for keyboard users, outside the faded scroller. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-4 -inset-y-1 rounded-2xl ring-2 ring-primary opacity-0 transition-opacity" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-6px] h-[46px] w-[4px] -translate-x-1/2 rounded-full bg-gold shadow-glow-gold" />
    </div>
  );
}

/** Round step button that repeats while held, for fine adjustments next to a ruler. */
export function NudgeButton({ onNudge, label, children }: { onNudge: () => void; label: string; children: ReactNode }) {
  const fn = useRef(onNudge);
  const timers = useRef({ delay: 0, repeat: 0 });
  useEffect(() => {
    fn.current = onNudge;
  });
  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        stop();
        fn.current();
        timers.current.delay = window.setTimeout(() => {
          timers.current.repeat = window.setInterval(() => fn.current(), 70);
        }, 380);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn.current();
        }
      }}
      className="grid h-12 w-12 shrink-0 touch-manipulation select-none place-items-center rounded-full border border-line bg-surface-3/70 text-text transition hover:border-line-strong active:scale-90"
    >
      {children}
    </button>
  );
}
