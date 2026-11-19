import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Globe, Heart, PackageSearch, Loader2, PenLine, ScanBarcode, Search, Trash2, UtensilsCrossed, WifiOff, X } from 'lucide-react';
import { db } from '../../db/db';
import { addSavedMealToDiary, deleteSavedMeal } from '../../db/actions';
import { useToday } from '../../hooks/useToday';
import { useGoBack } from '../../hooks/useGoBack';
import { defaultPortionKcal, isMealSlot, mealForTime } from '../../lib/food';
import { MEAL_LABELS, MEAL_SLOTS, type Food, type MealSlot, type SavedMeal } from '../../lib/models';
import { OffError, isPlausibleBarcode, lookupBarcode, normaliseBarcode, searchProducts } from '../../lib/openFoodFacts';
import { GENERIC_FOODS } from '../../data/genericFoods';
import { correctQuery, rankFoods, vocabularyOf } from '../../lib/foodSearch';
import { cn } from '../../lib/cn';
import { Page } from '../../components/layout/Page';
import { PageHeader, EmptyState } from '../../components/ui/Misc';
import { Button, IconButton } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { FoodAvatar } from './FoodAvatar';
import { PortionSheet, type PortionTarget } from './PortionSheet';
import { takePendingFood } from './pendingFood';

type Tab = 'recent' | 'favourites' | 'mine' | 'meals';
type NewFood = Omit<Food, 'id'>;

export function useMealParam(): MealSlot {
  const [params] = useSearchParams();
  const m = params.get('meal');
  return isMealSlot(m) ? m : mealForTime();
}

