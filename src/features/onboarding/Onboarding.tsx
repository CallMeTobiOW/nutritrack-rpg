import { useEffect, useRef, useState } from 'react';
import { Armchair, ArrowRight, Bike, Compass, Dumbbell, Flame, Footprints, HardHat, Mars, Shield, Target, Venus, type LucideIcon } from 'lucide-react';
import { saveProfile, updateSettings } from '../../db/actions';
import { useProfile, useSettings } from '../../hooks/useData';
import { cn } from '../../lib/cn';
import { clamp, LIMITS } from '../../lib/limits';
import { prefersReducedMotion } from '../../lib/motion';
import type { Sex } from '../../lib/references';
import { snapToScale } from '../../lib/ruler';
import { sfx } from '../../lib/sound';
import { ACTIVITY_LEVELS, OBJECTIVES, suggestTargets, type ActivityLevel, type BodyStats, type Objective } from '../../lib/targets';
import { CM_PER_IN, cmToFeetInches, formatHeight, formatWeight, kgToUnit, unitToKg, type HeightUnit, type WeightUnit } from '../../lib/units';
import { Button } from '../../components/ui/Button';
import { RulerPicker } from '../../components/ui/RulerPicker';
import { Segmented } from '../../components/ui/Segmented';
import { IntroScreen } from './IntroScreen';
import { ForgeScreen, RevealScreen } from './ResultScreens';
import { MeasureControl, NumberReadout, OnboardingHeader, OptionCard, OptionList, Question, StaticReadout } from './parts';

const QUESTIONS = ['name', 'sex', 'age', 'height', 'weight', 'activity', 'objective', 'goal'] as const;
type QuestionStep = (typeof QUESTIONS)[number];
type Step = 'intro' | QuestionStep | 'forge' | 'reveal';
const FLOW: Step[] = ['intro', ...QUESTIONS, 'forge', 'reveal'];

// Ruler scales. Every value the rulers report is already inside LIMITS.
const AGE = { min: LIMITS.age.min, max: LIMITS.age.max, step: 1, px: 14, majorEvery: 5 };
const CM = { min: LIMITS.heightCm.min, max: LIMITS.heightCm.max, step: 1, px: 9, midEvery: 5, majorEvery: 10 };
const INCHES = {
  min: Math.ceil(LIMITS.heightCm.min / CM_PER_IN),
  max: Math.floor(LIMITS.heightCm.max / CM_PER_IN),
  step: 1,
  px: 15,
  midEvery: 6,
  majorEvery: 12,
};
const KG = { min: LIMITS.weightKg.min, max: LIMITS.weightKg.max, step: 0.1, px: 3, tickEvery: 10, majorEvery: 50 };
const LBS = {
  min: Math.ceil(kgToUnit(LIMITS.weightKg.min, 'lbs') * 10) / 10,
  max: Math.floor(kgToUnit(LIMITS.weightKg.max, 'lbs') * 10) / 10,
  step: 0.1,
  px: 2,
  tickEvery: 10,
  midEvery: 50,
  majorEvery: 100,
};
const feetLabel = (inches: number) => `${inches / 12}′`;

// Where the rulers start before the player moves them. Never saved unless set.
const START_AGE = 30;
const startHeight = (sex: Sex | undefined) => (sex === 'female' ? 163 : 176);
const startWeight = (sex: Sex | undefined) => (sex === 'female' ? 65 : 78);
const clampKg = (kg: number) => clamp(kg, LIMITS.weightKg.min, LIMITS.weightKg.max);
function startGoal(weightKg: number, objective: Objective | undefined): number {
  const delta = objective === 'lose' ? -5 : objective === 'build' ? 3 : 0;
  return Math.round(clampKg(weightKg + delta) * 10) / 10;
}

const ACTIVITY_ICONS: Record<ActivityLevel, LucideIcon> = {
  sedentary: Armchair,
  light: Footprints,
  moderate: Bike,
  active: Dumbbell,
  veryActive: HardHat,
};
const OBJECTIVE_ICONS: Record<Objective, LucideIcon> = { lose: Flame, maintain: Shield, build: Dumbbell };

const BLOCKED_LABEL: Record<QuestionStep, string> = {
  name: 'Continue',
  sex: 'Pick one to continue',
  age: 'Drag to set your age',
  height: 'Drag to set your height',
  weight: 'Drag to set your weight',
  activity: 'Pick one to continue',
  objective: 'Pick one to continue',
  goal: 'Pick one to continue',
};

