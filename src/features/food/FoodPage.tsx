import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookmarkPlus, CalendarDays, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, ScanBarcode, Search } from 'lucide-react';
import { copyMeal, saveMealFromDiary } from '../../db/actions';
import { useDiaryDay, useProfile } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { addDays, formatLongDate, type DateKey } from '../../lib/dates';
import { amountLabel } from '../../lib/food';
import { MEAL_LABELS, MEAL_SLOTS, type DiaryEntry, type MealSlot } from '../../lib/models';
import { scaleNutrients, sumNutrients, progress } from '../../lib/nutrition';
import { Page } from '../../components/layout/Page';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Misc';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Sheet } from '../../components/ui/Sheet';
import { Label, TextInput } from '../../components/ui/Field';
import { FoodAvatar } from './FoodAvatar';
import { PortionSheet, type PortionTarget } from './PortionSheet';

export function useDiaryDate(): [DateKey, (d: DateKey) => void] {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const raw = params.get('date');
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const setDate = (d: DateKey) => {
    const next = new URLSearchParams(params);
    if (d === today) next.delete('date');
    else next.set('date', d);
    setParams(next, { replace: true });
  };
  return [date, setDate];
}

export function DateNavigator({ date, onChange }: { date: DateKey; onChange: (d: DateKey) => void }) {
  const today = useToday();
  const inputRef = useRef<HTMLInputElement>(null);
  const label = date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : date === addDays(today, 1) ? 'Tomorrow' : formatLongDate(date);
  return (
    <div className="mb-4 flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
      <IconButton label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={20} />
      </IconButton>
      <button
        type="button"
        className="relative flex min-w-0 flex-1 items-center justify-center gap-2 font-hud text-lg font-semibold"
        onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.focus()}
      >
        <CalendarDays size={16} className="shrink-0 text-primary" />
        <span className="truncate">{label}</span>
        <input
          ref={inputRef}
          type="date"
          value={date}
          max={addDays(today, 7)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0"
          aria-label="Pick a date"
          tabIndex={-1}
        />
      </button>
      <IconButton label="Next day" onClick={() => onChange(addDays(date, 1))} disabled={date >= addDays(today, 7)}>
        <ChevronRight size={20} />
      </IconButton>
    </div>
  );
}

