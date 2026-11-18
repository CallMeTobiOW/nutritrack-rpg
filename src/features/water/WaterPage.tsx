import { useMemo, useState } from 'react';
import { Droplet, Pencil, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addWater, deleteWater, updateTargets, updateWater } from '../../db/actions';
import { useProfile, useRangeMetrics, useSettings, useWaterDay } from '../../hooks/useData';
import { addDays, formatShortDate, formatTime, formatWeekday, lastNDays, type DateKey } from '../../lib/dates';
import type { WaterEntry } from '../../lib/models';
import { progress } from '../../lib/nutrition';
import { formatVolume } from '../../lib/units';
import { sfx } from '../../lib/sound';
import { LIMITS } from '../../lib/limits';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader, EmptyState } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { Label, NumberInput } from '../../components/ui/Field';
import { AXIS_TICK, GRID_STROKE, Legend, TooltipCard } from '../../components/charts/ChartTooltip';
import { DateNavigator, useDiaryDate } from '../food/FoodPage';

export default function WaterPage() {
  const [date, setDate] = useDiaryDate();
  const entries = useWaterDay(date);
  const { targets } = useProfile();
  const settings = useSettings();
  const [custom, setCustom] = useState(false);
  const [editing, setEditing] = useState<WaterEntry | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);

  const ml = (entries ?? []).reduce((s, e) => s + e.ml, 0);
  const p = progress(ml, targets.waterMl);

  const add = (amount: number) => {
    sfx.tick();
    void addWater(date, amount);
  };

  return (
    <Page>
      <PageHeader back kicker="Hydration" title="Water" />
      <DateNavigator date={date} onChange={setDate} />

      <Card hud className="mb-4 text-center">
        <div className="flex justify-center">
          <ProgressRing value={p.ratio} size={190} stroke={15} from="var(--cyan)" to="var(--primary-2)" label={`${p.percent}% of water goal`}>
            <div>
              <Droplet size={22} className="mx-auto mb-1 text-cyan drop-shadow-[0_0_8px_var(--cyan)]" />
              <div className="font-hud tabular text-4xl font-bold leading-none">{formatVolume(ml)}</div>
              <div className="mt-1 text-xs text-muted">of {formatVolume(targets.waterMl)}</div>
            </div>
          </ProgressRing>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Progress" value={`${p.percent}%`} />
          <MiniStat label={p.remaining > 0 ? 'Remaining' : 'Goal'} value={p.remaining > 0 ? formatVolume(p.remaining) : 'Reached'} />
          <button type="button" onClick={() => setGoalOpen(true)} className="rounded-2xl border border-line bg-surface-3/50 py-2">
            <div className="font-hud flex items-center justify-center gap-1 text-lg font-bold">
              {formatVolume(targets.waterMl)} <Pencil size={12} className="text-faint" />
            </div>
            <div className="hud-label !text-[9px]">Daily goal</div>
          </button>
        </div>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Quick add</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {settings.waterQuickAmounts.map((a) => (
            <Button key={a} onClick={() => add(a)} className="!h-14 flex-col !gap-0">
              <span className="font-hud text-lg font-bold">+{a}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted">ml</span>
            </Button>
          ))}
          <Button variant="primary" onClick={() => setCustom(true)} className="!h-14">
            <Plus size={18} /> Custom
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Log</SectionTitle>
        {entries && entries.length > 0 ? (
          <ul className="divide-y divide-line">
            {[...entries].reverse().map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan/12 text-cyan">
                    <Droplet size={17} />
                  </span>
                  <span className="flex-1 font-medium tabular">{formatVolume(e.ml)}</span>
                  <span className="text-sm text-muted tabular">{formatTime(e.createdAt)}</span>
                  <Pencil size={14} className="text-faint" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Droplet size={26} />} title="No water logged">
            Tap a quick-add button each time you finish a drink.
          </EmptyState>
        )}
      </Card>

      <WaterHistory end={date} goal={targets.waterMl} />

      <AmountSheet
        open={custom}
        title="Custom amount"
        initial={undefined}
        onClose={() => setCustom(false)}
        onSave={(v) => {
          add(v);
          setCustom(false);
        }}
      />
      <AmountSheet
        open={!!editing}
        title="Edit drink"
        initial={editing?.ml}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          if (editing) void updateWater(editing.id, v);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) void deleteWater(editing.id);
          setEditing(null);
        }}
      />
      <AmountSheet
        open={goalOpen}
        title="Daily water goal"
        initial={targets.waterMl}
        min={500}
        max={6000}
        onClose={() => setGoalOpen(false)}
        onSave={(v) => {
          void updateTargets({ waterMl: v });
          setGoalOpen(false);
        }}
      />
    </Page>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-3/50 py-2">
      <div className="font-hud tabular text-lg font-bold">{value}</div>
      <div className="hud-label !text-[9px]">{label}</div>
    </div>
  );
}

