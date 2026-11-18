import { DETAIL_KEYS, MACRO_KEYS, MICRO_KEYS, NUTRIENTS, formatAmount, type NutrientKey, type NutrientValues } from '../../lib/nutrients';

const COLORS: Partial<Record<NutrientKey, string>> = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };

function Value({ v, k }: { v: number | undefined; k: NutrientKey }) {
  if (v === undefined) return <span className="text-faint" title="Not provided by the data source">—</span>;
  return (
    <span className="tabular">
      {formatAmount(v, NUTRIENTS[k].unit)} <span className="text-faint">{NUTRIENTS[k].unit}</span>
    </span>
  );
}

/** Macro summary for a portion. Missing values show as "—", never 0. */
export function PortionSummary({ values }: { values: NutrientValues }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-3/50 p-4">
      <div className="flex items-baseline justify-between">
        <span className="hud-label">Calories</span>
        <span className="font-hud tabular text-gradient-gold text-3xl font-bold">
          {values.energy === undefined ? '—' : Math.round(values.energy).toLocaleString()}
          <span className="ml-1 text-sm text-muted">kcal</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {MACRO_KEYS.map((k) => (
          <div key={k} className="rounded-xl bg-surface-2/70 py-2">
            <div className="font-hud text-lg font-bold" style={{ color: COLORS[k] }}>
              {values[k] === undefined ? '—' : `${formatAmount(values[k]!, 'g')} g`}
            </div>
            <div className="hud-label !text-[9px]">{k === 'carbs' ? 'Carbs' : NUTRIENTS[k].label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {DETAIL_KEYS.map((k) => (
          <div key={k}>
            <div className="text-muted">{NUTRIENTS[k].short}</div>
            <div className="font-semibold">
              <Value v={values[k]} k={k} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full table: per 100 and per chosen portion, including any micronutrients reported. */
export function NutritionTable({
  per100,
  portion,
  unit,
  portionLabel,
}: {
  per100: NutrientValues;
  portion: NutrientValues;
  unit: string;
  portionLabel: string;
}) {
  const micros = MICRO_KEYS.filter((k) => per100[k] !== undefined);
  const missingMicros = MICRO_KEYS.length - micros.length;
  const rows: NutrientKey[] = ['energy', ...MACRO_KEYS, ...DETAIL_KEYS, ...micros];
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-3/70 text-left">
          <tr>
            <th className="px-3 py-2 font-medium text-muted">Nutrient</th>
            <th className="px-3 py-2 text-right font-medium text-muted">Per 100 {unit}</th>
            <th className="px-3 py-2 text-right font-medium text-muted">{portionLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k} className="border-t border-line">
              <td className="px-3 py-2">{NUTRIENTS[k].label}</td>
              <td className="px-3 py-2 text-right">
                <Value v={per100[k]} k={k} />
              </td>
              <td className="px-3 py-2 text-right font-medium">
                <Value v={portion[k]} k={k} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line bg-surface-3/40 px-3 py-2 text-xs text-faint">
        “—” means the value was not provided, so it is not counted as zero.
        {missingMicros > 0 && ` ${missingMicros} vitamins/minerals are not reported for this food.`}
      </p>
    </div>
  );
}
