import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Info, SlidersHorizontal } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDayMetrics, useProfile, useRangeMetrics } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { addDays, formatShortDate, formatWeekday, lastNDays, startOfWeek, type DateKey } from '../../lib/dates';
import { DETAIL_KEYS, MACRO_KEYS, MINERAL_KEYS, NUTRIENTS, VITAMIN_KEYS, formatAmount, type NutrientKey } from '../../lib/nutrients';
import { completeness, progress, type NutrientTotal } from '../../lib/nutrition';
import { REFERENCE_SOURCE } from '../../lib/references';
import type { DayMetrics } from '../../lib/quests';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Misc';
import { IconButton } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Segmented } from '../../components/ui/Segmented';
import { AXIS_TICK, GRID_STROKE, Legend, TooltipCard } from '../../components/charts/ChartTooltip';
import { DateNavigator, useDiaryDate } from '../food/FoodPage';

type Tab = 'macros' | 'vitamins' | 'minerals';
const MACRO_COLORS: Record<string, string> = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };
const MACRO_SHORT: Record<string, string> = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };

export default function NutritionPage() {
  const [params, setParams] = useSearchParams();
  const tab = (['macros', 'vitamins', 'minerals'].includes(params.get('tab') ?? '') ? params.get('tab') : 'macros') as Tab;
  const [date, setDate] = useDiaryDate();
  const metrics = useDayMetrics(date);
  const navigate = useNavigate();

  return (
    <Page>
      <PageHeader
        kicker="Field analysis"
        title="Nutrition"
        actions={
          <IconButton label="Edit targets" onClick={() => navigate('/profile/targets')}>
            <SlidersHorizontal size={20} />
          </IconButton>
        }
      />
      <DateNavigator date={date} onChange={setDate} />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={(t) => {
          const next = new URLSearchParams(params);
          next.set('tab', t);
          setParams(next, { replace: true });
        }}
        options={[
          { value: 'macros', label: 'Macros' },
          { value: 'vitamins', label: 'Vitamins' },
          { value: 'minerals', label: 'Minerals' },
        ]}
      />
      {!metrics ? null : tab === 'macros' ? (
        <MacroView m={metrics} date={date} />
      ) : (
        <MicroView m={metrics} keys={tab === 'vitamins' ? VITAMIN_KEYS : MINERAL_KEYS} title={tab === 'vitamins' ? 'Vitamins' : 'Minerals'} />
      )}
    </Page>
  );
}

