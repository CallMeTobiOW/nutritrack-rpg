import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ChevronDown, Info, Loader2, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import { deleteFood, saveCustomFood } from '../../db/actions';
import { MICRO_KEYS, NUTRIENTS, type NutrientKey, type NutrientValues } from '../../lib/nutrients';
import type { MeasureUnit } from '../../lib/nutrition';
import { cn } from '../../lib/cn';
import { Page } from '../../components/layout/Page';
import { PageHeader } from '../../components/ui/Misc';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Label, NumberInput, TextInput } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { setPendingFood } from './pendingFood';
import { per100Problem } from '../../lib/food';
import { readTextFromImage } from '../../lib/scan/ocr';
import { parseNutritionLabel } from '../../lib/scan/nutritionLabel';
import { useGoBack } from '../../hooks/useGoBack';

type Basis = '100' | 'serving';
type Values = Partial<Record<NutrientKey | 'salt', number>>;

const MAIN_FIELDS: { key: NutrientKey | 'salt'; label: string; unit: string }[] = [
  { key: 'energy', label: 'Energy', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrate', unit: 'g' },
  { key: 'sugar', label: 'of which sugars', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'satFat', label: 'of which saturates', unit: 'g' },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'salt', label: 'Salt', unit: 'g' },
];

/** Salt on UK/EU labels = sodium × 2.5. We store sodium in mg. */
const saltToSodiumMg = (g: number) => g * 400;
const sodiumMgToSalt = (mg: number) => Math.round((mg / 400) * 100) / 100;

