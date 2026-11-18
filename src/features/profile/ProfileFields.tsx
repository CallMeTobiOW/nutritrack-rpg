import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ACTIVITY_LEVELS, OBJECTIVES, type ActivityLevel, type Objective } from '../../lib/targets';
import type { Sex } from '../../lib/references';
import { kgToUnit, unitToKg, type WeightUnit } from '../../lib/units';
import { Label, NumberInput } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';

export function SexPicker({ value, onChange }: { value: Sex; onChange: (s: Sex) => void }) {
  return (
    <div>
      <Label hint="Used only for the energy equation">Sex</Label>
      <Segmented
        value={value}
        onChange={onChange}
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
      />
    </div>
  );
}

function ChoiceCard({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
        active ? 'border-primary bg-primary/10 shadow-glow' : 'border-line bg-surface-3/50 hover:border-line-strong',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <span className={cn('grid h-6 w-6 place-items-center rounded-full border', active ? 'border-primary bg-primary text-white' : 'border-line-strong')}>
        {active && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

export function ActivityPicker({ value, onChange }: { value: ActivityLevel; onChange: (a: ActivityLevel) => void }) {
  return (
    <div className="space-y-2">
      {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => (
        <ChoiceCard key={k} active={value === k} title={ACTIVITY_LEVELS[k].label} hint={ACTIVITY_LEVELS[k].hint} onClick={() => onChange(k)} />
      ))}
    </div>
  );
}

export function ObjectivePicker({ value, onChange }: { value: Objective; onChange: (o: Objective) => void }) {
  return (
    <div className="space-y-2">
      {(Object.keys(OBJECTIVES) as Objective[]).map((k) => (
        <ChoiceCard key={k} active={value === k} title={OBJECTIVES[k].label} hint={OBJECTIVES[k].hint} onClick={() => onChange(k)} />
      ))}
    </div>
  );
}

/** Weight entry in the player's preferred unit; reports kilograms. */
export function WeightField({
  label,
  kg,
  onKg,
  unit,
  hint,
  id,
}: {
  label: string;
  kg: number | undefined;
  onKg: (kg: number | undefined) => void;
  unit: WeightUnit;
  hint?: string;
  id?: string;
}) {
  const display = kg === undefined ? undefined : Math.round(kgToUnit(kg, unit) * 100) / 100;
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <NumberInput id={id} value={display} onValue={(v) => onKg(v === undefined ? undefined : unitToKg(v, unit))} suffix={unit} />
    </div>
  );
}

/** Height in cm or feet + inches; reports centimetres. */
export function HeightField({ cm, onCm }: { cm: number | undefined; onCm: (cm: number | undefined) => void }) {
  const [mode, setMode] = useState<'cm' | 'ft'>('cm');
  const totalIn = cm === undefined ? undefined : cm / 2.54;
  let ft = totalIn === undefined ? undefined : Math.floor(totalIn / 12);
  let inch = totalIn === undefined || ft === undefined ? undefined : Math.round(totalIn - ft * 12);
  if (ft !== undefined && inch === 12) {
    ft += 1;
    inch = 0;
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-muted">Height</span>
        <Segmented
          size="sm"
          className="w-28"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'cm', label: 'cm' },
            { value: 'ft', label: 'ft/in' },
          ]}
        />
      </div>
      {mode === 'cm' ? (
        <NumberInput value={cm === undefined ? undefined : Math.round(cm)} onValue={onCm} suffix="cm" aria-label="Height in centimetres" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            value={ft}
            decimals={false}
            onValue={(v) => onCm(v === undefined ? undefined : (v * 12 + (inch ?? 0)) * 2.54)}
            suffix="ft"
            aria-label="Feet"
          />
          <NumberInput
            value={inch}
            decimals={false}
            onValue={(v) => onCm(((ft ?? 0) * 12 + (v ?? 0)) * 2.54)}
            suffix="in"
            aria-label="Inches"
          />
        </div>
      )}
    </div>
  );
}
