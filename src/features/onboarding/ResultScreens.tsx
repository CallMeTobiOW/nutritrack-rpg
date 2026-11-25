import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Droplet, Target, Wheat } from 'lucide-react';
import { ACTIVITY_LEVELS, bmrMifflin, tdee, type BodyStats, type Targets } from '../../lib/targets';
import { formatVolume, formatWeight, type WeightUnit } from '../../lib/units';
import { prefersReducedMotion } from '../../lib/motion';
import { sfx } from '../../lib/sound';
import { cn } from '../../lib/cn';
import { AppEmblem } from '../../components/ui/AppEmblem';

const FORGE_LINES = ['Reading your stats', 'Calculating resting energy', 'Factoring in your week', 'Balancing your macros', 'Forging your loadout'];

/** Short "working on it" beat between the last answer and the result. */
export function ForgeScreen({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const gap = prefersReducedMotion() ? 120 : 480;
    const timers = FORGE_LINES.map((_, i) => window.setTimeout(() => setShown(i + 1), gap * (i + 1)));
    timers.push(window.setTimeout(() => done.current(), gap * (FORGE_LINES.length + 1)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const pct = Math.round((shown / FORGE_LINES.length) * 100);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col justify-center px-8">
      <div className="relative mx-auto grid h-40 w-40 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - pct}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
            style={{ filter: 'drop-shadow(0 0 6px var(--gold))' }}
          />
        </svg>
        <AppEmblem size={84} className="animate-pulse-glow" />
      </div>
      <p className="hud-label mt-8 text-center !text-gold" aria-live="polite">
        {pct}% forged
      </p>
      <h1 className="ob-display mt-2 text-center text-[2.4rem]">Forging your plan</h1>
      <ul className="mx-auto mt-8 w-full max-w-xs space-y-3">
        {FORGE_LINES.map((line, i) => (
          <li key={line} className={cn('flex items-center gap-3 transition-opacity duration-300', i < shown ? 'opacity-100' : 'opacity-30')}>
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                i < shown ? 'border-[var(--gold-fill)] bg-[var(--gold-fill)] text-[#1a1203]' : 'border-line-strong',
              )}
            >
              {i < shown && <Check size={13} strokeWidth={3.5} />}
            </span>
            <span className="text-[15px]">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useCountUp(target: number, ms = 900): number {
  const reduce = prefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return reduce ? target : v;
}

/** The finished plan: calories, macro split and where the numbers come from. */
export function RevealScreen({
  name,
  stats,
  targets,
  goalKg,
  unit,
}: {
  name: string;
  stats: BodyStats;
  targets: Targets;
  goalKg: number | undefined;
  unit: WeightUnit;
}) {
  const kcal = useCountUp(targets.calories);
  useEffect(() => {
    sfx.fanfare();
  }, []);

  const macros = [
    { key: 'Protein', g: targets.protein, kcal: targets.protein * 4, color: 'var(--protein)' },
    { key: 'Carbs', g: targets.carbs, kcal: targets.carbs * 4, color: 'var(--carbs)' },
    { key: 'Fat', g: targets.fat, kcal: targets.fat * 9, color: 'var(--fat)' },
  ];
  const macroKcal = macros.reduce((a, m) => a + m.kcal, 0) || 1;

  const bmr = Math.round(bmrMifflin(stats));
  const activity = ACTIVITY_LEVELS[stats.activity];
  // Shown to the nearest 10, like the target itself, so the lines add up exactly.
  const maintenance = Math.round(tdee(stats) / 10) * 10;
  const adjust = targets.calories - maintenance;
  const proteinPerKg = (targets.protein / stats.weightKg).toFixed(1);

  return (
    <div className="flex flex-1 flex-col pt-3">
      <p className="hud-label animate-rise !text-gold">Built from your answers</p>
      <h1 className="ob-display animate-rise mt-2 text-[2.4rem] [animation-delay:60ms]">
        {name.trim() ? `${name.trim()}, here’s your loadout` : 'Here’s your loadout'}
      </h1>

      <section className="panel hud-corners animate-rise mt-6 p-5 [animation-delay:120ms]" aria-label="Daily calories">
        <p className="hud-label">Daily calories</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-hud tabular text-[3.6rem] font-bold leading-none text-gold">{kcal.toLocaleString()}</span>
          <span className="text-muted">kcal a day</span>
        </p>

        <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden>
          {macros.map((m) => (
            <span key={m.key} className="h-full rounded-full" style={{ width: `${(m.kcal / macroKcal) * 100}%`, background: m.color }} />
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {macros.map((m) => (
            <div key={m.key}>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                {m.key}
              </dt>
              <dd className="font-hud tabular mt-0.5 text-2xl font-bold">
                {m.g}
                <span className="ml-0.5 text-sm font-semibold text-muted">g</span>
              </dd>
              <dd className="tabular text-xs text-faint">{Math.round((m.kcal / macroKcal) * 100)}% of energy</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className={cn('animate-rise mt-3 grid gap-3 [animation-delay:180ms]', goalKg !== undefined ? 'grid-cols-3' : 'grid-cols-2')}>
        <Tile icon={<Droplet size={16} />} label="Water" value={formatVolume(targets.waterMl)} color="var(--cyan)" />
        <Tile icon={<Wheat size={16} />} label="Fibre" value={`${targets.fiber} g`} color="var(--carbs)" />
        {goalKg !== undefined && <Tile icon={<Target size={16} />} label="Goal" value={formatWeight(goalKg, unit)} color="var(--gold)" />}
      </div>

      <details className="group animate-rise mt-3 rounded-2xl border border-line bg-surface [animation-delay:240ms]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
          Where these numbers come from
          <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-line px-4 pb-4 pt-3 text-sm">
          <Line label="Resting energy (Mifflin-St Jeor)" value={`${bmr.toLocaleString()} kcal`} />
          <Line label={`× ${activity.factor} for ${activity.label.toLowerCase()}`} value={`${maintenance.toLocaleString()} kcal`} />
          {stats.objective !== 'maintain' && (
            <Line
              label={stats.objective === 'lose' ? 'Moderate deficit to lose weight' : 'Small surplus to build muscle'}
              value={`${adjust > 0 ? '+' : '−'}${Math.abs(adjust).toLocaleString()} kcal`}
            />
          )}
          <Line label="Your daily target" value={`${targets.calories.toLocaleString()} kcal`} strong />
          <p className="pt-1 text-xs leading-relaxed text-muted">
            Protein is {proteinPerKg} g per kg of body weight, fat is 30% of energy and carbs fill the rest. Weight-loss targets never drop below a
            safe minimum.
          </p>
        </div>
      </details>

      <p className="mt-4 text-xs leading-relaxed text-faint">These are estimates, not medical advice. You can change every value later in Profile.</p>
    </div>
  );
}

function Tile({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="font-hud tabular mt-1 truncate text-lg font-bold">{value}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', strong && 'border-t border-line pt-2 font-semibold')}>
      <span className={strong ? 'text-text' : 'text-muted'}>{label}</span>
      <span className="tabular shrink-0">{value}</span>
    </div>
  );
}