export default function CustomFoodPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const meal = params.get('meal');
  const date = params.get('date');
  // The scanner replaces itself with this page; the add screen pushes it.
  const cameFromAdd = !params.get('barcode');

  const [name, setName] = useState(params.get('name') ?? '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.get('barcode') ?? '');
  const [unit, setUnit] = useState<MeasureUnit>('g');
  const [basis, setBasis] = useState<Basis>('100');
  const [servingLabel, setServingLabel] = useState('');
  const [servingAmount, setServingAmount] = useState<number | undefined>();
  const [values, setValues] = useState<Values>({});
  const [showMicros, setShowMicros] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!editId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const goBack = useGoBack();
  const [label, setLabel] = useState<{ state: 'idle' } | { state: 'reading'; progress: number } | { state: 'error'; message: string } | { state: 'done'; warnings: string[] }>({ state: 'idle' });

  /** Read the photographed table into the form. The player still checks and saves; nothing is saved from here. */
  const onLabelPhoto = async (file: File | undefined) => {
    if (!file) return;
    setLabel({ state: 'reading', progress: 0 });
    try {
      const text = await readTextFromImage(file, (p) => setLabel({ state: 'reading', progress: p }));
      const r = parseNutritionLabel(text);
      if (!r) {
        setLabel({ state: 'error', message: 'No nutrition table found. Fill the table in the photo, with good light and no glare, or type the values below.' });
        return;
      }
      setValues(r.values);
      setUnit(r.unit);
      setBasis(r.basis);
      if (r.servingAmount) {
        setServingAmount(r.servingAmount);
        setServingLabel(r.servingLabel ?? '');
      }
      const warnings = [...r.warnings];
      if (r.basis === 'serving' && !r.servingAmount) warnings.push('These values are per serving. Enter the serving size in grams or ml.');
      setLabel({ state: 'done', warnings });
    } catch {
      setLabel({
        state: 'error',
        message: navigator.onLine === false ? 'The text reader needs a connection the first time. You can type the values instead.' : 'Couldn’t read the photo. Try again, or type the values.',
      });
    }
  };

  useEffect(() => {
    if (!editId) return;
    void db.foods.get(editId).then((f) => {
      if (!f) return;
      setName(f.name);
      setBrand(f.brand ?? '');
      setBarcode(f.barcode ?? '');
      setUnit(f.unit);
      const v: Values = { ...f.per100 };
      if (f.per100.sodium !== undefined) v.salt = sodiumMgToSalt(f.per100.sodium);
      delete v.sodium;
      setValues(v);
      if (f.servings[0]) {
        setServingLabel(f.servings[0].label);
        setServingAmount(f.servings[0].amount);
      }
      setShowMicros(MICRO_KEYS.some((k) => k !== 'sodium' && f.per100[k] !== undefined));
      setLoaded(true);
    });
  }, [editId]);

  const set = (k: NutrientKey | 'salt', v: number | undefined) => setValues((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setError('');
    if (!name.trim()) return setError('Give the food a name.');
    if (values.energy === undefined) return setError('Energy (kcal) is required so it can count towards your calories.');
    if (basis === 'serving' && !(servingAmount && servingAmount > 0)) return setError('Enter the serving size in grams/ml.');
    for (const [k, v] of Object.entries(values) as [NutrientKey | 'salt', number | undefined][]) {
      if (v !== undefined && (v < 0 || !Number.isFinite(v))) return setError(`${k === 'salt' ? 'Salt' : NUTRIENTS[k].label} cannot be negative.`);
    }
    const factor = basis === 'serving' ? 100 / servingAmount! : 1;
    const per100: NutrientValues = {};
    for (const [k, v] of Object.entries(values) as [NutrientKey | 'salt', number | undefined][]) {
      if (v === undefined) continue; // blank = unknown, never zero
      if (k === 'salt') per100.sodium = saltToSodiumMg(v) * factor;
      else per100[k] = v * factor;
    }
    const problem = per100Problem(per100, unit);
    if (problem) return setError(problem);

    const servings = servingAmount && servingAmount > 0 ? [{ label: servingLabel.trim() || `1 serving (${servingAmount} ${unit})`, amount: servingAmount }] : [];
    const food = await saveCustomFood({ name, brand, barcode, unit, per100, servings }, editId ?? undefined);
    if (meal && date && !editId) {
      if (cameFromAdd) {
        setPendingFood(food.id);
        goBack(`/food/add?meal=${meal}&date=${date}&food=${food.id}`);
      } else {
        navigate(`/food/add?meal=${meal}&date=${date}&food=${food.id}`, { replace: true });
      }
    } else goBack('/food');
  };

  if (!loaded) return <Page>{null}</Page>;

  return (
    <Page>
      <PageHeader back kicker="Forge a new item" title={editId ? 'Edit food' : 'Custom food'} />
      <div className="space-y-4">
        {!editId && (
          <Card className="space-y-3">
            <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#0369a1] to-[#2563eb] font-semibold text-white">
              <Camera size={18} /> Photograph the nutrition label
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void onLabelPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {label.state === 'reading' && (
              <p className="flex items-center gap-2 text-sm text-muted" role="status">
                <Loader2 size={16} className="animate-spin text-primary" />
                Reading the label{label.progress > 0 ? ` · ${Math.round(label.progress * 100)}%` : '…'}
              </p>
            )}
            {label.state === 'error' && <p className="text-sm text-orange">{label.message}</p>}
            {label.state === 'done' && (
              <div className="space-y-1 text-sm" role="status">
                <p className="font-semibold">Label read. Check every number against the pack before saving.</p>
                {label.warnings.map((w) => (
                  <p key={w} className="text-orange">{w}</p>
                ))}
              </div>
            )}
            <p className="text-xs text-faint">Read on your phone, never uploaded. Fill in the name below, then save.</p>
          </Card>
        )}
        <Card className="space-y-4">
          <div>
            <Label htmlFor="cf-name">Name</Label>
            <TextInput id="cf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Homemade chilli" maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cf-brand" hint="Optional">Brand</Label>
              <TextInput id="cf-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cf-barcode" hint="Optional">Barcode</Label>
              <TextInput id="cf-barcode" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <div>
            <Label>Measured in</Label>
            <Segmented value={unit} onChange={setUnit} options={[{ value: 'g', label: 'Grams (g)' }, { value: 'ml', label: 'Millilitres (ml)' }]} />
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div>
              <Label htmlFor="cf-serving" hint="Optional">Serving name</Label>
              <TextInput id="cf-serving" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 bowl" />
            </div>
            <div>
              <Label htmlFor="cf-serving-amt">Size</Label>
              <NumberInput id="cf-serving-amt" value={servingAmount} onValue={setServingAmount} suffix={unit} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="hud-label">Nutrition values</h2>
            <Segmented
              size="sm"
              className="w-48"
              value={basis}
              onChange={setBasis}
              options={[
                { value: '100', label: `Per 100 ${unit}` },
                { value: 'serving', label: 'Per serving' },
              ]}
            />
          </div>
          <p className="mb-3 flex gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" />
            Copy the values from the label. Leave a box empty if it isn&apos;t listed: empty means unknown, not zero.
          </p>
          <div className="space-y-2">
            {MAIN_FIELDS.map((f) => (
              <NutrientRow key={f.key} label={f.label} unit={f.unit} indent={f.label.startsWith('of which')} value={values[f.key]} onValue={(v) => set(f.key, v)} required={f.key === 'energy'} />
            ))}
          </div>

          <button type="button" onClick={() => setShowMicros((v) => !v)} className="mt-4 flex w-full items-center justify-between text-sm font-semibold text-primary">
            Vitamins &amp; minerals (optional)
            <ChevronDown size={18} className={cn('transition-transform', showMicros && 'rotate-180')} />
          </button>
          {showMicros && (
            <div className="mt-3 space-y-2">
              {MICRO_KEYS.filter((k) => k !== 'sodium').map((k) => (
                <NutrientRow key={k} label={NUTRIENTS[k].label} unit={NUTRIENTS[k].unit} value={values[k]} onValue={(v) => set(k, v)} />
              ))}
            </div>
          )}
        </Card>

        {error && <p className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          {editId && (
            <Button
              variant={confirmDelete ? 'danger' : 'secondary'}
              className={cn(!confirmDelete && '!px-4 text-danger')}
              aria-label="Delete food"
              onClick={async () => {
                // First tap arms the button; the second deletes.
                if (!confirmDelete) return setConfirmDelete(true);
                await deleteFood(editId);
                goBack('/food');
              }}
            >
              <Trash2 size={18} />
              {confirmDelete && 'Delete food'}
            </Button>
          )}
          <Button variant="primary" size="lg" block onClick={save}>
            {editId ? 'Save food' : meal ? 'Save and choose portion' : 'Save food'}
          </Button>
        </div>
        {editId && <p className="text-xs text-faint">Changes apply to future entries. Foods already in your diary keep the values they were logged with.</p>}
      </div>
    </Page>
  );
}

function NutrientRow({
  label,
  unit,
  value,
  onValue,
  indent,
  required,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  indent?: boolean;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_9rem] items-center gap-3">
      <span className={cn('text-sm', indent ? 'pl-4 text-muted' : 'font-medium')}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <NumberInput value={value} onValue={onValue} suffix={unit} aria-label={label} className="!h-10" />
    </div>
  );
}
