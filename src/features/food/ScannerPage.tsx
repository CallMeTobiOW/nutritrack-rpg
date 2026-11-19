import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CameraOff, ChevronLeft, Flashlight, Keyboard, Loader2, PackageSearch, RotateCcw, ShieldAlert } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { db } from '../../db/db';
import { useToday } from '../../hooks/useToday';
import { useGoBack } from '../../hooks/useGoBack';
import type { Food } from '../../lib/models';
import { barcodeCandidates, isPlausibleBarcode, lookupBarcode, normaliseBarcode, OffError } from '../../lib/openFoodFacts';
import { sfx } from '../../lib/sound';
import { Button, IconButton } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { useMealParam } from './AddFoodPage';
import { PortionSheet, type PortionTarget } from './PortionSheet';

type CameraState = 'starting' | 'scanning' | 'paused' | 'denied' | 'unavailable' | 'insecure';
type Lookup =
  | { state: 'idle' }
  | { state: 'loading'; code: string }
  | { state: 'notfound'; code: string }
  | { state: 'error'; code: string; message: string };

async function findLocal(code: string): Promise<Food | undefined> {
  for (const c of barcodeCandidates(code)) {
    const f = await db.foods.where('barcode').equals(c).first();
    if (f) return f;
  }
  return undefined;
}

/**
 * Camera barcode scanner (EAN-13, EAN-8, UPC-A, UPC-E) using ZXing.
 * The camera only works on HTTPS (or localhost) — iOS requirement.
 */
