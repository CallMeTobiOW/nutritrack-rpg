import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronLeft, Upload } from 'lucide-react';
import { saveProfile, updateSettings } from '../../db/actions';
import { restoreBackup } from '../../db/backup';
import { useProfile, useSettings } from '../../hooks/useData';
import { LIMITS } from '../../lib/limits';
import { suggestTargets, type ActivityLevel, type Objective } from '../../lib/targets';
import type { Sex } from '../../lib/references';
import { formatVolume, formatWeight, type WeightUnit } from '../../lib/units';
import { AppEmblem } from '../../components/ui/AppEmblem';
import { Button, IconButton } from '../../components/ui/Button';
import { Label, NumberInput, TextInput } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { ActivityPicker, HeightField, ObjectivePicker, SexPicker, WeightField } from '../profile/ProfileFields';

const STEPS = ['welcome', 'name', 'body', 'activity', 'objective', 'summary'] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const profile = useProfile();
  const settings = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<Sex>(profile.sex);
  // Start blank on a fresh install so placeholder stats never become real targets.
  const fresh = !profile.onboarded && !profile.name;
  const [age, setAge] = useState<number | undefined>(fresh ? undefined : profile.age);
  const [heightCm, setHeightCm] = useState<number | undefined>(fresh ? undefined : profile.heightCm);
  const [weightKg, setWeightKg] = useState<number | undefined>(fresh ? undefined : profile.weightKg);
  const [goalKg, setGoalKg] = useState<number | undefined>(profile.goalWeightKg);
  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity);
  const [objective, setObjective] = useState<Objective>(profile.objective);
  const [saving, setSaving] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const idx = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
  const back = () => setStep(STEPS[Math.max(0, idx - 1)]);

  const bodyValid =
    age !== undefined && age >= LIMITS.age.min && age <= LIMITS.age.max &&
    heightCm !== undefined && heightCm >= LIMITS.heightCm.min && heightCm <= LIMITS.heightCm.max &&
    weightKg !== undefined && weightKg >= LIMITS.weightKg.min && weightKg <= LIMITS.weightKg.max &&
    (goalKg === undefined || (goalKg >= LIMITS.weightKg.min && goalKg <= LIMITS.weightKg.max));

  const preview = bodyValid ? suggestTargets({ sex, age: age!, heightCm: heightCm!, weightKg: weightKg!, activity, objective }) : null;

  const finish = async () => {
    if (!bodyValid) return;
    setSaving(true);
    await updateSettings({ weightUnit: unit });
    await saveProfile({ name, sex, age, heightCm, weightKg, goalWeightKg: goalKg, activity, objective }, { onboard: true });
  };

  const skip = async () => {
    await saveProfile({ name: name || '' }, { onboard: true });
  };

  const onRestore = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setRestoreMsg('That file could not be read as a backup. Pick the .json file NutriTrack saved.');
    }
    try {
      const summary = await restoreBackup(raw);
      setRestoreMsg(`Restored ${Object.values(summary.counts).reduce((a, b) => a + (b ?? 0), 0)} records.`);
    } catch (e) {
      setRestoreMsg((e as Error).message || 'Could not read that file.');
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      {step !== 'welcome' && (
        <div className="flex items-center gap-3 py-2">
          <IconButton label="Back" onClick={back} className="-ml-2">
            <ChevronLeft size={24} />
          </IconButton>
          <div className="flex flex-1 gap-1.5" aria-label={`Step ${idx} of ${STEPS.length - 1}`}>
            {STEPS.slice(1).map((s, i) => (
              <span key={s} className={`h-1 flex-1 rounded-full transition-colors ${i < idx ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-surface-3'}`} />
            ))}
          </div>
        </div>
      )}

      <div key={step} className="animate-fade-up flex flex-1 flex-col">
        {step === 'welcome' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <AppEmblem size={120} />
            <p className="hud-label mt-8 !text-primary">A personal fitness RPG</p>
            <h1 className="font-hud mt-2 text-5xl font-bold tracking-[0.12em]">
              NUTRI<span className="text-gradient-gold">TRACK</span>
            </h1>
            <p className="mt-4 max-w-xs text-muted">
              Fuel your body, complete daily missions and level up the real you. Your data never leaves this device.
            </p>
            <div className="mt-10 w-full space-y-3">
              <Button variant="gold" size="lg" block onClick={next}>
                Create your champion <ArrowRight size={20} />
              </Button>
              <Button variant="ghost" block onClick={() => fileRef.current?.click()}>
                <Upload size={18} /> Restore from a backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onRestore(f);
                  e.target.value = '';
                }}
              />
              {restoreMsg && <p className="text-sm text-muted">{restoreMsg}</p>}
            </div>
          </div>
        )}

        {step === 'name' && (
          <StepShell title="What should we call you?" kicker="Identity" text="Your briefings and greetings will use this name.">
            <Label htmlFor="name">Name</Label>
            <TextInput id="name" autoFocus value={name} maxLength={40} placeholder="e.g. Alex" onChange={(e) => setName(e.target.value)} />
          </StepShell>
        )}

        {step === 'body' && (
          <StepShell title="Your starting stats" kicker="Character sheet" text="Used to estimate your calorie and nutrient targets. Nothing is shared.">
            <div className="space-y-4">
              <SexPicker value={sex} onChange={setSex} />
              <div>
                <Label htmlFor="age" hint="13–100">Age</Label>
                <NumberInput id="age" value={age} onValue={setAge} decimals={false} suffix="yrs" />
                {age !== undefined && age < 18 && (
                  <p className="mt-1.5 text-xs text-orange">Targets are designed for adults. Under 18, please check them with a parent, GP or dietitian.</p>
                )}
              </div>
              <HeightField cm={heightCm} onCm={setHeightCm} />
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">Weight unit</span>
                  <Segmented size="sm" className="w-28" value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} />
                </div>
                <WeightField id="weight" label="Current weight" kg={weightKg} onKg={setWeightKg} unit={unit} />
              </div>
              <WeightField id="goal" label="Goal weight" hint="Optional" kg={goalKg} onKg={setGoalKg} unit={unit} />
            </div>
          </StepShell>
        )}

        {step === 'activity' && (
          <StepShell title="How active are you?" kicker="Class" text="Pick what a typical week looks like right now.">
            <ActivityPicker value={activity} onChange={setActivity} />
          </StepShell>
        )}

        {step === 'objective' && (
          <StepShell title="Choose your objective" kicker="Main quest">
            <ObjectivePicker value={objective} onChange={setObjective} />
          </StepShell>
        )}

        {step === 'summary' && preview && (
          <StepShell title={`Ready, ${name.trim() || 'champion'}?`} kicker="Loadout" text="Estimated daily targets based on the Mifflin-St Jeor equation. You can change every value in Profile.">
            <div className="panel hud-corners p-5">
              <div className="flex items-baseline justify-between">
                <span className="hud-label">Calories</span>
                <span className="font-hud text-gradient-gold text-4xl font-bold tabular">{preview.calories.toLocaleString()}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Macro label="Protein" value={preview.protein} color="var(--protein)" />
                <Macro label="Carbs" value={preview.carbs} color="var(--carbs)" />
                <Macro label="Fat" value={preview.fat} color="var(--fat)" />
              </div>
              <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm text-muted">
                <span>Water {formatVolume(preview.waterMl)}</span>
                <span>Fibre {preview.fiber} g</span>
                {goalKg !== undefined && <span>Goal {formatWeight(goalKg, unit)}</span>}
              </div>
            </div>
            <p className="mt-3 text-xs text-faint">
              These are estimates, not medical advice. Weight-loss targets use a moderate deficit and never go below a safe minimum.
            </p>
          </StepShell>
        )}
      </div>

      {step !== 'welcome' && (
        <div className="mt-6 space-y-2">
          {step === 'summary' ? (
            <Button variant="gold" size="lg" block onClick={finish} disabled={saving || !bodyValid}>
              Begin your campaign <ArrowRight size={20} />
            </Button>
          ) : (
            <Button variant="primary" size="lg" block onClick={next} disabled={step === 'body' && !bodyValid}>
              Continue <ArrowRight size={20} />
            </Button>
          )}
          {step === 'name' && (
            <Button variant="ghost" block onClick={skip}>
              Skip setup for now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StepShell({ title, kicker, text, children }: { title: string; kicker: string; text?: string; children: ReactNode }) {
  return (
    <div className="pt-6">
      <p className="hud-label !text-primary">{kicker}</p>
      <h1 className="font-hud mt-1 text-3xl font-bold leading-tight">{title}</h1>
      {text && <p className="mt-2 text-muted">{text}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-surface-3/60 py-2.5">
      <div className="font-hud tabular text-2xl font-bold" style={{ color }}>
        {value}
        <span className="ml-0.5 text-xs text-muted">g</span>
      </div>
      <div className="hud-label !text-[10px]">{label}</div>
    </div>
  );
}
