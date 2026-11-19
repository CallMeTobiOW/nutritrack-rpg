import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Info, Loader2, Sparkles } from 'lucide-react';
import type { Food, FoodQuality } from '../../lib/models';
import type { NutrientValues } from '../../lib/nutrients';
import { BAND_COLOR, BAND_LABEL, healthScore, type ScoreReason } from '../../lib/healthScore';
import { findBetterAlternatives, type Alternative } from '../../lib/alternatives';
import { cn } from '../../lib/cn';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { FoodAvatar } from './FoodAvatar';

/** Below this, the card looks for better products in the same category. */
const SUGGEST_BELOW = 70;

interface Props {
  food: { per100: NutrientValues; unit: 'g' | 'ml'; quality?: FoodQuality; barcode?: string };
  /** Open a suggested product (in the portion sheet). Omit to hide suggestions. */
  onOpenFood?: (food: Omit<Food, 'id'>) => void;
}

/** 0–100 health rating with the reasons behind it and better choices. */
export function HealthCard({ food, onOpenFood }: Props) {
  const rating = useMemo(() => healthScore(food), [food]);
  if (!rating) return null;
  const color = BAND_COLOR[rating.band];
  const headline =
    rating.minuses.length === 0
      ? 'Nothing to worry about.'
      : rating.score >= 80
        ? 'A great choice, with one small catch.'
        : rating.score >= 60
        ? 'A solid choice, with a catch or two.'
        : `Why it scores ${rating.score < 40 ? 'low' : 'in the middle'}:`;

  return (
    <section className="rounded-2xl border border-line bg-surface-3/40 p-4" aria-label={`Health rating ${rating.score} out of 100`}>
      <div className="flex items-center gap-4">
        <ProgressRing value={rating.score / 100} size={72} stroke={7} from={color} to={color} glow={false} label={`${rating.score} out of 100`}>
          <span className="font-hud text-2xl font-bold tabular" style={{ color }}>
            {rating.score}
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="hud-label">Health rating</p>
          <p className="font-hud text-xl font-bold" style={{ color }}>
            {BAND_LABEL[rating.band]}
          </p>
          <p className="text-sm text-muted">{headline}</p>
        </div>
      </div>

      {rating.minuses.length > 0 && <ReasonList reasons={rating.minuses} />}
      {rating.pluses.length > 0 && (
        <>
          <p className="hud-label mt-3">In its favour</p>
          <ReasonList reasons={rating.pluses} />
        </>
      )}

      <p className="mt-3 flex gap-1.5 text-xs text-faint">
        <Info size={13} className="mt-0.5 shrink-0" />
        {rating.ingredientsChecked
          ? 'Scored per 100 ' + food.unit + ' on UK traffic-light limits, fibre, protein, processing and additives.'
          : 'Scored on nutrition only: the ingredients aren’t known, so processing and additives aren’t counted.'}
      </p>

      {onOpenFood && rating.score < SUGGEST_BELOW && (food.quality?.categories?.length ?? 0) > 0 && (
        <BetterChoices food={food} score={rating.score} onOpen={onOpenFood} />
      )}
    </section>
  );
}

const SHOW_FIRST = 3;

function ReasonList({ reasons }: { reasons: ScoreReason[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = all ? reasons : reasons.slice(0, SHOW_FIRST);
  return (
    <ul className="mt-2 space-y-1">
      {shown.map((r) => {
        const bad = r.points < 0;
        const expanded = open === r.text;
        return (
          <li key={r.text}>
            <button
              type="button"
              disabled={!r.detail}
              aria-expanded={r.detail ? expanded : undefined}
              onClick={() => setOpen(expanded ? null : r.text)}
              className="flex min-h-9 w-full items-start gap-2.5 rounded-lg py-1 text-left text-sm disabled:cursor-default"
            >
              <span
                className={cn(
                  'mt-0.5 w-9 shrink-0 rounded-md py-0.5 text-center text-xs font-bold tabular',
                  bad ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success',
                )}
              >
                {bad ? '' : '+'}
                {r.points}
              </span>
              <span className="min-w-0 flex-1">
                {r.text}
                {r.detail && <Info size={13} className="ml-1 inline align-[-2px] text-faint" />}
                {expanded && <span className="mt-1 block text-xs text-muted">{r.detail}</span>}
              </span>
            </button>
          </li>
        );
      })}
      {reasons.length > SHOW_FIRST && !all && (
        <li>
          <button type="button" onClick={() => setAll(true)} className="min-h-9 text-sm font-semibold text-primary">
            Show {reasons.length - SHOW_FIRST} more
          </button>
        </li>
      )}
    </ul>
  );
}

type AltState = { state: 'loading' } | { state: 'done'; list: Alternative[] } | { state: 'offline' } | { state: 'error' };

function BetterChoices({ food, score, onOpen }: { food: Props['food']; score: number; onOpen: (f: Omit<Food, 'id'>) => void }) {
  const [alt, setAlt] = useState<AltState>({ state: 'loading' });
  const cats = food.quality?.categories?.join(',');

  useEffect(() => {
    const ctrl = new AbortController();
    let live = true;
    const run = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return setAlt({ state: 'offline' });
      setAlt({ state: 'loading' });
      try {
        const list = await findBetterAlternatives({ barcode: food.barcode, unit: food.unit, quality: food.quality }, score, ctrl.signal);
        if (live) setAlt({ state: 'done', list });
      } catch (e) {
        if (live && (e as Error).name !== 'AbortError') setAlt({ state: 'error' });
      }
    };
    void run();
    return () => {
      live = false;
      ctrl.abort();
    };
    // Re-run only when the product (not the object identity) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.barcode, cats, score]);

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="hud-label mb-2 flex items-center gap-1.5">
        <Sparkles size={13} className="text-gold" /> Better choices
      </p>
      {alt.state === 'loading' && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin text-primary" /> Looking for healthier products like this…
        </p>
      )}
      {alt.state === 'offline' && <p className="py-1 text-sm text-muted">Go online to see healthier products like this.</p>}
      {alt.state === 'error' && <p className="py-1 text-sm text-muted">Couldn’t load suggestions right now.</p>}
      {alt.state === 'done' && alt.list.length === 0 && (
        <p className="py-1 text-sm text-muted">No clearly healthier products found in this category. Smaller portions are the easy win.</p>
      )}
      {alt.state === 'done' && alt.list.length > 0 && (
        <ul className="space-y-1.5">
          {alt.list.map(({ food: f, rating }) => (
            <li key={f.barcode ?? f.name}>
              <button
                type="button"
                onClick={() => onOpen(f)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface/60 p-2 text-left active:bg-surface-3/60"
              >
                <FoodAvatar name={f.name} imageUrl={f.imageUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block truncate text-xs text-muted">{f.brand ?? 'Open Food Facts'}</span>
                </span>
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-hud text-sm font-bold text-white tabular"
                  style={{ background: BAND_COLOR[rating.band] }}
                  aria-label={`Rated ${rating.score} out of 100`}
                >
                  {rating.score}
                </span>
                <ChevronRight size={16} className="text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
