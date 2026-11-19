import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { addDiaryEntries } from '../../../db/actions';
import type { DateKey } from '../../../lib/dates';
import { amountLabel, nutrientsFor } from '../../../lib/food';
import { MEAL_LABELS, MEAL_SLOTS, type MealSlot } from '../../../lib/models';
import { cn } from '../../../lib/cn';
import { sfx } from '../../../lib/sound';
import { Sheet } from '../../../components/ui/Sheet';
import { Button, IconButton } from '../../../components/ui/Button';
import { FoodAvatar } from '../FoodAvatar';
import { PortionSheet, type PortionTarget } from '../PortionSheet';
import { mealTray, trayKcal, useMealTray } from './mealTray';

interface Props {
  open: boolean;
  meal: MealSlot;
  date: DateKey;
  onClose: () => void;
  /** Called after the whole tray is logged, with the meal it went to and how many items. */
  onLogged: (meal: MealSlot, count: number) => void;
}

/** Review a whole-meal scan: adjust portions, pick the meal, log everything at once. */
export function MealTraySheet({ open, meal: initialMeal, date, onClose, onLogged }: Props) {
  const items = useMealTray();
  const [meal, setMeal] = useState<MealSlot>(initialMeal);
  const [editing, setEditing] = useState<PortionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kcal = trayKcal(items);

  const logAll = async () => {
    setBusy(true);
    setError(null);
    try {
      await addDiaryEntries(items.map((i) => ({ date, meal, food: i.food, foodId: i.food.id, amount: i.amount, servingLabel: i.servingLabel })));
      sfx.tick();
      mealTray.clear();
      onLogged(meal, items.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open && !editing}
        onClose={onClose}
        title="Your meal"
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'} · ${Math.round(kcal)} kcal` : 'Nothing scanned yet'}
        footer={
          items.length > 0 && (
            <div className="space-y-2">
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 text-danger" aria-label="Clear the tray" onClick={() => mealTray.clear()}>
                  <Trash2 size={18} />
                </Button>
                <Button variant="primary" block disabled={busy} onClick={() => void logAll()}>
                  Log {items.length} to {MEAL_LABELS[meal]} <span className="opacity-80">· {Math.round(kcal)} kcal</span>
                </Button>
              </div>
            </div>
          )
        }
      >
        {items.length === 0 ? (
          <p className="py-4 text-muted">Scan each product in your meal. They gather here so you can log the whole plate in one go.</p>
        ) : (
          <div className="space-y-4 pt-1">
            <ul className="divide-y divide-line">
              {items.map((i) => {
                const e = nutrientsFor(i.food, i.amount).energy;
                return (
                  <li key={i.key} className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() =>
                        setEditing({
                          mode: 'pick',
                          food: i.food,
                          amount: i.amount,
                          servingLabel: i.servingLabel,
                          onPick: (amount, servingLabel) => {
                            mealTray.update(i.key, { amount, servingLabel });
                            setEditing(null);
                          },
                        })
                      }
                    >
                      <FoodAvatar name={i.food.name} imageUrl={i.food.imageUrl} size={42} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{i.food.name}</span>
                        <span className="block truncate text-xs text-primary">{amountLabel(i.amount, i.food.unit, i.servingLabel)} · change</span>
                      </span>
                      <span className="tabular text-sm font-semibold">{e === undefined ? '—' : Math.round(e)}</span>
                    </button>
                    <IconButton label={`Remove ${i.food.name}`} onClick={() => mealTray.remove(i.key)}>
                      <X size={18} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="hud-label mb-2">Meal</p>
              <div className="grid grid-cols-4 gap-1.5">
                {MEAL_SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMeal(s)}
                    className={cn('rounded-xl border py-2.5 text-xs font-semibold transition', meal === s ? 'border-primary bg-primary/12 text-text' : 'border-line text-muted')}
                  >
                    {MEAL_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
      <PortionSheet target={editing} date={date} meal={meal} onClose={() => setEditing(null)} />
    </>
  );
}
