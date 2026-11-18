import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { addQuestFromTemplate, createQuest, deleteQuest, updateQuest, type QuestInput } from '../../db/actions';
import { QUEST_TEMPLATES } from '../../db/defaults';
import type { AutoRule, Quest, QuestCategory, QuestRecurrence } from '../../lib/models';
import { AUTO_RULE_META, CATEGORY_META, autoRuleFits } from '../../lib/quests';
import { LIMITS } from '../../lib/limits';
import { cn } from '../../lib/cn';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { Label, NumberInput, Select, TextInput } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { Icon, QUEST_ICON_CHOICES } from '../../components/ui/Icon';

const DEFAULT_RECURRENCE: Record<QuestCategory, QuestRecurrence> = { daily: 'daily', side: 'daily', weekly: 'weekly', bonus: 'once' };
const RECURRENCE_LABEL: Record<QuestRecurrence, string> = { daily: 'Daily', weekly: 'Weekly', once: 'One time' };

interface Props {
  open: boolean;
  quest?: Quest;
  existing: Quest[];
  onClose: () => void;
}

export function QuestEditor({ open, quest, existing, onClose }: Props) {
  const [mode, setMode] = useState<'templates' | 'custom'>('templates');
  const [form, setForm] = useState<QuestInput>(blank());
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load the form when the sheet opens for a quest (or a new one).
  const key = open ? (quest?.id ?? null) : undefined;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setConfirmDelete(false);
    if (quest) {
      setForm({ title: quest.title, category: quest.category, recurrence: quest.recurrence, xp: quest.xp, icon: quest.icon, auto: quest.auto, description: quest.description });
      setMode('custom');
    } else {
      setForm(blank());
      setMode('templates');
    }
  }

  if (!open) return null;
  const editing = !!quest;
  const titles = new Set(existing.map((q) => q.title.toLowerCase()));
  const templates = QUEST_TEMPLATES.filter((t) => !titles.has(t.title.toLowerCase()));
  const set = <K extends keyof QuestInput>(k: K, v: QuestInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  // Changing how often a quest repeats drops a tracking rule that no longer fits it.
  const setRecurrence = (recurrence: QuestRecurrence) =>
    setForm((f) => ({ ...f, recurrence, auto: f.auto && autoRuleFits(f.auto, recurrence) ? f.auto : undefined }));
  const valid = form.title.trim().length > 0 && form.xp >= LIMITS.questXp.min && form.xp <= LIMITS.questXp.max;

  const save = async () => {
    if (!valid) return;
    if (editing) await updateQuest(quest.id, form);
    else await createQuest(form);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? 'Edit quest' : 'New quest'}
      footer={
        mode === 'custom' && (
          <div className="flex gap-2">
            {editing && (
              <Button
                variant={confirmDelete ? 'danger' : 'secondary'}
                className={cn(!confirmDelete && '!px-3 text-danger')}
                onClick={async () => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  await deleteQuest(quest.id);
                  onClose();
                }}
              >
                <Trash2 size={18} />
                {confirmDelete && 'Delete quest'}
              </Button>
            )}
            <Button variant="primary" block disabled={!valid} onClick={save}>
              {editing ? 'Save quest' : 'Add quest'}
            </Button>
          </div>
        )
      }
    >
      {!editing && (
        <Segmented
          className="mb-4 mt-1"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'templates', label: 'Suggestions' },
            { value: 'custom', label: 'Create your own' },
          ]}
        />
      )}

      {mode === 'templates' && !editing ? (
        <div className="space-y-2 pb-2">
          {templates.length === 0 && <p className="py-4 text-center text-sm text-muted">You already have every suggested quest.</p>}
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={async () => {
                await addQuestFromTemplate(t.key);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-3/40 px-3 py-3 text-left active:bg-surface-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-primary">
                <Icon name={t.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.title}</span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  {CATEGORY_META[t.category].label}
                  {t.auto && (
                    <>
                      {' · '}
                      <Zap size={11} className="text-primary" /> auto
                    </>
                  )}
                </span>
              </span>
              <span className="font-hud text-sm font-bold text-gold">+{t.xp}</span>
              <Plus size={18} className="text-primary" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <div>
            <Label htmlFor="q-title">Quest</Label>
            <TextInput id="q-title" value={form.title} maxLength={LIMITS.questTitle} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Meditate for 5 minutes" />
          </div>
          <div>
            <Label>Section</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_META) as QuestCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    set('category', c);
                    if (!editing) setRecurrence(DEFAULT_RECURRENCE[c]);
                  }}
                  className={cn('rounded-xl border px-3 py-2 text-sm font-semibold', form.category === c ? 'border-primary bg-primary/12' : 'border-line text-muted')}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Repeats</Label>
            {editing ? (
              // Locked after creation: changing it would let the same quest pay out again.
              <p className="text-sm text-muted">
                <span className="font-semibold text-text">{RECURRENCE_LABEL[form.recurrence]}</span>. To change how often it repeats, add it as a new quest.
              </p>
            ) : (
              <Segmented
                value={form.recurrence}
                onChange={setRecurrence}
                options={(Object.keys(RECURRENCE_LABEL) as QuestRecurrence[]).map((value) => ({ value, label: RECURRENCE_LABEL[value] }))}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="q-xp" hint={`${LIMITS.questXp.min}–${LIMITS.questXp.max}`}>XP reward</Label>
              <NumberInput id="q-xp" value={form.xp} decimals={false} onValue={(v) => set('xp', v ?? 0)} suffix="XP" />
            </div>
            <div>
              <Label htmlFor="q-auto">Tracking</Label>
              <Select id="q-auto" value={form.auto ?? ''} onChange={(e) => set('auto', (e.target.value || undefined) as AutoRule | undefined)}>
                <option value="">Tick by hand</option>
                {(Object.keys(AUTO_RULE_META) as AutoRule[]).filter((r) => autoRuleFits(r, form.recurrence)).map((r) => (
                  <option key={r} value={r}>
                    Auto: {AUTO_RULE_META[r].label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Icon</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {QUEST_ICON_CHOICES.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={form.icon === name}
                  onClick={() => set('icon', name)}
                  className={cn('grid aspect-square place-items-center rounded-xl border', form.icon === name ? 'border-primary bg-primary/15 text-primary' : 'border-line text-muted')}
                >
                  <Icon name={name} size={18} />
                </button>
              ))}
            </div>
          </div>
          {editing && <p className="text-xs text-faint">XP you have already earned from this quest is kept, even if you change or delete it.</p>}
        </div>
      )}
    </Sheet>
  );
}

function blank(): QuestInput {
  return { title: '', category: 'side', recurrence: 'daily', xp: 15, icon: 'star' };
}
