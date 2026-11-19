import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CameraOff,
  Check,
  ChevronLeft,
  CloudOff,
  Flashlight,
  Keyboard,
  Loader2,
  PackageSearch,
  PenLine,
  ShieldAlert,
  SwitchCamera,
  X,
} from 'lucide-react';
import { db } from '../../db/db';
import { removePendingScan, resolveBarcode, retryPendingScans, type ScanResult } from '../../db/scans';
import { useToday } from '../../hooks/useToday';
import { useGoBack } from '../../hooks/useGoBack';
import { amountLabel, defaultPortion, nutrientsFor } from '../../lib/food';
import type { Food, PendingScan } from '../../lib/models';
import { isPlausibleBarcode, normaliseBarcode } from '../../lib/openFoodFacts';
import { hapticTap } from '../../lib/scan/haptics';
import { BAND_COLOR, healthScore } from '../../lib/healthScore';
import { sfx } from '../../lib/sound';
import { cn } from '../../lib/cn';
import { Button, IconButton } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { useMealParam } from './AddFoodPage';
import { FoodAvatar } from './FoodAvatar';
import { PortionSheet, type PortionTarget } from './PortionSheet';
import { useBarcodeCamera, type CameraStatus } from './scanner/useBarcodeCamera';
import { mealTray, trayKcal, useMealTray } from './scanner/mealTray';
import { MealTraySheet } from './scanner/MealTraySheet';

type Mode = 'single' | 'meal';
type Notice = { id: number; tone: 'ok' | 'warn'; text: string };
type Problem = Extract<ScanResult, { kind: 'notfound' | 'queued' }>;

const MODE_KEY = 'nt-scan-mode';

function storedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'meal' ? 'meal' : 'single';
  } catch {
    return 'single';
  }
}

/**
 * Barcode scanner. Reads EAN-13, EAN-8, UPC-A and UPC-E with ZXing-C++
 * (WebAssembly) from the viewfinder area only.
 *
 * Two modes:
 *  - One item: a scan opens the portion picker, with the last portion used
 *    for that product already chosen.
 *  - Whole meal: every scan drops into a tray with its usual portion and the
 *    camera keeps going; the tray is reviewed and logged in one go.
 *
 * The camera needs HTTPS (or localhost), an iOS requirement.
 */
