import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink, Heart, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addDiaryEntry, deleteDiaryEntry, saveOffFood, toggleFavorite, updateDiaryEntry } from '../../db/actions';
import type { DateKey } from '../../lib/dates';
import { nutrientsFor, portionOptions, presetPortion, round, servingText } from '../../lib/food';
import { qualityIssues } from '../../lib/foodQuality';
import { MEAL_LABELS, MEAL_SLOTS, type DiaryEntry, type Food, type FoodQuality, type FoodSnapshot, type MealSlot } from '../../lib/models';
import { LIMITS } from '../../lib/limits';
import { cn } from '../../lib/cn';
import { sfx } from '../../lib/sound';
import { Sheet } from '../../components/ui/Sheet';
import { Button, IconButton } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/Field';
import { Chip } from '../../components/ui/Misc';
import { FoodAvatar } from './FoodAvatar';
import { NutritionTable, PortionSummary } from './NutritionFacts';
import { QualityBadges } from './QualityBadges';
import { HealthCard } from './HealthCard';
import { IngredientsSheet } from './IngredientsSheet';
import { needsRefresh, refreshInBackground } from '../../db/scans';

type Target =
  | { mode: 'add'; food: Food | Omit<Food, 'id'>; scanned?: boolean }
  | { mode: 'edit'; entry: DiaryEntry }
  /** Choose a portion without logging it (whole-meal scan tray). */
  | { mode: 'pick'; food: Food; amount?: number; servingLabel?: string; onPick: (amount: number, servingLabel?: string) => void };

interface PortionSheetProps {
  target: Target | null;
  date: DateKey;
  meal: MealSlot;
  onClose: () => void;
  onDone?: (meal: MealSlot) => void;
  /** Open another product, e.g. a healthier suggestion. Omit to hide suggestions. */
  onOpenFood?: (food: Omit<Food, 'id'>) => void;
}

