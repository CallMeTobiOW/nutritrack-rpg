import { useRef, useState } from 'react';
import { ArrowRight, Upload } from 'lucide-react';
import { restoreBackup } from '../../db/backup';
import { AppEmblem } from '../../components/ui/AppEmblem';
import { Button } from '../../components/ui/Button';

/** Fixed spark positions so the art is identical on every render. */
const SPARKS = [
  { left: 14, bottom: 18, delay: 0, size: 3 },
  { left: 27, bottom: 8, delay: 2.4, size: 2 },
  { left: 38, bottom: 22, delay: 4.6, size: 3 },
  { left: 61, bottom: 12, delay: 1.2, size: 2 },
  { left: 72, bottom: 26, delay: 3.4, size: 3 },
  { left: 84, bottom: 10, delay: 5.6, size: 2 },
  { left: 50, bottom: 4, delay: 6.3, size: 2 },
  { left: 20, bottom: 30, delay: 5, size: 2 },
  { left: 79, bottom: 34, delay: 0.8, size: 2 },
];

/** Original hero art: the crest floating inside slow-turning rune rings. */
function HeroArt() {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-1/2 top-[40%] aspect-square w-[150%] max-w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 26%, transparent), transparent 72%)' }}
      />
      <div
        className="absolute left-1/2 top-[44%] aspect-square w-[80%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--gold) 22%, transparent), transparent 70%)' }}
      />
      <svg viewBox="-200 -200 400 400" className="absolute left-1/2 top-[40%] w-[115%] max-w-[560px] -translate-x-1/2 -translate-y-1/2">
        <g className="animate-orbit" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <circle r="176" fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="2 10" />
          <circle r="150" fill="none" stroke="var(--line)" strokeWidth="1" />
        </g>
        <g className="animate-orbit-rev" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <polygon
            points="0,-128 110.9,-64 110.9,64 0,128 -110.9,64 -110.9,-64"
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 45%, transparent)"
            strokeWidth="1.5"
            strokeDasharray="40 8 4 8"
          />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <circle key={a} r="3.5" fill="var(--gold)" transform={`rotate(${a}) translate(0 -128)`} />
          ))}
        </g>
        <circle r="96" fill="none" stroke="color-mix(in srgb, var(--gold) 30%, transparent)" strokeWidth="1" />
      </svg>
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
        <div className="animate-hover">
          <AppEmblem size={180} className="h-auto w-[min(46vw,190px,24dvh)]" />
        </div>
      </div>
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="animate-spark absolute rounded-full bg-gold opacity-0"
          style={{ left: `${s.left}%`, bottom: `${s.bottom}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, boxShadow: '0 0 8px var(--gold)' }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to bottom, transparent, var(--bg) 92%)' }} />
    </div>
  );
}

export function IntroScreen({ onStart }: { onStart: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

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
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[66%]">
        <HeroArt />
      </div>
      <div className="relative mx-auto mt-auto w-full max-w-lg px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="animate-rise flex items-center gap-2">
          <AppEmblem size={26} />
          <span className="font-hud text-[15px] font-bold tracking-[0.32em]">
            NUTRI<span className="text-gold">TRACK</span>
          </span>
        </div>
        <h1 className="ob-display animate-rise mt-4 text-[3.25rem] [animation-delay:80ms]">
          Level up
          <br />
          the real you
        </h1>
        <p className="animate-rise mt-4 text-base leading-relaxed text-muted [animation-delay:160ms]">
          Answer eight quick questions and get a fuel plan, daily quests and XP built around your body.
        </p>
        <div className="animate-rise mt-7 [animation-delay:240ms]">
          <Button variant="gold" size="xl" block onClick={onStart}>
            Build my plan <ArrowRight size={20} strokeWidth={2.5} />
          </Button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-muted transition hover:text-text"
          >
            <Upload size={17} /> Restore from a backup
          </button>
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
          {restoreMsg && (
            <p role="status" className="text-center text-sm text-muted">
              {restoreMsg}
            </p>
          )}
          <p className="mt-3 text-center text-[13px] text-faint">No account. Your data stays on this device.</p>
        </div>
      </div>
    </div>
  );
}
