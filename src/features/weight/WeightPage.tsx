import { useMemo, useState } from 'react';
import { Scale, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deleteWeight, logWeight, saveProfile, updateWeight } from '../../db/actions';
import { useProfile, useSettings, useWeights } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { addDays, formatLongDate, formatShortDate, type DateKey } from '../../lib/dates';
import type { WeightEntry } from '../../lib/models';
import { LIMITS } from '../../lib/limits';
import { movingAverage, weeklyWeightAverages } from '../../lib/stats';
import { formatWeight, kgToUnit, unitToKg, type WeightUnit } from '../../lib/units';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { EmptyState, PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { Label, NumberInput, TextInput } from '../../components/ui/Field';
import { AXIS_TICK, GRID_STROKE, Legend, TooltipCard } from '../../components/charts/ChartTooltip';

type Range = '30' | '90' | '365' | 'all';

/** Signed change with unit, e.g. "−1.2 kg". */
function signed(kg: number, unit: WeightUnit): string {
  const v = kgToUnit(kg, unit);
  const s = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${s}${Math.abs(v).toFixed(1)} ${unit}`;
}

export default function WeightPage() {
  const today = useToday();
  const weights = useWeights();
  const profile = useProfile();
  const { weightUnit: unit } = useSettings();
  const [logDate, setLogDate] = useState<DateKey>(today);
  const [value, setValue] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);

  const list = useMemo(() => weights ?? [], [weights]);
  const latest = list[list.length - 1];
  const first = list[0];
  const current = latest?.kg ?? profile.weightKg;
  const start = first?.kg ?? profile.weightKg;
  const goal = profile.goalWeightKg;
  const existingForDate = list.find((w) => w.date === logDate);

  // Progress towards goal from the starting weight (works for losing or gaining).
  const goalProgress = goal !== undefined && start !== goal ? Math.max(0, Math.min(1, (start - current) / (start - goal))) : goal === current ? 1 : 0;

  const submit = async () => {
    setError('');
    if (value === undefined) return setError('Enter your weight.');
    try {
      await logWeight(logDate, unitToKg(value, unit));
      setValue(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const weekly = useMemo(() => weeklyWeightAverages(list).slice(-8).reverse(), [list]);

  return (
    <Page>
      <PageHeader back kicker="Body metrics" title="Weight" />

      <Card hud className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="hud-label !text-[10px]">Current</div>
            <div className="font-hud tabular text-2xl font-bold">{kgToUnit(current, unit).toFixed(1)}</div>
            <div className="text-xs text-muted">{unit}</div>
          </div>
          <div>
            <div className="hud-label !text-[10px]">Change</div>
            <div className="font-hud tabular flex items-center justify-center gap-1 text-2xl font-bold">
              {current < start ? <TrendingDown size={18} className="text-success" /> : current > start ? <TrendingUp size={18} className="text-orange" /> : null}
              {kgToUnit(Math.abs(current - start), unit).toFixed(1)}
            </div>
            <div className="text-xs text-muted">{list.length > 1 ? `since ${formatShortDate(first.date)}` : unit}</div>
          </div>
          <button type="button" onClick={() => setGoalOpen(true)} className="rounded-xl transition active:bg-surface-3">
            <div className="hud-label !text-[10px]">Goal</div>
            <div className="font-hud tabular text-gradient-gold text-2xl font-bold">{goal ? kgToUnit(goal, unit).toFixed(1) : 'Set'}</div>
            <div className="text-xs text-muted">{goal ? (goalProgress >= 1 ? 'goal reached' : `${kgToUnit(Math.abs(current - goal), unit).toFixed(1)} ${unit} to go`) : 'tap to set'}</div>
          </button>
        </div>
        {goal !== undefined && (
          <div className="mt-4">
            <ProgressBar value={goalProgress} color="var(--gold)" to="var(--orange)" label="Progress to goal weight" />
            <p className="mt-1.5 text-xs text-muted tabular">{Math.round(goalProgress * 100)}% of the way from {formatWeight(start, unit)} to {formatWeight(goal, unit)}</p>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Log a weigh-in</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="w-date">Date</Label>
            <input
              id="w-date"
              type="date"
              value={logDate}
              max={today}
              onChange={(e) => e.target.value && setLogDate(e.target.value)}
              className="h-12 w-full rounded-2xl border border-line bg-surface-3/70 px-3 text-[16px] text-text outline-none focus:border-primary"
            />
          </div>
          <div>
            <Label htmlFor="w-value">Weight</Label>
            <NumberInput id="w-value" value={value} onValue={setValue} suffix={unit} placeholder={existingForDate ? kgToUnit(existingForDate.kg, unit).toFixed(1) : ''} />
          </div>
        </div>
        {existingForDate && <p className="mt-2 text-xs text-muted">You already logged {formatWeight(existingForDate.kg, unit)} on this day. Saving replaces it.</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button variant="primary" block className="mt-3" onClick={submit}>
          <Scale size={18} /> {existingForDate ? 'Update weigh-in' : 'Log weigh-in'}
        </Button>
        <p className="mt-2 text-xs text-faint">Tip: weigh at the same time each morning. Daily numbers bounce around; the 7-day average shows the real trend.</p>
      </Card>

      <WeightChart weights={list} unit={unit} goal={goal} today={today} />

      {weekly.length > 0 && (
        <Card className="mb-4">
          <SectionTitle>Weekly averages</SectionTitle>
          <ul className="divide-y divide-line">
            {weekly.map((w, i) => {
              const prev = weekly[i + 1];
              return (
                <li key={w.week} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">{w.week.replace('-W', ' · week ')}</span>
                  <span className="flex items-center gap-3 tabular">
                    {prev && <span className="text-xs text-muted">{signed(w.kg - prev.kg, unit)}</span>}
                    <b>{formatWeight(w.kg, unit)}</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>History</SectionTitle>
        {list.length === 0 ? (
          <EmptyState icon={<Scale size={26} />} title="No weigh-ins yet">
            Log your first weigh-in to start your trend line.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {[...list].reverse().map((w, i, arr) => {
              const prev = arr[i + 1];
              return (
                <li key={w.id}>
                  <button type="button" onClick={() => setEditing(w)} className="flex w-full items-center justify-between py-2.5 text-left">
                    <span>
                      <span className="block font-medium">{formatLongDate(w.date)}</span>
                      {w.note && <span className="block text-xs text-muted">{w.note}</span>}
                    </span>
                    <span className="text-right tabular">
                      <span className="block font-semibold">{formatWeight(w.kg, unit)}</span>
                      {prev && <span className="block text-xs text-muted">{signed(w.kg - prev.kg, unit)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <EditWeightSheet entry={editing} unit={unit} today={today} onClose={() => setEditing(null)} />
      <GoalSheet open={goalOpen} unit={unit} goal={goal} onClose={() => setGoalOpen(false)} />
    </Page>
  );
}

function WeightChart({ weights, unit, goal, today }: { weights: WeightEntry[]; unit: WeightUnit; goal?: number; today: DateKey }) {
  const [range, setRange] = useState<Range>('90');
  const data = useMemo(() => {
    const from = range === 'all' ? '0000-00-00' : addDays(today, -Number(range));
    const inRange = weights.filter((w) => w.date >= from);
    const avg = movingAverage(inRange.map((w) => w.kg), 7);
    return inRange.map((w, i) => ({
      date: w.date,
      label: formatShortDate(w.date),
      weight: Math.round(kgToUnit(w.kg, unit) * 10) / 10,
      trend: avg[i] == null ? null : Math.round(kgToUnit(avg[i]!, unit) * 10) / 10,
    }));
  }, [weights, range, today, unit]);

  return (
    <Card className="mb-4">
      <SectionTitle>Trend</SectionTitle>
      <Segmented
        size="sm"
        className="mb-3"
        value={range}
        onChange={setRange}
        options={[
          { value: '30', label: '30 d' },
          { value: '90', label: '90 d' },
          { value: '365', label: '1 yr' },
          { value: 'all', label: 'All' },
        ]}
      />
      {data.length < 2 ? (
        <p className="py-6 text-center text-sm text-muted">Log at least two weigh-ins to draw your trend.</p>
      ) : (
        <>
          <div className="h-52" role="img" aria-label="Weight over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => v.toFixed(0)} />
                {goal !== undefined && <ReferenceLine ifOverflow="extendDomain" y={Math.round(kgToUnit(goal, unit) * 10) / 10} stroke="var(--gold)" strokeDasharray="4 4" />}
                <Tooltip
                  cursor={{ stroke: 'var(--line-strong)' }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                    if (!active || !row) return null;
                    return (
                      <TooltipCard
                        title={formatShortDate(row.date)}
                        rows={[
                          { label: 'Weigh-in', value: `${row.weight} ${unit}`, color: 'var(--primary)' },
                          ...(row.trend != null ? [{ label: '7-entry avg', value: `${row.trend} ${unit}`, color: 'var(--violet)' }] : []),
                        ]}
                      />
                    );
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={0} dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="trend" stroke="var(--violet)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={[
              { label: 'Weigh-ins', color: 'var(--primary)' },
              { label: 'Trend (avg of last 7)', color: 'var(--violet)' },
              ...(goal !== undefined ? [{ label: 'Goal', color: 'var(--gold)', dashed: true }] : []),
            ]}
          />
        </>
      )}
    </Card>
  );
}

function EditWeightSheet({ entry, unit, today, onClose }: { entry: WeightEntry | null; unit: WeightUnit; today: DateKey; onClose: () => void }) {
  const [v, setV] = useState<number | undefined>();
  const [date, setDate] = useState<DateKey>(today);
  const [note, setNote] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (entry && entry.id !== loadedId) {
    setLoadedId(entry.id);
    setV(Math.round(kgToUnit(entry.kg, unit) * 10) / 10);
    setDate(entry.date);
    setNote(entry.note ?? '');
    setError('');
  }
  if (!entry) return null;
  return (
    <Sheet
      open
      onClose={() => {
        setLoadedId(null);
        onClose();
      }}
      title="Edit weigh-in"
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="!px-3 text-danger"
            aria-label="Delete weigh-in"
            onClick={async () => {
              await deleteWeight(entry.id);
              setLoadedId(null);
              onClose();
            }}
          >
            <Trash2 size={18} />
          </Button>
          <Button
            variant="primary"
            block
            disabled={v === undefined}
            onClick={async () => {
              setError('');
              try {
                await updateWeight(entry.id, { kg: unitToKg(v!, unit), date, note: note.trim() || undefined });
              } catch (e) {
                return setError((e as Error).message);
              }
              setLoadedId(null);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2">
        <div>
          <Label htmlFor="ew-date">Date</Label>
          <input
            id="ew-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-surface-3/70 px-3 text-[16px] text-text outline-none focus:border-primary"
          />
        </div>
        <div>
          <Label htmlFor="ew-val">Weight</Label>
          <NumberInput id="ew-val" value={v} onValue={setV} suffix={unit} />
        </div>
        <div>
          <Label htmlFor="ew-note" hint="Optional">Note</Label>
          <TextInput id="ew-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function GoalSheet({ open, unit, goal, onClose }: { open: boolean; unit: WeightUnit; goal?: number; onClose: () => void }) {
  const toDisplay = (kg?: number) => (kg === undefined ? undefined : Math.round(kgToUnit(kg, unit) * 10) / 10);
  const [v, setV] = useState<number | undefined>(toDisplay(goal));
  const [error, setError] = useState('');
  // Refill the field with the current goal each time the sheet opens (or the unit changes).
  const loadKey = open ? `${goal ?? ''}|${unit}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (loadKey !== loadedKey) {
    setLoadedKey(loadKey);
    if (loadKey !== null) {
      setV(toDisplay(goal));
      setError('');
    }
  }
  const save = async () => {
    const kg = unitToKg(v!, unit);
    if (!(kg >= LIMITS.weightKg.min && kg <= LIMITS.weightKg.max)) {
      return setError(`Enter a goal between ${formatWeight(LIMITS.weightKg.min, unit)} and ${formatWeight(LIMITS.weightKg.max, unit)}.`);
    }
    await saveProfile({ goalWeightKg: kg });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Goal weight"
      footer={
        <Button
          variant="gold"
          block
          disabled={v === undefined}
          onClick={save}
        >
          <Target size={18} /> Set goal
        </Button>
      }
    >
      <div className="py-2">
        <Label htmlFor="goal-w">Target weight</Label>
        <NumberInput id="goal-w" value={v} onValue={setV} suffix={unit} />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-faint">A sustainable pace is around 0.25–1% of body weight per week.</p>
      </div>
    </Sheet>
  );
}
