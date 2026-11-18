import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { saveProfile } from '../../db/actions';
import { useProfile, useSettings } from '../../hooks/useData';
import { LIMITS } from '../../lib/limits';
import type { Profile } from '../../lib/models';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { Label, NumberInput, TextInput } from '../../components/ui/Field';
import { ActivityPicker, HeightField, ObjectivePicker, SexPicker, WeightField } from './ProfileFields';

export default function DetailsPage() {
  const profile = useProfile();
  // The live profile arrives a moment after first render; key the form on it.
  return profile.createdAt ? <DetailsForm key={profile.updatedAt} profile={profile} /> : null;
}

function DetailsForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const { weightUnit } = useSettings();
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState(profile.sex);
  const [age, setAge] = useState<number | undefined>(profile.age);
  const [heightCm, setHeightCm] = useState<number | undefined>(profile.heightCm);
  const [weightKg, setWeightKg] = useState<number | undefined>(profile.weightKg);
  const [goalKg, setGoalKg] = useState<number | undefined>(profile.goalWeightKg);
  const [activity, setActivity] = useState(profile.activity);
  const [objective, setObjective] = useState(profile.objective);
  const [error, setError] = useState('');

  const save = async () => {
    const inRange = (v: number | undefined, r: { min: number; max: number }) => v !== undefined && v >= r.min && v <= r.max;
    if (!inRange(age, LIMITS.age)) return setError(`Age must be between ${LIMITS.age.min} and ${LIMITS.age.max}.`);
    if (!inRange(heightCm, LIMITS.heightCm)) return setError('Height looks out of range.');
    if (!inRange(weightKg, LIMITS.weightKg)) return setError('Weight looks out of range.');
    if (goalKg !== undefined && !inRange(goalKg, LIMITS.weightKg)) return setError('Goal weight looks out of range.');
    await saveProfile({ name, sex, age, heightCm, weightKg, goalWeightKg: goalKg, activity, objective });
    navigate(-1);
  };

  return (
    <Page>
      <PageHeader back kicker="Character sheet" title="Personal details" />
      <div className="space-y-4">
        <Card className="space-y-4">
          <div>
            <Label htmlFor="d-name">Name</Label>
            <TextInput id="d-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <SexPicker value={sex} onChange={setSex} />
          <div>
            <Label htmlFor="d-age">Age</Label>
            <NumberInput id="d-age" value={age} onValue={setAge} decimals={false} suffix="yrs" />
          </div>
          <HeightField cm={heightCm} onCm={setHeightCm} />
          <WeightField id="d-weight" label="Current weight" kg={weightKg} onKg={setWeightKg} unit={weightUnit} hint="Updated automatically by weigh-ins" />
          <WeightField id="d-goal" label="Goal weight" kg={goalKg} onKg={setGoalKg} unit={weightUnit} hint="Optional" />
        </Card>
        <Card>
          <SectionTitle>Activity level</SectionTitle>
          <ActivityPicker value={activity} onChange={setActivity} />
        </Card>
        <Card>
          <SectionTitle>Objective</SectionTitle>
          <ObjectivePicker value={objective} onChange={setObjective} />
        </Card>
        {profile.customTargets ? (
          <p className="flex gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" /> Your targets are set by hand, so they will not change. Use “Reset to suggested” in Goals &amp; targets to recalculate.
          </p>
        ) : (
          <p className="flex gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" /> Saving recalculates your suggested calorie and nutrient targets.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="primary" size="lg" block onClick={save}>
          Save details
        </Button>
      </div>
    </Page>
  );
}
