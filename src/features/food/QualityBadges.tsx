import type { FoodQuality, NutriScore } from '../../lib/models';

const SCORE_COLOR: Record<NutriScore, string> = { a: '#038141', b: '#85bb2f', c: '#e8b400', d: '#ee8100', e: '#e63e11' };
const NOVA_COLOR = { 1: '#038141', 2: '#c9a400', 3: '#ee8100', 4: '#e63e11' } as const;
const NOVA_TEXT = { 1: 'Unprocessed', 2: 'Culinary ingredient', 3: 'Processed', 4: 'Ultra-processed' } as const;

/** Nutri-Score grade and NOVA processing group from Open Food Facts. */
export function QualityBadges({ quality }: { quality: FoodQuality }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Product scores">
      {quality.nutriScore && (
        <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-3/50 py-1 pl-1 pr-3 text-xs font-semibold">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg font-hud text-base font-bold uppercase text-white"
            style={{ background: SCORE_COLOR[quality.nutriScore] }}
          >
            {quality.nutriScore}
          </span>
          Nutri-Score
        </span>
      )}
      {quality.nova && (
        <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-3/50 py-1 pl-1 pr-3 text-xs font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg font-hud text-base font-bold text-white" style={{ background: NOVA_COLOR[quality.nova] }}>
            {quality.nova}
          </span>
          {NOVA_TEXT[quality.nova]}
        </span>
      )}
    </div>
  );
}
