import { useState } from 'react';
import { AlertTriangle, Calculator, RotateCcw } from 'lucide-react';
import { resetTargetsToSuggested, updateMicroTarget, updateTargets } from '../../db/actions';
import { useProfile } from '../../hooks/useData';
import { MINERAL_KEYS, NUTRIENTS, VITAMIN_KEYS, type NutrientKey } from '../../lib/nutrients';
import { REFERENCE_SOURCE } from '../../lib/references';
import { ACTIVITY_LEVELS, CALORIE_FLOOR, bmrMifflin, isBelowCalorieFloor, suggestTargets, tdee, type Targets } from '../../lib/targets';
import type { Profile } from '../../lib/models';
import { LIMITS } from '../../lib/limits';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { Chip, PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/Field';

const FIELDS: { key: keyof Targets; label: string; unit: string; hint?: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fibre', unit: 'g', hint: 'goal' },
  { key: 'sugar', label: 'Sugar', unit: 'g', hint: 'limit' },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', hint: 'limit' },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

export default function TargetsPage() {
  const profile = useProfile();
  const [saved, setSaved] = useState(false);
  // Re-key only when the macro targets change (not on every micronutrient edit),
  // so typing in the micronutrient fields never loses focus.
  return profile.createdAt ? <TargetsForm key={JSON.stringify(profile.targets)} profile={profile} saved={saved} setSaved={setSaved} /> : null;
}

function TargetsForm({ profile, saved, setSaved }: { profile: Profile; saved: boolean; setSaved: (v: boolean) => void }) {
  const [t, setT] = useState<Partial<Targets>>(profile.targets);
  const suggested = suggestTargets(profile);
  const bmr = Math.round(bmrMifflin(profile));
  const maintenance = Math.round(tdee(profile));
  const macroKcal = (t.protein ?? 0) * 4 + (t.carbs ?? 0) * 4 + (t.fat ?? 0) * 9;
  const mismatch = t.calories ? Math.abs(macroKcal - t.calories) / t.calories > 0.08 : false;
  const belowFloor = t.calories !== undefined && isBelowCalorieFloor(t.calories, profile.sex);
  const complete = FIELDS.every((f) => t[f.key] !== undefined && t[f.key]! >= 0);
  const rangeFor = (k: keyof Targets) => (k === 'calories' ? LIMITS.calories : k === 'waterMl' ? LIMITS.waterGoalMl : LIMITS.targetGrams);
  const bad = FIELDS.find((f) => t[f.key] !== undefined && (t[f.key]! < rangeFor(f.key).min || t[f.key]! > rangeFor(f.key).max));
  const outOfRange = bad
    ? `${bad.label} must be between ${rangeFor(bad.key).min.toLocaleString()} and ${rangeFor(bad.key).max.toLocaleString()} ${bad.unit}.`
    : '';

  return (
    <Page>
      <PageHeader back kicker="Loadout" title="Goals & targets" />
      <div className="space-y-4">
        <Card hud>
          <div className="mb-2 flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <h2 className="font-hud text-lg font-bold">Your estimate</h2>
            <Chip color="var(--primary)">Estimate</Chip>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-3/50 py-2">
              <dt className="hud-label !text-[9px]">Resting (BMR)</dt>
              <dd className="font-hud tabular text-lg font-bold">{bmr.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-surface-3/50 py-2">
              <dt className="hud-label !text-[9px]">Maintenance</dt>
              <dd className="font-hud tabular text-lg font-bold">{maintenance.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-surface-3/50 py-2">
              <dt className="hud-label !text-[9px]">Suggested</dt>
              <dd className="font-hud tabular text-gradient-gold text-lg font-bold">{suggested.calories.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Mifflin-St Jeor resting energy × {ACTIVITY_LEVELS[profile.activity].factor} ({ACTIVITY_LEVELS[profile.activity].label.toLowerCase()}). Protein{' '}
            {(suggested.protein / profile.weightKg).toFixed(1)} g/kg, fat 30% of calories, carbs make up the rest. Weight-loss targets use at most a 500 kcal
            (20%) deficit and never go below {CALORIE_FLOOR[profile.sex]} kcal. These are estimates, not medical advice.
          </p>
          {profile.customTargets && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await resetTargetsToSuggested();
                setSaved(false);
              }}
            >
              <RotateCcw size={16} /> Reset to suggested
            </Button>
          )}
        </Card>

        <Card>
          <SectionTitle>Daily targets {profile.customTargets && <span className="ml-1 normal-case tracking-normal text-faint">(custom)</span>}</SectionTitle>
          <div className="space-y-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                <span className="text-sm font-medium">
                  {f.label}
                  {f.hint && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{f.hint}</span>}
                  <span className="block text-xs font-normal text-faint">Suggested {suggested[f.key].toLocaleString()}</span>
                </span>
                <NumberInput
                  value={t[f.key]}
                  decimals={false}
                  onValue={(v) => {
                    setSaved(false);
                    setT((p) => ({ ...p, [f.key]: v }));
                  }}
                  suffix={f.unit}
                  aria-label={f.label}
                  className="!h-11"
                />
              </div>
            ))}
          </div>
          {mismatch && (
            <p className="mt-3 flex gap-2 text-xs text-orange">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Your macros add up to {Math.round(macroKcal).toLocaleString()} kcal, which doesn&apos;t match your calorie target.
            </p>
          )}
          {belowFloor && (
            <p className="mt-2 flex gap-2 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> This is below {CALORIE_FLOOR[profile.sex]} kcal. Very low intakes can be harmful without medical supervision. NutriTrack will never reward eating far below your target.
            </p>
          )}
          {outOfRange && (
            <p role="alert" className="mt-2 flex gap-2 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {outOfRange}
            </p>
          )}
          <Button
            variant="primary"
            block
            className="mt-4"
            disabled={!complete || !!outOfRange}
            onClick={async () => {
              await updateTargets(t as Targets);
              setSaved(true);
            }}
          >
            {saved ? 'Saved' : 'Save targets'}
          </Button>
        </Card>

        <MicroTargets profile={profile} keys={VITAMIN_KEYS} title="Vitamin targets" />
        <MicroTargets profile={profile} keys={MINERAL_KEYS} title="Mineral targets" />
        <p className="px-1 text-xs text-faint">{REFERENCE_SOURCE}</p>
      </div>
    </Page>
  );
}

function MicroTargets({ profile, keys, title }: { profile: Profile; keys: NutrientKey[]; title: string }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[1fr_8.5rem] items-center gap-3">
            <span className="text-sm">
              <span className="font-medium">{NUTRIENTS[k].label}</span>
              {NUTRIENTS[k].kind === 'limit' && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">limit</span>}
              {NUTRIENTS[k].alias && <span className="block text-xs text-faint">{NUTRIENTS[k].alias}</span>}
            </span>
            <NumberInput
              value={profile.microTargets[k]}
              onValue={(v) => v !== undefined && v >= 0 && void updateMicroTarget(k, v)}
              suffix={NUTRIENTS[k].unit}
              aria-label={`${NUTRIENTS[k].label} target`}
              className="!h-10"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