export default function FoodPage() {
  const [date, setDate] = useDiaryDate();
  const entries = useDiaryDay(date);
  const profile = useProfile();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<PortionTarget | null>(null);
  const [menuFor, setMenuFor] = useState<MealSlot | null>(null);

  const byMeal = useMemo(() => {
    const m = new Map<MealSlot, DiaryEntry[]>(MEAL_SLOTS.map((s) => [s, []]));
    for (const e of entries ?? []) m.get(e.meal)!.push(e);
    return m;
  }, [entries]);

  const totals = useMemo(() => sumNutrients((entries ?? []).map((e) => scaleNutrients(e.food.per100, e.amount))), [entries]);
  const kcal = progress(totals.energy.value, profile.targets.calories);
  const q = (meal: MealSlot) => `meal=${meal}&date=${date}`;

  return (
    <Page>
      <PageHeader
        kicker="Supply log"
        title="Food Diary"
        actions={
          <>
            <IconButton label="Search foods" onClick={() => navigate(`/food/add?meal=auto&date=${date}`)}>
              <Search size={21} />
            </IconButton>
            <IconButton label="Scan a barcode" onClick={() => navigate(`/food/scan?meal=auto&date=${date}`)} className="text-primary">
              <ScanBarcode size={22} />
            </IconButton>
          </>
        }
      />
      <DateNavigator date={date} onChange={setDate} />

      <Card hud className="mb-4">
        <div className="grid grid-cols-3 text-center">
          <Summary label="Target" value={kcal.target} />
          <Summary label="Eaten" value={Math.round(kcal.consumed)} accent />
          <Summary label={kcal.remaining < 0 ? 'Over' : 'Remaining'} value={Math.abs(Math.round(kcal.remaining))} danger={kcal.remaining < 0} />
        </div>
        <ProgressBar value={kcal.ratio} color="var(--gold)" to="var(--orange)" className="mt-3" label="Calories" />
        <div className="mt-3 flex justify-between text-xs text-muted tabular">
          <span>
            <b className="text-protein">P</b> {Math.round(totals.protein.value)}/{profile.targets.protein} g
          </span>
          <span>
            <b className="text-carbs">C</b> {Math.round(totals.carbs.value)}/{profile.targets.carbs} g
          </span>
          <span>
            <b className="text-fat">F</b> {Math.round(totals.fat.value)}/{profile.targets.fat} g
          </span>
          <Link to="/nutrition" className="font-semibold text-primary">
            Details
          </Link>
        </div>
      </Card>

      <div className="space-y-3">
        {MEAL_SLOTS.map((slot) => {
          const list = byMeal.get(slot) ?? [];
          const mealKcal = list.reduce((s, e) => s + (e.food.per100.energy ?? 0) * (e.amount / 100), 0);
          return (
            <Card key={slot} padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 pb-2 pt-3">
                <h2 className="font-hud flex-1 text-lg font-bold">{MEAL_LABELS[slot]}</h2>
                <span className="font-hud tabular text-sm font-semibold text-muted">{Math.round(mealKcal)} kcal</span>
                <IconButton label={`${MEAL_LABELS[slot]} options`} onClick={() => setMenuFor(slot)} className="-mr-1 h-8 w-8">
                  <MoreHorizontal size={18} />
                </IconButton>
              </div>
              {list.length > 0 && (
                <ul className="border-t border-line">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: 'edit', entry: e })}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-surface-3/60"
                      >
                        <FoodAvatar name={e.food.name} imageUrl={e.food.imageUrl} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{e.food.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {e.food.brand ? `${e.food.brand} · ` : ''}
                            {amountLabel(e.amount, e.food.unit, e.servingLabel)}
                          </span>
                        </span>
                        <span className="tabular text-sm font-semibold">
                          {e.food.per100.energy === undefined ? '—' : Math.round((e.food.per100.energy * e.amount) / 100)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => navigate(`/food/add?${q(slot)}`)}
                className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-primary transition-colors active:bg-surface-3/60"
              >
                <Plus size={18} /> Add food
              </button>
            </Card>
          );
        })}
      </div>

      <PortionSheet target={editing} date={date} meal={editing?.mode === 'edit' ? editing.entry.meal : 'snacks'} onClose={() => setEditing(null)} />
      <MealMenu slot={menuFor} date={date} hasEntries={!!menuFor && (byMeal.get(menuFor)?.length ?? 0) > 0} onClose={() => setMenuFor(null)} />
    </Page>
  );
}

function Summary({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  return (
    <div>
      <div className={`font-hud tabular text-2xl font-bold ${accent ? 'text-gradient-gold' : ''} ${danger ? 'text-danger' : ''}`}>{value.toLocaleString()}</div>
      <div className="hud-label !text-[10px]">{label}</div>
    </div>
  );
}

function MealMenu({ slot, date, hasEntries, onClose }: { slot: MealSlot | null; date: DateKey; hasEntries: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!slot) return null;
  const close = () => {
    setSaving(false);
    setName('');
    setMessage(null);
    onClose();
  };
  return (
    <Sheet open onClose={close} title={MEAL_LABELS[slot]}>
      {message ? (
        <div className="py-4">
          <p className="mb-4">{message}</p>
          <Button block onClick={close}>
            Done
          </Button>
        </div>
      ) : saving ? (
        <div className="space-y-3 py-2">
          <Label htmlFor="meal-name">Name this meal</Label>
          <TextInput id="meal-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. My usual ${MEAL_LABELS[slot].toLowerCase()}`} />
          <Button
            variant="primary"
            block
            onClick={async () => {
              const m = await saveMealFromDiary(name || MEAL_LABELS[slot], date, slot);
              setMessage(m ? `Saved "${m.name}". Find it under Meals when adding food.` : 'Nothing to save yet.');
            }}
          >
            Save meal
          </Button>
        </div>
      ) : (
        <div className="space-y-2 py-2">
          <Button
            block
            className="!justify-start"
            onClick={async () => {
              const n = await copyMeal(addDays(date, -1), slot, date);
              setMessage(n ? `Copied ${n} item${n === 1 ? '' : 's'} from yesterday.` : `Yesterday's ${MEAL_LABELS[slot].toLowerCase()} was empty.`);
            }}
          >
            <Copy size={18} /> Copy from yesterday
          </Button>
          <Button block className="!justify-start" disabled={!hasEntries} onClick={() => setSaving(true)}>
            <BookmarkPlus size={18} /> Save as a meal
          </Button>
        </div>
      )}
    </Sheet>
  );
}