function MacroView({ m, date }: { m: DayMetrics; date: DateKey }) {
  const { targets } = useProfile();
  const kcal = m.totals.energy.value;
  const split = MACRO_KEYS.map((k) => ({ k, kcal: m.totals[k].value * (k === 'fat' ? 9 : 4) }));
  const splitTotal = split.reduce((s, x) => s + x.kcal, 0);

  return (
    <div className="space-y-4">
      <Card hud>
        <div className="grid grid-cols-3 gap-2">
          {MACRO_KEYS.map((k) => {
            const p = progress(m.totals[k].value, targets[k]);
            return (
              <div key={k} className="flex flex-col items-center text-center">
                <ProgressRing value={p.ratio} size={92} stroke={9} from={MACRO_COLORS[k]} to={MACRO_COLORS[k]} label={`${MACRO_SHORT[k]} ${p.percent}%`}>
                  <div>
                    <div className="font-hud tabular text-xl font-bold leading-none">{Math.round(p.consumed)}</div>
                    <div className="text-[10px] text-muted">/ {p.target} g</div>
                  </div>
                </ProgressRing>
                <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: MACRO_COLORS[k] }} />
                  {MACRO_SHORT[k]}
                </div>
                <div className="text-xs text-muted tabular">
                  {p.remaining >= 0 ? `${Math.round(p.remaining)} g left` : `${Math.round(-p.remaining)} g over`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>Calories eaten, split by macro</span>
            <span className="tabular">{Math.round(kcal).toLocaleString()} kcal</span>
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-3">
            {splitTotal > 0 &&
              split.map((s) => (
                <div key={s.k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.kcal / splitTotal) * 100}%`, background: MACRO_COLORS[s.k] }} />
              ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular">
            {split.map((s) => (
              <span key={s.k} className="text-muted">
                {MACRO_SHORT[s.k]} <b className="text-text">{splitTotal ? Math.round((s.kcal / splitTotal) * 100) : 0}%</b>
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Also tracking</SectionTitle>
        <div className="space-y-3.5">
          {DETAIL_KEYS.map((k) => (
            <NutrientBar key={k} k={k} total={m.totals[k]} target={targets[k]} />
          ))}
        </div>
      </Card>

      <MacroTrends end={date} />
    </div>
  );
}

function NutrientBar({ k, total, target }: { k: NutrientKey; total: NutrientTotal; target: number }) {
  const def = NUTRIENTS[k];
  const p = progress(total.value, target);
  const c = completeness(total);
  const limit = def.kind === 'limit';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="font-medium">{def.label}</span>
          {def.alias && <span className="ml-1.5 text-xs text-faint">{def.alias}</span>}
          {limit && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">limit</span>}
        </span>
        <span className="shrink-0 text-sm tabular">
          {c === 'unknown' ? (
            <span className="text-faint">No data</span>
          ) : (
            <>
              {c === 'partial' && <span className="text-faint">≥ </span>}
              <b>{formatAmount(total.value, def.unit)}</b>
              <span className="text-muted">
                {' '}
                / {formatAmount(target, def.unit)} {def.unit}
              </span>
            </>
          )}
        </span>
      </div>
      <ProgressBar value={c === 'unknown' ? 0 : p.ratio} color={limit ? 'var(--primary)' : 'var(--success)'} limit={limit} height={6} label={def.label} />
      <div className="mt-1 flex justify-between text-[11px] text-faint tabular">
        <span>
          {c === 'partial' && `${total.unknown} food${total.unknown === 1 ? '' : 's'} without data`}
          {c === 'unknown' && 'Logged foods do not report this'}
          {c === 'none' && 'Nothing logged yet'}
        </span>
        <span>
          {c !== 'unknown' && c !== 'none' && (limit ? (p.remaining >= 0 ? `${formatAmount(p.remaining, def.unit)} ${def.unit} under limit` : `${formatAmount(-p.remaining, def.unit)} ${def.unit} over`) : `${p.percent}%${p.remaining > 0 ? ` · ${formatAmount(p.remaining, def.unit)} ${def.unit} to go` : ''}`)}
        </span>
      </div>
    </div>
  );
}

function MicroView({ m, keys, title }: { m: DayMetrics; keys: NutrientKey[]; title: string }) {
  const { microTargets } = useProfile();
  const reported = keys.filter((k) => m.totals[k].known > 0).length;
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>{title}</SectionTitle>
        {m.entries > 0 && (
          <p className="mb-4 flex gap-2 rounded-xl bg-surface-3/60 p-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" />
            {reported} of {keys.length} reported by the foods logged. Most packaged foods only list a few micronutrients, so totals are a minimum. Missing values are never counted as zero.
          </p>
        )}
        <div className="space-y-4">
          {keys.map((k) => (
            <NutrientBar key={k} k={k} total={m.totals[k]} target={microTargets[k] ?? 0} />
          ))}
        </div>
      </Card>
      <p className="px-1 text-xs text-faint">
        {REFERENCE_SOURCE} Targets can be customised in{' '}
        <Link to="/profile/targets" className="text-primary">
          Goals &amp; targets
        </Link>
        .
      </p>
    </div>
  );
}

type Range = '7d' | '30d' | '12w';

function MacroTrends({ end }: { end: DateKey }) {
  const [range, setRange] = useState<Range>('7d');
  const { targets } = useProfile();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 84;
  const start = range === '12w' ? startOfWeek(addDays(end, -83)) : addDays(end, -(days - 1));
  const metrics = useRangeMetrics(start, end);
  const today = useToday();

  const data = useMemo(() => {
    if (!metrics) return [];
    const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : null);
    if (range !== '12w') {
      return lastNDays(end, days).map((d) => {
        const m = metrics.get(d);
        const logged = !!m && m.entries > 0;
        return {
          label: range === '7d' ? formatWeekday(d) : formatShortDate(d),
          date: d,
          protein: logged ? pct(m!.totals.protein.value, targets.protein) : null,
          carbs: logged ? pct(m!.totals.carbs.value, targets.carbs) : null,
          fat: logged ? pct(m!.totals.fat.value, targets.fat) : null,
          g: logged ? { protein: m!.totals.protein.value, carbs: m!.totals.carbs.value, fat: m!.totals.fat.value } : null,
        };
      });
    }
    // Weekly averages over logged days.
    const weeks: { label: string; date: string; protein: number | null; carbs: number | null; fat: number | null; g: Record<string, number> | null }[] = [];
    for (let w = startOfWeek(start); w <= end; w = addDays(w, 7)) {
      const logged = lastNDays(addDays(w, 6), 7)
        .map((d) => metrics.get(d))
        .filter((m): m is DayMetrics => !!m && m.entries > 0);
      const avg = (k: 'protein' | 'carbs' | 'fat') => (logged.length ? logged.reduce((s, m) => s + m.totals[k].value, 0) / logged.length : null);
      const g = logged.length ? { protein: avg('protein')!, carbs: avg('carbs')!, fat: avg('fat')! } : null;
      weeks.push({
        label: formatShortDate(w),
        date: w,
        protein: g ? pct(g.protein, targets.protein) : null,
        carbs: g ? pct(g.carbs, targets.carbs) : null,
        fat: g ? pct(g.fat, targets.fat) : null,
        g,
      });
    }
    return weeks;
  }, [metrics, range, end, days, start, targets]);

  const hasData = data.some((d) => d.protein !== null);

  return (
    <Card>
      <SectionTitle>Trends · % of target</SectionTitle>
      <Segmented
        size="sm"
        className="mb-3"
        value={range}
        onChange={setRange}
        options={[
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: '12w', label: '12 weeks' },
        ]}
      />
      {hasData ? (
        <>
          <div className="h-52" role="img" aria-label="Macro intake as a percentage of target over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(120, Math.ceil(max / 20) * 20)]} unit="%" />
                <ReferenceLine y={100} stroke="var(--muted)" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ stroke: 'var(--line-strong)' }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                    if (!active || !row?.g) return null;
                    return (
                      <TooltipCard
                        title={range === '12w' ? `Week of ${row.label} (avg)` : row.date === today ? 'Today' : formatShortDate(row.date)}
                        rows={(['protein', 'carbs', 'fat'] as const).map((k) => ({
                          label: MACRO_SHORT[k],
                          color: MACRO_COLORS[k],
                          value: `${Math.round(row.g![k])} g · ${row[k]}%`,
                        }))}
                      />
                    );
                  }}
                />
                {(['protein', 'carbs', 'fat'] as const).map((k) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={MACRO_COLORS[k]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: MACRO_COLORS[k] }} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={[
              { label: 'Protein', color: MACRO_COLORS.protein },
              { label: 'Carbs', color: MACRO_COLORS.carbs },
              { label: 'Fat', color: MACRO_COLORS.fat },
              { label: 'Target (100%)', color: 'var(--muted)', dashed: true },
            ]}
          />
          <p className="mt-2 text-xs text-faint">Days with nothing logged are skipped, not counted as zero.</p>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-muted">Log food on a few days to see your trends.</p>
      )}
    </Card>
  );
}