export default function AddFoodPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const date = params.get('date') ?? today;
  const initialMeal = useMealParam();
  const [meal, setMeal] = useState<MealSlot>(initialMeal);
  const [tab, setTab] = useState<Tab>('recent');
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<NewFood[] | null>(null);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [remoteError, setRemoteError] = useState<string>('');
  const [target, setTarget] = useState<PortionTarget | null>(null);
  const [mealDetail, setMealDetail] = useState<SavedMeal | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const meals = useLiveQuery(() => db.meals.toArray(), []);

  // Open a specific food straight away (e.g. after creating a custom food).
  useEffect(() => {
    const id = takePendingFood();
    if (id) void db.foods.get(id).then((f) => f && setTarget({ mode: 'add', food: f }));
  }, []);
  const openId = params.get('food');
  useEffect(() => {
    if (!openId) return;
    void db.foods.get(openId).then((f) => {
      if (f) setTarget({ mode: 'add', food: f });
      const next = new URLSearchParams(params);
      next.delete('food');
      setParams(next, { replace: true });
    });
  }, [openId, params, setParams]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Everyday foods that ship with the app, minus any the player already saved (those are in `foods`).
  const bundled = useMemo(() => {
    const saved = new Set((foods ?? []).filter((f) => f.source === 'generic').map((f) => f.name.toLowerCase()));
    return GENERIC_FOODS.filter((g) => !saved.has(g.name.toLowerCase()));
  }, [foods]);

  const local = useMemo(() => {
    if (!foods) return [];
    if (query) return rankFoods(query, [...foods, ...bundled], 30);
    const list = foods;
    if (tab === 'recent') return list.filter((f) => f.lastUsedAt).sort((a, b) => b.lastUsedAt! - a.lastUsedAt!).slice(0, 40);
    if (tab === 'favourites') return list.filter((f) => f.favorite).sort((a, b) => a.name.localeCompare(b.name));
    if (tab === 'mine') return list.filter((f) => f.source === 'custom').sort((a, b) => a.name.localeCompare(b.name));
    return [];
  }, [foods, bundled, query, tab]);

  const vocabulary = useMemo(() => vocabularyOf(GENERIC_FOODS), []);
  const corrected = useMemo(() => (query.trim().length >= 4 ? correctQuery(query, vocabulary) : null), [query, vocabulary]);

  // Products already saved on this device are listed above; don't show them twice.
  const remoteShown = useMemo(() => {
    if (!remote) return null;
    const localBarcodes = new Set(local.map((f) => f.barcode).filter(Boolean));
    const fresh = remote.filter((f) => !f.barcode || !localBarcodes.has(f.barcode));
    return rankFoods(corrected ?? query, fresh, 40);
  }, [remote, local, query, corrected]);

  const runRemote = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRemoteState('loading');
    setRemote(null);
    try {
      // A typed barcode goes straight to that product.
      const code = normaliseBarcode(q);
      if (code && isPlausibleBarcode(code)) {
        const found = await lookupBarcode(code, ctrl.signal);
        setRemote(found ? [found] : []);
      } else {
        setRemote(await searchProducts(corrected ?? q, ctrl.signal));
      }
      setRemoteState('idle');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setRemoteError(e instanceof OffError ? e.message : 'Search failed. Try again.');
      setRemoteState('error');
    }
  };

  const ctx = `meal=${meal}&date=${date}`;
  // Bundled foods carry search-only words; they must not be saved with the food.
  const pick = (f: Food | NewFood) => {
    if ('aliases' in f) {
      const { aliases: _aliases, ...food } = f as NewFood & { aliases?: string };
      setTarget({ mode: 'add', food });
    } else setTarget({ mode: 'add', food: f });
  };
  const trimmed = query.trim();
  const searched = remote !== null || remoteState === 'error';
  const nothingFound = trimmed.length >= 2 && local.length === 0 && (remoteShown?.length ?? 0) === 0 && searched;
  const customHref = `/food/custom?${ctx}&name=${encodeURIComponent(trimmed)}`;

  return (
    <Page>
      <PageHeader back kicker={`Add to ${MEAL_LABELS[meal]}`} title="Find food" />

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {MEAL_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setMeal(s)}
            className={cn('rounded-xl border py-2 text-xs font-semibold transition', meal === s ? 'border-primary bg-primary/12 text-text' : 'border-line text-muted')}
          >
            {MEAL_LABELS[s]}
          </button>
        ))}
      </div>

      <form
        className="relative mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          void runRemote();
        }}
      >
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRemote(null);
            setRemoteState('idle');
          }}
          placeholder="Search foods, brands or barcodes"
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-11 text-[16px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
          aria-label="Search foods"
        />
        {query && (
          <IconButton label="Clear search" className="absolute right-1 top-1" onClick={() => setQuery('')}>
            <X size={18} />
          </IconButton>
        )}
      </form>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => navigate(`/food/scan?${ctx}`)}>
          <ScanBarcode size={18} /> Scan barcode
        </Button>
        <Button onClick={() => navigate(`/food/custom?${ctx}`)}>
          <PenLine size={18} /> Custom food
        </Button>
      </div>

      {!query && (
        <Segmented
          className="mb-3"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'favourites', label: 'Favourites' },
            { value: 'mine', label: 'My foods' },
            { value: 'meals', label: 'Meals' },
          ]}
        />
      )}

      {query && corrected && (
        <p className="mb-2 text-sm text-muted">
          Showing results for <span className="font-semibold text-text">{corrected}</span>
        </p>
      )}
      {query && !nothingFound && (
        <p className="hud-label mb-2">Everyday and saved foods</p>
      )}

      {tab === 'meals' && !query ? (
        <MealList meals={meals ?? []} onOpen={setMealDetail} />
      ) : (
        <FoodList
          foods={local}
          onPick={pick}
          empty={
            query ? (
              nothingFound ? null : <p className="py-3 text-sm text-muted">No saved or everyday foods match “{query}”.</p>
            ) : (
              <EmptyState icon={tab === 'favourites' ? <Heart size={26} /> : <UtensilsCrossed size={26} />} title={EMPTY[tab].title}>
                {EMPTY[tab].text}
              </EmptyState>
            )
          }
        />
      )}

      {query && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            {!nothingFound && <p className="hud-label">Open Food Facts</p>}
            {remoteState !== 'loading' && remote === null && (
              <Button size="sm" variant="secondary" onClick={() => void runRemote()} disabled={query.trim().length < 2}>
                <Globe size={16} /> Search online
              </Button>
            )}
          </div>
          {remoteState === 'loading' && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted">
              <Loader2 size={18} className="animate-spin text-primary" /> Searching the open food database…
            </p>
          )}
          {remoteState === 'error' && (
            <p className="flex items-center gap-2 py-3 text-sm text-orange">
              <WifiOff size={18} /> {remoteError}
            </p>
          )}
          {remoteShown && (
            <FoodList
              foods={remoteShown}
              onPick={pick}
              empty={
                nothingFound ? null : <p className="py-3 text-sm text-muted">
                  {remote && remote.length > 0 ? 'Every match is already saved on this device (listed above).' : 'No products found. Try fewer words, or create a custom food.'}
                </p>
              }
            />
          )}
          {remote === null && remoteState === 'idle' && (
            <p className="text-xs text-faint">Only your search words are sent to Open Food Facts. Press search on the keyboard to look online.</p>
          )}
        </div>
      )}

      {trimmed.length >= 2 && (searched || local.length > 0) && (
        <button
          type="button"
          onClick={() => navigate(customHref)}
          className={cn(
            'mt-5 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]',
            nothingFound ? 'border-primary/50 bg-primary/10' : 'border-line bg-surface',
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            {nothingFound ? <PackageSearch size={20} /> : <PenLine size={20} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{nothingFound ? `Nothing found for “${trimmed}”` : 'Not the one you wanted?'}</span>
            <span className="block truncate text-sm text-muted">Add “{trimmed}” as a custom food</span>
          </span>
        </button>
      )}

      <PortionSheet
        target={target}
        date={date}
        meal={meal}
        onClose={() => setTarget(null)}
        onDone={() => goBack('/food')}
        onOpenFood={(f) => setTarget({ mode: 'add', food: f })}
      />
      <SavedMealSheet
        meal={mealDetail}
        slot={meal}
        onClose={() => setMealDetail(null)}
        onAdd={async (m) => {
          await addSavedMealToDiary(m.id, date, meal);
          setMealDetail(null);
          goBack('/food');
        }}
      />
    </Page>
  );
}

const EMPTY: Record<Tab, { title: string; text: string }> = {
  recent: { title: 'No recent foods yet', text: 'Foods you log will appear here for quick re-use.' },
  favourites: { title: 'No favourites yet', text: 'Tap the heart on any food to pin it here.' },
  mine: { title: 'No custom foods', text: 'Create foods for home cooking or anything without a barcode.' },
  meals: { title: 'No saved meals', text: 'Save a whole meal from the diary using its ⋯ menu.' },
};

function FoodList({ foods, onPick, empty }: { foods: (Food | NewFood)[]; onPick: (f: Food | NewFood) => void; empty: ReactNode }) {
  if (foods.length === 0) return <>{empty}</>;
  return (
    <ul className="panel divide-y divide-line overflow-hidden">
      {foods.map((f, i) => {
        const { kcal, label } = defaultPortionKcal(f);
        return (
          <li key={'id' in f ? f.id : `${f.barcode}-${i}`}>
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-surface-3/60">
              <FoodAvatar name={f.name} imageUrl={f.imageUrl} size={42} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{f.name}</span>
                  {'favorite' in f && f.favorite && <Heart size={12} className="shrink-0 fill-danger text-danger" />}
                </span>
                <span className="block truncate text-xs text-muted">
                  {f.brand ? `${f.brand} · ` : ''}
                  {label}
                </span>
              </span>
              <span className="text-right">
                <span className="block tabular text-sm font-semibold">{kcal === undefined ? '—' : Math.round(kcal)}</span>
                <span className="block text-[10px] uppercase tracking-wider text-faint">kcal</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function mealKcal(m: SavedMeal): number {
  return m.items.reduce((s, it) => s + ((it.food.per100.energy ?? 0) * it.amount) / 100, 0);
}

function MealList({ meals, onOpen }: { meals: SavedMeal[]; onOpen: (m: SavedMeal) => void }) {
  if (meals.length === 0) {
    return (
      <EmptyState icon={<UtensilsCrossed size={26} />} title={EMPTY.meals.title}>
        {EMPTY.meals.text}
      </EmptyState>
    );
  }
  return (
    <ul className="panel divide-y divide-line overflow-hidden">
      {[...meals]
        .sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))
        .map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onOpen(m)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-surface-3/60">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet">
                <UtensilsCrossed size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-muted">
                  {m.items.length} item{m.items.length === 1 ? '' : 's'}
                </span>
              </span>
              <span className="tabular text-sm font-semibold">{Math.round(mealKcal(m))} kcal</span>
            </button>
          </li>
        ))}
    </ul>
  );
}

function SavedMealSheet({ meal, slot, onClose, onAdd }: { meal: SavedMeal | null; slot: MealSlot; onClose: () => void; onAdd: (m: SavedMeal) => void }) {
  if (!meal) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={meal.name}
      subtitle={`${Math.round(mealKcal(meal))} kcal · ${meal.items.length} ${meal.items.length === 1 ? 'item' : 'items'}`}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="!px-3 text-danger"
            aria-label="Delete saved meal"
            onClick={async () => {
              await deleteSavedMeal(meal.id);
              onClose();
            }}
          >
            <Trash2 size={18} />
          </Button>
          <Button variant="primary" block onClick={() => onAdd(meal)}>
            Add all to {MEAL_LABELS[slot]}
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-line">
        {meal.items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <FoodAvatar name={it.food.name} imageUrl={it.food.imageUrl} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{it.food.name}</span>
              <span className="block truncate text-xs text-muted">{it.servingLabel ?? `${Math.round(it.amount)} ${it.food.unit}`}</span>
            </span>
            <span className="tabular text-sm">{it.food.per100.energy === undefined ? '—' : Math.round((it.food.per100.energy * it.amount) / 100)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