export default function ScannerPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const today = useToday();
  const [params] = useSearchParams();
  const date = params.get('date') ?? today;
  const meal = useMealParam();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [target, setTarget] = useState<PortionTarget | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setTorch(null);
  }, []);

  const handleCode = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      stopCamera();
      setCamera('paused');
      sfx.tick();
      setLookup({ state: 'loading', code });
      try {
        const local = await findLocal(code);
        if (local) {
          setLookup({ state: 'idle' });
          setTarget({ mode: 'add', food: local, scanned: true });
          return;
        }
        const remote = await lookupBarcode(code);
        if (remote) {
          setLookup({ state: 'idle' });
          setTarget({ mode: 'add', food: remote, scanned: true });
        } else {
          setLookup({ state: 'notfound', code });
        }
      } catch (e) {
        setLookup({ state: 'error', code, message: e instanceof OffError ? e.message : 'Lookup failed. Check your connection.' });
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(async () => {
    busyRef.current = false;
    setLookup({ state: 'idle' });
    if (!window.isSecureContext) {
      setCamera('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    setCamera('starting');
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80, delayBetweenScanSuccess: 600 });
      if (!videoRef.current) return;
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result) => {
          if (result) void handleCode(result.getText());
        },
      );
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setTorch(controls.switchTorch ? false : null);
      setCamera('scanning');
    } catch (e) {
      const name = (e as Error).name;
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, [handleCode]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
        setCamera('paused');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      mountedRef.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const resume = () => {
    setTarget(null);
    void startCamera();
  };

  const submitManual = () => {
    const code = normaliseBarcode(manualCode);
    if (!code) {
      setManualError('Enter the 8–14 digits printed under the barcode.');
      return;
    }
    if (!isPlausibleBarcode(code)) {
      setManualError('That code does not add up. Check each digit against the label.');
      return;
    }
    setManualError('');
    setManual(false);
    setManualCode('');
    void handleCode(code);
  };

  const ctx = `meal=${meal}&date=${date}`;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay aria-hidden />

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <IconButton label="Back" onClick={() => goBack('/food')} className="text-white hover:bg-white/10 hover:text-white">
          <ChevronLeft size={26} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="hud-label !text-[10px] !text-sky-300">Field scanner</p>
          <p className="font-hud text-lg font-bold leading-tight">Scan a barcode</p>
        </div>
        {torch !== null && (
          <IconButton
            label={torch ? 'Turn torch off' : 'Turn torch on'}
            className={torch ? 'bg-amber-300/20 text-amber-300' : 'text-white hover:bg-white/10 hover:text-white'}
            onClick={async () => {
              await controlsRef.current?.switchTorch?.(!torch);
              setTorch(!torch);
            }}
          >
            <Flashlight size={20} />
          </IconButton>
        )}
      </div>

      {/* Viewfinder */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-8">
        {camera === 'scanning' && (
          <div className="relative aspect-[1.6] w-full max-w-sm">
            <div className="absolute inset-0 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            {['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl'].map((c) => (
              <span key={c} className={`absolute h-10 w-10 border-sky-400 drop-shadow-[0_0_8px_#38bdf8] ${c}`} />
            ))}
            <span className="absolute inset-x-6 top-1/2 h-0.5 rounded-full bg-sky-400 shadow-[0_0_14px_#38bdf8] [animation:scan-line_1.8s_ease-in-out_infinite]" />
          </div>
        )}
        {camera === 'starting' && (
          <p className="flex items-center gap-2 text-white/80">
            <Loader2 className="animate-spin" size={20} /> Starting camera…
          </p>
        )}
        {(camera === 'denied' || camera === 'unavailable' || camera === 'insecure') && <CameraProblem state={camera} onRetry={() => void startCamera()} />}
        {camera === 'paused' && lookup.state === 'loading' && (
          <div className="text-center">
            <Loader2 className="mx-auto animate-spin text-sky-400" size={36} />
            <p className="mt-3 font-semibold">Looking up {lookup.code}…</p>
          </div>
        )}
        {camera === 'paused' && lookup.state === 'idle' && !target && (
          <Button variant="primary" onClick={resume}>
            <RotateCcw size={18} /> Resume scanning
          </Button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 space-y-3 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        {camera === 'scanning' && <p className="text-center text-sm text-white/75">Line the barcode up inside the frame. Hold steady about 15 cm away.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button className="!border-white/15 !bg-white/10 !text-white" onClick={() => setManual(true)}>
            <Keyboard size={18} /> Type barcode
          </Button>
          <Button className="!border-white/15 !bg-white/10 !text-white" onClick={() => navigate(`/food/add?${ctx}`, { replace: true })}>
            <PackageSearch size={18} /> Search
          </Button>
        </div>
      </div>

      <Sheet open={manual} onClose={() => setManual(false)} title="Enter barcode" subtitle="The numbers printed under the bars.">
        <form
          className="space-y-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitManual();
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            enterKeyHint="search"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. 5000159484695"
            className="h-12 w-full rounded-2xl border border-line bg-surface-3/70 px-4 text-[18px] tracking-widest text-text outline-none focus:border-primary"
            aria-label="Barcode number"
          />
          {manualError && <p className="text-sm text-danger">{manualError}</p>}
          <Button type="submit" variant="primary" block>
            Look up product
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={lookup.state === 'notfound' || lookup.state === 'error'}
        onClose={resume}
        title={lookup.state === 'notfound' ? 'Product not found' : 'Lookup failed'}
        subtitle={'code' in lookup ? `Barcode ${lookup.code}` : undefined}
      >
        <div className="space-y-3 py-2">
          <p className="text-muted">
            {lookup.state === 'notfound'
              ? 'This product is not in Open Food Facts yet. Add it as a custom food: copy the values from the label once, and it will be recognised whenever you scan it again.'
              : lookup.state === 'error'
                ? `${lookup.message} Foods you have scanned before still work offline.`
                : ''}
          </p>
          {'code' in lookup && (
            <Button variant="primary" block onClick={() => navigate(`/food/custom?${ctx}&barcode=${lookup.code}`, { replace: true })}>
              Create custom food
            </Button>
          )}
          {lookup.state === 'error' && 'code' in lookup && (
            <Button
              block
              onClick={() => {
                busyRef.current = false;
                void handleCode(lookup.code);
              }}
            >
              Try again
            </Button>
          )}
          <Button variant="ghost" block onClick={resume}>
            Scan another
          </Button>
        </div>
      </Sheet>

      <PortionSheet target={target} date={date} meal={meal} onClose={resume} onDone={() => goBack('/food')} />
    </div>
  );
}

function CameraProblem({ state, onRetry }: { state: 'denied' | 'unavailable' | 'insecure'; onRetry: () => void }) {
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
