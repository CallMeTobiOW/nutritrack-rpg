import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, Swords } from 'lucide-react';
import { db } from '../../db/db';
import { acknowledgeBriefing, briefingById, ensureTodayBriefing, nextBriefing } from '../../db/briefing';
import { SPEAKERS, type Briefing } from '../../data/briefings';
import { formatLongDate, type DateKey } from '../../lib/dates';
import { sfx } from '../../lib/sound';
import { Button } from '../../components/ui/Button';
import { useProfile, useQuests } from '../../hooks/useData';
import { formatVolume } from '../../lib/units';
import { SpeakerEmblem } from './SpeakerEmblem';

// A tiny store so any screen can re-open the briefing.
let manualOpen = false;
const listeners = new Set<() => void>();
export function openBriefing() {
  manualOpen = true;
  listeners.forEach((l) => l());
}
function closeManual() {
  manualOpen = false;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Creates today's briefing on first launch and shows it until acknowledged. */
export function BriefingGate({ today }: { today: DateKey }) {
  const record = useLiveQuery(() => db.briefings.get(today), [today]);
  const manual = useSyncExternalStore(subscribe, () => manualOpen);

  useEffect(() => {
    if (record === undefined) void ensureTodayBriefing(today);
  }, [record, today]);

  const briefing = briefingById(record?.currentId ?? record?.messageId);
  const open = !!briefing && (manual || record?.acknowledged === false);
  if (!open || !briefing) return null;

  return (
    <BriefingOverlay
      key={today}
      today={today}
      briefing={briefing}
      onClose={() => {
        closeManual();
        void acknowledgeBriefing(today);
      }}
    />
  );
}

function BriefingOverlay({ today, briefing, onClose }: { today: DateKey; briefing: Briefing; onClose: () => void }) {
  const [stage, setStage] = useState<'incoming' | 'briefing'>('incoming');
  const [current, setCurrent] = useState(briefing);
  // Follow a new briefing from the parent (adjusting state during render, not in an effect).
  const [shownProp, setShownProp] = useState(briefing);
  if (briefing !== shownProp) {
    setShownProp(briefing);
    setCurrent(briefing);
  }
  const [busy, setBusy] = useState(false);
  const profile = useProfile();
  const quests = useQuests();
  const speaker = SPEAKERS[current.category];
  const dailyCount = quests?.filter((q) => q.category === 'daily').length ?? 0;

  useEffect(() => {
    sfx.briefing();
    const t = setTimeout(() => setStage('briefing'), 1100);
    return () => clearTimeout(t);
  }, []);

  const words = useMemo(() => current.text.split(' '), [current]);

  const another = async () => {
    setBusy(true);
    try {
      setCurrent(await nextBriefing(today));
      sfx.tick();
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[80] overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Your daily briefing"
    >
      {/* Ambient layers */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(40rem 26rem at 50% 0%, color-mix(in srgb, ${speaker.accent} 22%, transparent), transparent 65%),
              radial-gradient(30rem 20rem at 100% 100%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%)`,
          }}
        />
        <div className="absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(0deg,var(--text)_0_1px,transparent_1px_4px)]" />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-lg flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        {stage === 'incoming' ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="animate-pop">
              <SpeakerEmblem category={current.category} size={88} />
            </div>
            <p className="hud-label mt-6 animate-pulse-glow !text-primary">Incoming transmission</p>
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-6 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="animate-fade-up pt-6 text-center">
              <p className="hud-label !text-primary">{formatLongDate(today)}</p>
              <h1 className="font-hud mt-2 text-[40px] font-bold uppercase leading-none tracking-[0.08em]">
                Your daily <span className="text-gradient-gold">briefing</span>
              </h1>
              <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>

            <div className="panel hud-corners animate-fade-up mt-8 p-6" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3">
                <SpeakerEmblem category={current.category} size={52} />
                <div className="min-w-0">
                  <p className="font-hud text-lg font-bold leading-tight" style={{ color: speaker.accent }}>
                    {speaker.name}
                  </p>
                  <p className="truncate text-xs text-muted">{speaker.title}</p>
                </div>
              </div>
              <blockquote key={current.id} className="mt-5 text-[19px] font-medium leading-relaxed text-text">
                {words.map((w, i) => (
                  <span key={i} className="animate-fade-up inline-block whitespace-pre" style={{ animationDelay: `${0.25 + i * 0.035}s` }}>
                    {w}{' '}
                  </span>
                ))}
              </blockquote>
            </div>

            <div className="animate-fade-up mt-5 grid grid-cols-3 gap-2 text-center" style={{ animationDelay: '0.5s' }}>
              <Objective label="Daily missions" value={String(dailyCount)} />
              <Objective label="Fuel target" value={`${profile.targets.calories.toLocaleString()}`} unit="kcal" />
              <Objective label="Hydration" value={formatVolume(profile.targets.waterMl)} />
            </div>

            <div className="flex-1" />

            <div className="animate-fade-up mt-8 space-y-3" style={{ animationDelay: '0.7s' }}>
              <Button variant="gold" size="lg" block onClick={onClose}>
                <Swords size={20} /> Begin mission
              </Button>
              <Button variant="ghost" block onClick={another} disabled={busy}>
                <RefreshCw size={18} className={busy ? 'animate-spin' : ''} /> Another briefing
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Objective({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 px-2 py-3">
      <div className="font-hud tabular text-xl font-bold leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold text-muted">{unit}</span>}
      </div>
      <div className="hud-label mt-1.5 !text-[9px]">{label}</div>
    </div>
  );
}