export function Onboarding() {
  const profile = useProfile();
  const settings = useSettings();
  // Start blank on a fresh install so starting ruler positions never become real targets.
  const fresh = !profile.onboarded && !profile.name;

  const [step, setStep] = useState<Step>('intro');
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<Sex | undefined>(fresh ? undefined : profile.sex);
  const [age, setAge] = useState<number | undefined>(fresh ? undefined : profile.age);
  const [heightCm, setHeightCm] = useState<number | undefined>(fresh ? undefined : profile.heightCm);
  const [weightKg, setWeightKg] = useState<number | undefined>(fresh ? undefined : profile.weightKg);
  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(settings.weightUnit === 'lbs' ? 'ft' : 'cm');
  const [activity, setActivity] = useState<ActivityLevel | undefined>(fresh ? undefined : profile.activity);
  const [objective, setObjective] = useState<Objective | undefined>(fresh ? undefined : profile.objective);
  const [wantsGoal, setWantsGoal] = useState<boolean | undefined>(profile.goalWeightKg !== undefined ? true : fresh ? undefined : false);
  const [goalKg, setGoalKg] = useState<number | undefined>(profile.goalWeightKg);
  const [saving, setSaving] = useState(false);
  const advanceTimer = useRef(0);
  const goalRulerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const idx = FLOW.indexOf(step);
  const goTo = (s: Step, d: 1 | -1) => {
    window.clearTimeout(advanceTimer.current);
    setDir(d);
    setStep(s);
  };
  const next = () => goTo(FLOW[Math.min(FLOW.length - 1, idx + 1)], 1);
  const back = () => goTo(step === 'reveal' ? 'goal' : FLOW[Math.max(0, idx - 1)], -1);
  /** Single-choice answers move on by themselves after a short beat. */
  const pick = (apply: () => void) => {
    apply();
    sfx.tick();
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(next, 280);
  };

  const ageV = age ?? START_AGE;
  const heightV = heightCm ?? startHeight(sex);
  const weightV = weightKg ?? startWeight(sex);
  const goalV = goalKg ?? startGoal(weightV, objective);
  const W = unit === 'kg' ? KG : LBS;
  const weightU = kgToUnit(weightV, unit);
  const goalU = kgToUnit(goalV, unit);
  const inches = heightV / CM_PER_IN;
  const { ft, inch } = cmToFeetInches(heightV);

  const stats: BodyStats | null =
    sex && age !== undefined && heightCm !== undefined && weightKg !== undefined && activity && objective
      ? { sex, age, heightCm, weightKg, activity, objective }
      : null;
  const targets = stats ? suggestTargets(stats) : null;
  const finalGoal = wantsGoal ? goalKg : undefined;

  const canContinue: Record<QuestionStep, boolean> = {
    name: true,
    sex: sex !== undefined,
    age: age !== undefined,
    height: heightCm !== undefined,
    weight: weightKg !== undefined,
    activity: activity !== undefined,
    objective: objective !== undefined,
    goal: wantsGoal !== undefined,
  };

  useEffect(() => {
    if (step === 'goal' && wantsGoal) goalRulerRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step, wantsGoal]);

  const finish = async () => {
    if (!stats) return;
    setSaving(true);
    try {
      await updateSettings({ weightUnit: unit });
      await saveProfile({ name, ...stats, goalWeightKg: finalGoal }, { onboard: true });
    } catch {
      setSaving(false);
    }
  };

  const skip = async () => {
    await saveProfile({ name: name || '' }, { onboard: true });
  };

  if (step === 'intro') return <IntroScreen onStart={next} />;
  if (step === 'forge') return <ForgeScreen onDone={() => goTo('reveal', 1)} />;

  const weightRuler = (value: number, onKg: (kg: number) => void, label: string) => (
    <RulerPicker key={unit} {...W} value={value} onChange={(v) => onKg(unitToKg(v, unit))} label={label} valueText={formatWeight(unitToKg(value, unit), unit)} />
  );
  const weightReadout = (value: number, onKg: (kg: number) => void, label: string) => (
    <NumberReadout
      display={snapToScale(value, W).toFixed(1)}
      unit={unit}
      label={`${label} in ${unit}`}
      decimals
      onCommit={(n) => onKg(clampKg(unitToKg(n, unit)))}
    />
  );
  const nudgeWeight = (value: number, by: number, onKg: (kg: number) => void) => onKg(clampKg(unitToKg(snapToScale(value, W) + by, unit)));

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <OnboardingHeader onBack={back} current={step === 'reveal' ? QUESTIONS.length : QUESTIONS.indexOf(step) + 1} total={QUESTIONS.length} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div key={step} className={cn('mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-4', dir > 0 ? 'animate-step-fwd' : 'animate-step-back')}>
          {step === 'name' && (
            <Question title="First up, what should I call you?" sub="I’ll use it in your daily briefings.">
              <label htmlFor="ob-name" className="sr-only">
                Your name
              </label>
              <input
                id="ob-name"
                autoFocus
                value={name}
                maxLength={40}
                placeholder="Your name"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    next();
                  }
                }}
                className="font-hud w-full border-0 border-b-2 border-line-strong bg-transparent pb-3 text-[2.5rem] font-bold leading-tight text-text outline-none transition-colors placeholder:text-faint focus:border-gold focus-visible:outline-none"
              />
            </Question>
          )}

          {step === 'sex' && (
            <Question title="Which sex should I use for your numbers?" sub="It changes the energy equation and your reference intakes. Nothing else.">
              <OptionList label="Sex">
                <OptionCard icon={Mars} title="Male" active={sex === 'male'} onSelect={() => pick(() => setSex('male'))} />
                <OptionCard icon={Venus} title="Female" active={sex === 'female'} onSelect={() => pick(() => setSex('female'))} />
              </OptionList>
            </Question>
          )}

          {step === 'age' && (
            <Question title="How old are you?" sub="Energy needs ease off a little with every birthday.">
              <MeasureControl
                set={age !== undefined}
                readout={
                  <NumberReadout
                    display={String(ageV)}
                    unit="yrs"
                    label="Age in years"
                    decimals={false}
                    onCommit={(n) => setAge(clamp(Math.round(n), AGE.min, AGE.max))}
                  />
                }
                ruler={<RulerPicker {...AGE} value={ageV} onChange={setAge} label="Age" valueText={`${ageV} years`} />}
                onMinus={() => setAge(clamp(ageV - 1, AGE.min, AGE.max))}
                onPlus={() => setAge(clamp(ageV + 1, AGE.min, AGE.max))}
                hint="Drag the ruler or tap the number to type it."
              />
              {age !== undefined && age < 18 && (
                <p className="rounded-2xl border border-orange/30 bg-orange/10 px-4 py-3 text-sm text-orange">
                  Targets are designed for adults. Under 18, please check them with a parent, GP or dietitian.
                </p>
              )}
            </Question>
          )}

          {step === 'height' && (
            <Question title="How tall are you?" sub="Taller frames burn more fuel, even at rest.">
              <MeasureControl
                set={heightCm !== undefined}
                readout={
                  heightUnit === 'cm' ? (
                    <NumberReadout
                      display={String(Math.round(heightV))}
                      unit="cm"
                      label="Height in centimetres"
                      decimals={false}
                      onCommit={(n) => setHeightCm(clamp(Math.round(n), CM.min, CM.max))}
                    />
                  ) : (
                    <StaticReadout>
                      {ft}
                      <span className="text-muted">′</span> {inch}
                      <span className="text-muted">″</span>
                    </StaticReadout>
                  )
                }
                ruler={
                  heightUnit === 'cm' ? (
                    <RulerPicker key="cm" {...CM} value={heightV} onChange={setHeightCm} label="Height" valueText={formatHeight(heightV, 'cm')} />
                  ) : (
                    <RulerPicker
                      key="in"
                      {...INCHES}
                      formatLabel={feetLabel}
                      value={inches}
                      onChange={(v) => setHeightCm(v * CM_PER_IN)}
                      label="Height"
                      valueText={formatHeight(heightV, 'ft')}
                    />
                  )
                }
                onMinus={() =>
                  heightUnit === 'cm'
                    ? setHeightCm(clamp(Math.round(heightV) - 1, CM.min, CM.max))
                    : setHeightCm(clamp(Math.round(inches) - 1, INCHES.min, INCHES.max) * CM_PER_IN)
                }
                onPlus={() =>
                  heightUnit === 'cm'
                    ? setHeightCm(clamp(Math.round(heightV) + 1, CM.min, CM.max))
                    : setHeightCm(clamp(Math.round(inches) + 1, INCHES.min, INCHES.max) * CM_PER_IN)
                }
                hint={heightUnit === 'cm' ? 'Drag the ruler or tap the number to type it.' : 'Drag the ruler or use the arrows.'}
                footer={
                  <Segmented
                    size="sm"
                    className="w-40"
                    label="Height unit"
                    value={heightUnit}
                    onChange={setHeightUnit}
                    options={[
                      { value: 'cm', label: 'cm' },
                      { value: 'ft', label: 'ft / in' },
                    ]}
                  />
                }
              />
            </Question>
          )}

          {step === 'weight' && (
            <Question title="What do you weigh today?" sub="Your starting stat. It never leaves this device.">
              <MeasureControl
                set={weightKg !== undefined}
                readout={weightReadout(weightU, setWeightKg, 'Weight')}
                ruler={weightRuler(weightU, setWeightKg, 'Weight')}
                onMinus={() => nudgeWeight(weightU, -0.1, setWeightKg)}
                onPlus={() => nudgeWeight(weightU, 0.1, setWeightKg)}
                hint="Drag the ruler or tap the number to type it."
                footer={
                  <Segmented
                    size="sm"
                    className="w-40"
                    label="Weight unit"
                    value={unit}
                    onChange={setUnit}
                    options={[
                      { value: 'kg', label: 'kg' },
                      { value: 'lbs', label: 'lbs' },
                    ]}
                  />
                }
              />
            </Question>
          )}

          {step === 'activity' && (
            <Question title="What does a normal week look like?" sub="Count your job and your training together.">
              <OptionList label="Activity level">
                {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => (
                  <OptionCard
                    key={k}
                    icon={ACTIVITY_ICONS[k]}
                    title={ACTIVITY_LEVELS[k].label}
                    hint={ACTIVITY_LEVELS[k].hint}
                    active={activity === k}
                    onSelect={() => pick(() => setActivity(k))}
                  />
                ))}
              </OptionList>
            </Question>
          )}

          {step === 'objective' && (
            <Question title="What’s your main quest?" sub="You can change course any time in Profile.">
              <OptionList label="Objective">
                {(Object.keys(OBJECTIVES) as Objective[]).map((k) => (
                  <OptionCard
                    key={k}
                    icon={OBJECTIVE_ICONS[k]}
                    title={OBJECTIVES[k].label}
                    hint={OBJECTIVES[k].hint}
                    active={objective === k}
                    onSelect={() => pick(() => setObjective(k))}
                  />
                ))}
              </OptionList>
            </Question>
          )}

          {step === 'goal' && (
            <Question title="Got a target weight in mind?" sub="Optional. It powers the progress bar on your weight page.">
              <OptionList label="Target weight">
                <OptionCard
                  icon={Target}
                  title="Yes, set a target"
                  active={wantsGoal === true}
                  onSelect={() => {
                    sfx.tick();
                    setWantsGoal(true);
                    if (goalKg === undefined) setGoalKg(goalV);
                  }}
                />
                <OptionCard
                  icon={Compass}
                  title="Not right now"
                  hint="You can add one later."
                  active={wantsGoal === false}
                  onSelect={() => pick(() => setWantsGoal(false))}
                />
              </OptionList>
              {wantsGoal && (
                <div ref={goalRulerRef} className="animate-rise mt-6 flex flex-1 flex-col">
                  <MeasureControl
                    set
                    readout={weightReadout(goalU, setGoalKg, 'Target weight')}
                    ruler={weightRuler(goalU, setGoalKg, 'Target weight')}
                    onMinus={() => nudgeWeight(goalU, -0.1, setGoalKg)}
                    onPlus={() => nudgeWeight(goalU, 0.1, setGoalKg)}
                    hint={`Today you’re ${formatWeight(weightV, unit)}.`}
                  />
                </div>
              )}
            </Question>
          )}

          {step === 'reveal' && stats && targets && (
            <RevealScreen name={name} stats={stats} targets={targets} goalKg={finalGoal} unit={unit} />
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-lg px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {step === 'reveal' ? (
          <Button variant="gold" size="xl" block onClick={finish} disabled={saving || !stats}>
            Begin your campaign <ArrowRight size={20} strokeWidth={2.5} />
          </Button>
        ) : (
          <Button variant="gold" size="xl" block onClick={next} disabled={!canContinue[step]}>
            {canContinue[step] ? (
              <>
                {step === 'goal' ? 'Forge my plan' : 'Continue'} <ArrowRight size={20} strokeWidth={2.5} />
              </>
            ) : (
              BLOCKED_LABEL[step]
            )}
          </Button>
        )}
        {step === 'name' && (
          <button
            type="button"
            onClick={skip}
            className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium text-muted transition hover:text-text"
          >
            Skip setup for now
          </button>
        )}
      </footer>
    </div>
  );
}