export default function ScannerPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const today = useToday();
  const [params] = useSearchParams();
  const date = params.get('date') ?? today;
  const meal = useMealParam();

  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [mode, setModeState] = useState<Mode>(storedMode);
  const [target, setTarget] = useState<PortionTarget | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [manual, setManual] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [lookups, setLookups] = useState<string[]>([]);
  const [flashing, setFlashing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const tray = useMealTray();
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode */
    }
  };

  const say = useCallback((tone: Notice['tone'], text: string) => setNotice({ id: Date.now(), tone, text }), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const handleCode = useCallback(
    async (code: string) => {
      hapticTap();
      sfx.scan();
      setFlashing(true);
      setTimeout(() => setFlashing(false), 550);
      const single = modeRef.current === 'single';
      setLookups((l) => [...l, code]);
      try {
        const result = await resolveBarcode(code);
        if (result.kind === 'found') {
          if (single) setTarget({ mode: 'add', food: result.food, scanned: true });
          else {
            const item = mealTray.add(result.food);
            say('ok', `${result.food.name} · ${amountLabel(item.amount, result.food.unit, item.servingLabel)}`);
          }
        } else {
          sfx.miss();
          if (single) setProblem(result);
          else say('warn', result.kind === 'notfound' ? `${code} isn't in the database. Saved to your scan inbox.` : `No signal. ${code} saved to your scan inbox.`);
        }
      } finally {
        setLookups((l) => l.filter((c) => c !== code));
      }
    },
    [say],
  );

  const sheetOpen = !!target || !!problem || manual || trayOpen;
  const reading = !sheetOpen && (mode === 'meal' || lookups.length === 0);
  const cam = useBarcodeCamera({ videoRef, boxRef, onCode: (c) => void handleCode(c), reading });

  // Scans saved while offline are looked up as soon as there is signal.
  useEffect(() => {
    const ctrl = new AbortController();
    const retry = () =>
      void retryPendingScans(ctrl.signal).then((n) => {
        if (n > 0) say('ok', `Back online: ${n} saved ${n === 1 ? 'scan was' : 'scans were'} found.`);
      });
    retry();
    window.addEventListener('online', retry);
    return () => {
      ctrl.abort();
      window.removeEventListener('online', retry);
    };
  }, [say]);

  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const recent = useMemo(
    () =>
      (foods ?? [])
        .filter((f) => f.lastScannedAt)
        .sort((a, b) => b.lastScannedAt! - a.lastScannedAt!)
        .slice(0, 12),
    [foods],
  );
  const inbox = settings?.pendingScans ?? [];

  const ctx = `meal=${meal}&date=${date}`;
  const addByHand = (code: string) => navigate(`/food/custom?${ctx}&barcode=${code}`, { replace: true });

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay aria-hidden />

      {/* Top bar */}
      <div className="relative z-10 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-3 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <IconButton label="Back" onClick={() => goBack('/food')} className="text-white hover:bg-white/10 hover:text-white">
            <ChevronLeft size={26} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="hud-label !text-[10px] !text-sky-300">Field scanner</p>
            <p className="font-hud text-lg font-bold leading-tight">{mode === 'meal' ? 'Scan a whole meal' : 'Scan a barcode'}</p>
          </div>
          {cam.cameras.count > 1 && (
            <IconButton label="Switch lens" onClick={cam.cameras.next} className="text-white hover:bg-white/10 hover:text-white">
              <SwitchCamera size={20} />
            </IconButton>
          )}
          {cam.torch && (
            <IconButton
              label={cam.torch.on ? 'Turn torch off' : 'Turn torch on'}
              aria-pressed={cam.torch.on}
              className={cam.torch.on ? 'bg-amber-300/20 text-amber-300' : 'text-white hover:bg-white/10 hover:text-white'}
              onClick={() => void cam.torch?.toggle()}
            >
              <Flashlight size={20} />
            </IconButton>
          )}
        </div>
        <div role="group" aria-label="Scan mode" className="mx-auto mt-2 flex w-full max-w-xs rounded-2xl border border-white/15 bg-black/40 p-0.5 backdrop-blur">
          {(
            [
              ['single', 'One item'],
              ['meal', 'Whole meal'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'h-10 flex-1 rounded-xl font-hud text-[12px] font-semibold uppercase tracking-wider transition',
                mode === m ? 'bg-white/90 text-black' : 'text-white/75',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Viewfinder */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
        {cam.status === 'live' && (
          <>
            <div ref={boxRef} className="relative aspect-[1.45] w-full max-w-sm">
              <div className="absolute inset-0 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              {[
                'left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl',
                'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl',
                'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl',
                'right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl',
              ].map((c) => (
                <span
                  key={c}
                  className={cn(
                    'absolute h-10 w-10 transition-colors duration-150',
                    flashing ? 'border-emerald-400 drop-shadow-[0_0_10px_#34d399]' : 'border-sky-400 drop-shadow-[0_0_8px_#38bdf8]',
                    c,
                  )}
                />
              ))}
              {flashing ? (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/90 text-black motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check size={30} strokeWidth={3} />
                  </span>
                </span>
              ) : (
                reading && (
                  <span className="absolute inset-x-6 top-1/2 h-0.5 rounded-full bg-sky-400 shadow-[0_0_14px_#38bdf8] motion-safe:[animation:scan-line_1.8s_ease-in-out_infinite]" />
                )
              )}
              {lookups.length > 0 && !flashing && (
                <span className="absolute inset-x-0 -bottom-12 mx-auto flex w-fit items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm">
                  <Loader2 size={16} className="animate-spin text-sky-300" /> Looking up {lookups[lookups.length - 1]}…
                </span>
              )}
            </div>
            <ScanHelp cam={cam} />
          </>
        )}
        {cam.status === 'starting' && (
          <p className="flex items-center gap-2 text-white/80">
            <Loader2 className="animate-spin" size={20} /> Starting camera…
          </p>
        )}
        {(cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'insecure') && <CameraProblem state={cam.status} onRetry={cam.restart} />}
      </div>

      {/* Bottom panel */}
      <div className="relative z-10 space-y-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        {notice && (
          <p
            key={notice.id}
            role="status"
            className={cn(
              'mx-auto w-fit max-w-full truncate rounded-full px-4 py-2 text-sm font-medium motion-safe:animate-[pop_0.25s_ease-out]',
              notice.tone === 'ok' ? 'bg-emerald-400/90 text-black' : 'bg-amber-300/95 text-black',
            )}
          >
            {notice.text}
          </p>
        )}

        {mode === 'meal' ? (
          <button
            type="button"
            onClick={() => setTrayOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-left backdrop-blur"
          >
            <span className="flex -space-x-2">
              {tray.length === 0 ? (
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/60">0</span>
              ) : (
                tray.slice(-3).map((i) => <FoodAvatar key={i.key} name={i.food.name} imageUrl={i.food.imageUrl} size={40} className="ring-2 ring-black" />)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {tray.length === 0 ? 'Scan each item in your meal' : `${tray.length} ${tray.length === 1 ? 'item' : 'items'} · ${Math.round(trayKcal(tray))} kcal`}
              </span>
              <span className="block text-xs text-white/65">{tray.length === 0 ? 'They collect here. Log them all at once.' : 'Tap to check portions and log'}</span>
            </span>
            {tray.length > 0 && <span className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold">Review</span>}
          </button>
        ) : (
          <RecentScans
            foods={recent}
            inbox={inbox}
            onFood={(f) => setTarget({ mode: 'add', food: f, scanned: true })}
            onInbox={(p) => (p.status === 'notfound' ? addByHand(p.code) : void handleCode(p.code))}
            onDismiss={(p) => void removePendingScan(p.code)}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button className="!border-white/15 !bg-white/10 !text-white" onClick={() => setManual(true)}>
            <Keyboard size={18} /> Type barcode
          </Button>
          <Button className="!border-white/15 !bg-white/10 !text-white" onClick={() => navigate(`/food/add?${ctx}`, { replace: true })}>
            <PackageSearch size={18} /> Search
          </Button>
        </div>
      </div>

      <ManualEntry
        open={manual}
        onClose={() => setManual(false)}
        onCode={(code) => {
          setManual(false);
          void handleCode(code);
        }}
      />

      <Sheet
        open={!!problem}
        onClose={() => setProblem(null)}
        title={problem?.kind === 'notfound' ? 'Not in the database yet' : 'Saved for later'}
        subtitle={problem ? `Barcode ${problem.code}` : undefined}
      >
        {problem && (
          <div className="space-y-3 py-2">
            <p className="text-muted">
              {problem.kind === 'notfound'
                ? 'No open food database knows this product yet. Copy the values from the pack once and it will be recognised instantly every time you scan it.'
                : `${problem.message} It's in your scan inbox and will be looked up automatically when you're back online.`}
            </p>
            <Button variant="primary" block onClick={() => addByHand(problem.code)}>
              <PenLine size={18} /> Add it from the pack
            </Button>
            <Button block onClick={() => navigate(`/food/add?${ctx}`, { replace: true })}>
              <PackageSearch size={18} /> Search by name instead
            </Button>
            <Button variant="ghost" block onClick={() => setProblem(null)}>
              Scan something else
            </Button>
          </div>
        )}
      </Sheet>

      <MealTraySheet
        open={trayOpen}
        meal={meal}
        date={date}
        onClose={() => setTrayOpen(false)}
        onLogged={() => {
          setTrayOpen(false);
          goBack('/food');
        }}
      />

      <PortionSheet
        target={target}
        date={date}
        meal={meal}
        onClose={() => setTarget(null)}
        onDone={() => goBack('/food')}
        onOpenFood={(f) => setTarget({ mode: 'add', food: f })}
      />
    </div>
  );
}

function ScanHelp({ cam }: { cam: ReturnType<typeof useBarcodeCamera> }) {
  return (
    <div className="mt-5 flex min-h-[4.5rem] flex-col items-center gap-2 text-center">
      {cam.zoom.steps.length > 0 && (
        <div role="group" aria-label="Zoom" className="flex gap-1 rounded-full bg-black/50 p-1">
          {cam.zoom.steps.map((s) => (
            <button
              key={s.label}
              type="button"
              aria-pressed={cam.zoom.value === s.value}
              onClick={() => void cam.zoom.set(s.value)}
              className={cn(
                'h-9 min-w-11 rounded-full px-2 text-xs font-bold',
                cam.zoom.value === s.value ? 'bg-amber-300 text-black' : 'text-white/80',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {cam.dark && !cam.torch?.on ? (
        <p className="text-sm text-amber-200">
          Too dark to read.{' '}
          {cam.torch ? (
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void cam.torch?.toggle()}>
              Turn on the torch
            </button>
          ) : (
            'Move towards a light.'
          )}
        </p>
      ) : cam.struggling ? (
        <p className="max-w-xs text-sm text-white/80">
          Not reading? Hold the phone a little further back so the bars look sharp
          {cam.cameras.count > 1 ? ', or try the other lens' : ''}. You can also type the number.
        </p>
      ) : (
        <p className="text-sm text-white/70">Fit the barcode in the frame, any way up.</p>
      )}
    </div>
  );
}

function RecentScans({
  foods,
  inbox,
  onFood,
  onInbox,
  onDismiss,
}: {
  foods: Food[];
  inbox: PendingScan[];
  onFood: (f: Food) => void;
  onInbox: (p: PendingScan) => void;
  onDismiss: (p: PendingScan) => void;
}) {
  if (foods.length === 0 && inbox.length === 0) return null;
  return (
    <div>
      <p className="hud-label mb-2 !text-white/60">Recent scans</p>
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {inbox.map((p) => (
          <li key={`p-${p.code}`} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onInbox(p)}
              className="flex h-16 w-44 items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 text-left"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/20 text-amber-200">
                {p.status === 'offline' ? <CloudOff size={18} /> : <PenLine size={18} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.status === 'offline' ? 'Waiting for signal' : 'Needs details'}</span>
                <span className="block truncate text-xs text-white/60 tabular">{p.code}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${p.code} from the scan inbox`}
              onClick={() => onDismiss(p)}
              className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-white/80 ring-1 ring-white/20"
            >
              <X size={14} />
            </button>
          </li>
        ))}
        {foods.map((f) => {
          const p = defaultPortion(f);
          const kcal = nutrientsFor(f, p.amount).energy;
          const rating = healthScore(f);
          return (
            <li key={f.id} className="shrink-0">
              <button type="button" onClick={() => onFood(f)} className="flex h-16 w-48 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-2.5 text-left backdrop-blur">
                <span className="relative shrink-0">
                  <FoodAvatar name={f.name} imageUrl={f.imageUrl} size={40} />
                  {rating && (
                    <span
                      className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-md px-0.5 text-[10px] font-bold text-white ring-2 ring-black tabular"
                      style={{ background: BAND_COLOR[rating.band] }}
                      aria-label={`Health rating ${rating.score}`}
                    >
                      {rating.score}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{f.name}</span>
                  <span className="block truncate text-xs text-white/65">
                    {kcal === undefined ? '— kcal' : `${Math.round(kcal)} kcal`} · {amountLabel(p.amount, f.unit, p.servingLabel)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ManualEntry({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const code = normaliseBarcode(value);
    if (!code) return setError('Enter the 8–14 digits printed under the barcode.');
    if (!isPlausibleBarcode(code)) return setError('That code does not add up. Check each digit against the label.');
    setError('');
    setValue('');
    onCode(code);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Enter barcode" subtitle="The numbers printed under the bars.">
      <form
        className="space-y-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          inputMode="numeric"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 5000159484695"
          className="h-12 w-full rounded-2xl border border-line bg-surface-3/70 px-4 text-[18px] tracking-widest text-text outline-none focus:border-primary"
          aria-label="Barcode number"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" block>
          Look up product
        </Button>
      </form>
    </Sheet>
  );
}

function CameraProblem({ state, onRetry }: { state: Extract<CameraStatus, 'denied' | 'unavailable' | 'insecure'>; onRetry: () => void }) {
  const copy = {
    denied: {
      icon: <ShieldAlert size={36} className="text-amber-300" />,
      title: 'Camera access is blocked',
      text: 'On iPhone: open Settings → Safari → Camera and choose "Ask" or "Allow". If you installed the app, also check Settings → Privacy & Security → Camera. Then try again. You can still type the barcode below.',
    },
    unavailable: {
      icon: <CameraOff size={36} className="text-amber-300" />,
      title: 'Camera unavailable',
      text: 'No camera could be started. Another app may be using it, or this device has no rear camera. You can type the barcode instead.',
    },
    insecure: {
      icon: <ShieldAlert size={36} className="text-amber-300" />,
      title: 'Secure connection required',
      text: 'Browsers only allow camera access on secure (https://) pages. Open the hosted https:// version of NutriTrack to scan. Typing the barcode works everywhere.',
    },
  }[state];
  return (
    <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
      <div className="mx-auto mb-3 w-fit">{copy.icon}</div>
      <p className="font-hud text-xl font-bold">{copy.title}</p>
      <p className="mt-2 text-sm text-white/75">{copy.text}</p>
      {state !== 'insecure' && (
        <Button variant="primary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