/** Choose a quantity, preview nutrition and add to (or edit in) the diary. */
export function PortionSheet({ target, date, meal: initialMeal, onClose, onDone, onOpenFood }: PortionSheetProps) {
  const food: (FoodSnapshot & { quality?: FoodQuality }) | null = target ? (target.mode === 'edit' ? target.entry.food : target.food) : null;
  const savedId =
    target?.mode === 'edit' ? target.entry.foodId : target && 'id' in target.food ? target.food.id : undefined;
  const saved = useLiveQuery(() => (savedId ? db.foods.get(savedId) : undefined), [savedId]);
  const navigate = useNavigate();

  const options = useMemo(() => (food ? portionOptions(food) : []), [food]);
  const [optionKey, setOptionKey] = useState('raw');
  const [qty, setQty] = useState<number | undefined>(100);
  const [meal, setMeal] = useState<MealSlot>(initialMeal);
  const [showTable, setShowTable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [ingredientsFor, setIngredientsFor] = useState<Food | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Products saved by an older version (or a while ago) are refreshed when
  // opened from anywhere, not only when scanned, so their scores are current.
  useEffect(() => {
    if (!saved || !needsRefresh(saved) || navigator.onLine === false) return;
    let live = true;
    setRefreshing(true);
    void refreshInBackground(saved).finally(() => live && setRefreshing(false));
    return () => {
      live = false;
    };
    // Once per opened food.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id]);

  // Reset the form whenever a different food/entry is opened.
  useEffect(() => {
    if (!target || !food) return;
    setError(null);
    setShowTable(false);
    setMeal(target.mode === 'edit' ? target.entry.meal : initialMeal);
    const preset =
      target.mode === 'edit'
        ? presetPortion(options, target.entry.amount, target.entry.servingLabel)
        : target.mode === 'pick'
          ? presetPortion(options, target.amount, target.servingLabel)
          : 'id' in target.food
            ? presetPortion(options, target.food.lastAmount, target.food.lastServingLabel)
            : presetPortion(options);
    setOptionKey(preset.key);
    setQty(preset.qty);
    // Opening another food in the same sheet (e.g. a better choice) starts at the top.
    bodyRef.current?.parentElement?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target || !food) return null;

  // In add/pick mode, show the saved food live, so fixes made from here show up straight away.
  const current = target.mode !== 'edit' && saved ? saved : food;
  const option = options.find((o) => o.key === optionKey) ?? options[0];
  const amount = qty !== undefined && qty > 0 ? qty * option.amount : 0;
  const values = nutrientsFor(current, amount);
  const valid = amount >= LIMITS.amount.min && amount <= LIMITS.amount.max;
  const label = servingText(option, qty ?? 0, food.unit);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (target.mode === 'pick') {
        target.onPick(amount, label);
        return;
      }
      if (target.mode === 'edit') {
        await updateDiaryEntry(target.entry.id, { amount, meal, servingLabel: label });
      } else {
        const stored: Food = 'id' in target.food ? target.food : await saveOffFood(target.food, { scanned: target.scanned });
        await addDiaryEntry({ date, meal, food: stored, foodId: stored.id, amount, servingLabel: label });
      }
      sfx.tick();
      if (onDone) onDone(meal);
      else onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (target.mode !== 'edit') return;
    await deleteDiaryEntry(target.entry.id);
    onClose();
  };

  const isOff = target.mode === 'edit' ? !!food.barcode : target.food.source === 'off';
  const issues = target.mode === 'edit' ? [] : qualityIssues(current);


  return (
    <>
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-start gap-3">
          <FoodAvatar name={food.name} imageUrl={food.imageUrl} size={52} />
          <span className="min-w-0">
            <span className="block text-lg leading-tight">{food.name}</span>
            {food.brand && <span className="mt-0.5 block font-sans text-sm font-normal text-muted">{food.brand}</span>}
          </span>
        </span>
      }
      footer={
        <div className="space-y-2">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            {target.mode === 'edit' && (
              <Button variant="secondary" onClick={remove} aria-label="Delete entry" className="!px-3 text-danger">
                <Trash2 size={18} />
              </Button>
            )}
            <Button variant="primary" block onClick={submit} disabled={!valid || busy}>
              {target.mode === 'edit' ? 'Save changes' : target.mode === 'pick' ? 'Use this portion' : `Add to ${MEAL_LABELS[meal]}`}
              {values.energy !== undefined && valid && <span className="opacity-80">· {Math.round(values.energy)} kcal</span>}
            </Button>
          </div>
        </div>
      }
    >
      <div ref={bodyRef} className="space-y-4 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {isOff ? (
            <Chip color="var(--primary)">Open Food Facts</Chip>
          ) : target.mode === 'add' && target.food.source === 'generic' ? (
            <Chip color="var(--success)">Everyday food · typical values</Chip>
          ) : (
            <Chip color="var(--violet)">Custom food</Chip>
          )}
          {food.barcode && <span className="text-xs text-faint tabular">{food.barcode}</span>}
          <span className="flex-1" />
          {saved && (
            <IconButton label="Edit food" onClick={() => navigate(`/food/custom?id=${saved.id}`)}>
              <Pencil size={18} />
            </IconButton>
          )}
          {saved && (
            <IconButton label={saved.favorite ? 'Remove from favourites' : 'Add to favourites'} onClick={() => void toggleFavorite(saved.id)}>
              <Heart size={20} className={saved.favorite ? 'fill-danger text-danger' : ''} />
            </IconButton>
          )}
        </div>

        {target.mode !== 'edit' && current.quality && (current.quality.nutriScore || current.quality.nova) && <QualityBadges quality={current.quality} />}

        {target.mode !== 'edit' && (
          <HealthCard
            food={current}
            onOpenFood={target.mode === 'add' ? onOpenFood : undefined}
            onAddIngredients={saved ? () => setIngredientsFor(saved) : undefined}
            refreshing={refreshing}
          />
        )}

        {issues.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-orange/40 bg-orange/10 p-3 text-sm">
            {issues.map((i) => (
              <p key={i.text} className="flex gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange" />
                <span>{i.text}</span>
              </p>
            ))}
            {saved && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/food/custom?id=${saved.id}`)}>
                  <Pencil size={14} /> Fix values from the pack
                </Button>
                {isOff && food.barcode && (
                  <a
                    href={`https://world.openfoodfacts.org/product/${food.barcode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-primary"
                  >
                    Improve it for everyone <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        {target.mode === 'edit' && food.per100.energy === undefined && (
          <div className="flex gap-2 rounded-2xl border border-orange/40 bg-orange/10 p-3 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange" />
            <p>This food has no calorie information, so it counts as 0 kcal. Edit the food to add the values from the pack.</p>
          </div>
        )}

        <div>
          <p className="hud-label mb-2">Portion</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  if (o.key === optionKey) return;
                  // Keep the same eaten amount when switching units where possible.
                  const next = o.raw ? round(amount || 100, 1) : 1;
                  setOptionKey(o.key);
                  setQty(next);
                }}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition',
                  o.key === optionKey ? 'border-primary bg-primary/12 text-text shadow-glow' : 'border-line bg-surface-3/50 text-muted',
                )}
              >
                {o.raw ? `Weight (${food.unit})` : o.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <NumberInput
              value={qty}
              onValue={setQty}
              suffix={option.raw ? food.unit : '×'}
              aria-label={option.raw ? `Amount in ${food.unit}` : 'Number of servings'}
            />
            <span className="text-sm text-muted tabular">= {round(amount)} {food.unit}</span>
          </div>
          {option.raw && (
            <div className="mt-2 flex gap-2">
              {[50, 100, 150, 200].map((g) => (
                <button key={g} type="button" onClick={() => setQty(g)} className="flex-1 rounded-lg bg-surface-3/60 py-1.5 text-xs font-semibold text-muted">
                  {g} {food.unit}
                </button>
              ))}
            </div>
          )}
        </div>

        {target.mode !== 'pick' && <div>
          <p className="hud-label mb-2">Meal</p>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setMeal(s)}
                className={cn(
                  'rounded-xl border py-2 text-xs font-semibold transition',
                  meal === s ? 'border-primary bg-primary/12 text-text' : 'border-line text-muted',
                )}
              >
                {MEAL_LABELS[s]}
              </button>
            ))}
          </div>
        </div>}

        <PortionSummary values={values} />

        <button type="button" onClick={() => setShowTable((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-primary">
          Full nutrition (per 100 {food.unit} and per portion)
          <ChevronDown size={18} className={cn('transition-transform', showTable && 'rotate-180')} />
        </button>
        {showTable && <NutritionTable per100={current.per100} portion={values} unit={food.unit} portionLabel={`${round(amount)} ${food.unit}`} />}
      </div>
    </Sheet>
    <IngredientsSheet key={ingredientsFor?.id ?? 'none'} food={ingredientsFor} onClose={() => setIngredientsFor(null)} />
    </>
  );
}

export type PortionTarget = Target;