function AmountSheet({
  open,
  title,
  initial,
  onClose,
  onSave,
  onDelete,
  min = LIMITS.waterMl.min,
  max = LIMITS.waterMl.max,
}: {
  open: boolean;
  title: string;
  initial: number | undefined;
  onClose: () => void;
  onSave: (ml: number) => void;
  onDelete?: () => void;
  min?: number;
  max?: number;
}) {
  const [v, setV] = useState<number | undefined>(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setV(initial);
  }
  const valid = v !== undefined && v >= min && v <= max;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="secondary" className="!px-3 text-danger" onClick={onDelete} aria-label="Delete">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="primary" block disabled={!valid} onClick={() => valid && onSave(Math.round(v))}>
            Save
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <Label htmlFor="amount-ml" hint={`${min}–${max} ml`}>
          Amount
        </Label>
        <NumberInput id="amount-ml" autoFocus value={v} onValue={setV} decimals={false} suffix="ml" />
      </div>
    </Sheet>
  );
}

function WaterHistory({ end, goal }: { end: DateKey; goal: number }) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const n = Number(range);
  const metrics = useRangeMetrics(addDays(end, -(n - 1)), end);
  const data = useMemo(
    () =>
      lastNDays(end, n).map((d) => ({
        date: d,
        label: n === 7 ? formatWeekday(d) : formatShortDate(d),
        ml: metrics?.get(d)?.waterMl ?? 0,
      })),
    [metrics, end, n],
  );
  const logged = data.filter((d) => d.ml > 0);
  const avg = logged.length ? logged.reduce((s, d) => s + d.ml, 0) / logged.length : 0;
  const hit = data.filter((d) => d.ml >= goal).length;
  // Round axis in 0.5 L steps (1 L above 4 L) that always includes the goal line.
  const step = Math.max(goal, ...data.map((d) => d.ml)) > 4000 ? 1000 : 500;
  const top = Math.ceil((Math.max(goal, ...data.map((d) => d.ml)) * 1.05) / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <Card>
      <SectionTitle>History</SectionTitle>
      <Segmented size="sm" className="mb-3" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />
      <div className="mb-2 flex gap-6 text-sm">
        <span className="text-muted">
          Average <b className="text-text tabular">{formatVolume(avg)}</b>
        </span>
        <span className="text-muted">
          Goal reached <b className="text-text tabular">{hit}/{n}</b> days
        </span>
      </div>
      <div className="h-44" role="img" aria-label="Water per day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -14 }} barCategoryGap={n === 7 ? '28%' : '12%'}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, top]} ticks={ticks} interval={0} tickFormatter={(v: number) => (v === 0 ? '0' : `${v / 1000}L`)} />
            <ReferenceLine y={goal} stroke="var(--muted)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: 'var(--surface-3)', opacity: 0.5 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !row) return null;
                return <TooltipCard title={formatShortDate(row.date)} rows={[{ label: 'Water', value: formatVolume(row.ml), color: 'var(--cyan)' }]} />;
              }}
            />
            <Bar dataKey="ml" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.date} fill={d.ml >= goal ? 'var(--cyan)' : 'color-mix(in srgb, var(--cyan) 45%, transparent)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Goal reached', color: 'var(--cyan)' },
          { label: 'Below goal', color: 'color-mix(in srgb, var(--cyan) 45%, transparent)' },
          { label: 'Goal', color: 'var(--muted)', dashed: true },
        ]}
      />
    </Card>
  );
}

