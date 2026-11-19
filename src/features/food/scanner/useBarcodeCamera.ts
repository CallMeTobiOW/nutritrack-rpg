import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { decodeFrame, loadDecoder } from '../../../lib/scan/decoder';
import { DARK_LUMA, cropForViewfinder, decodeSize, meanLuma } from '../../../lib/scan/frame';
import { ScanConfirmer } from '../../../lib/scan/confirm';
import { initialZoom, isMultiLens, rankBackCameras, zoomSteps, type CameraInfo } from '../../../lib/scan/cameras';

export type CameraStatus = 'starting' | 'live' | 'stopped' | 'denied' | 'unavailable' | 'insecure';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The viewfinder element; only this area of the frame is read. */
  boxRef: RefObject<HTMLElement | null>;
  /** Called once per confirmed barcode. */
  onCode: (code: string) => void;
  /** False pauses reading (the preview stays live), e.g. while a sheet is open. */
  reading: boolean;
}

interface TrackCaps {
  torch?: boolean;
  zoom?: { min: number; max: number };
  focusMode?: string[];
}

const CAMERA_KEY = 'nt-scan-camera';
const MIN_FRAME_GAP_MS = 45;
/**
 * The reader handles codes up to about ±20° off straight (and any multiple of
 * 90°). Every third frame is drawn rotated by ±35° so a diagonal barcode
 * still reads without turning the product.
 */
const FRAME_ANGLES = [0, 0, 35, 0, 0, -35].map((d) => (d * Math.PI) / 180);

function storedCamera(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
}

function storeCamera(id: string) {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    /* private mode */
  }
}

/**
 * Runs the rear camera and reads barcodes from the viewfinder area.
 *
 * Frames are read one at a time (a new read starts when the last finishes),
 * so a slow phone never builds a backlog. Also tracks brightness so the UI
 * can suggest the torch, and exposes torch, zoom and lens switching where
 * the browser supports them.
 */
export function useBarcodeCamera({ videoRef, boxRef, onCode, reading }: Options) {
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [torchOn, setTorchOn] = useState(false);
  const [caps, setCaps] = useState<TrackCaps>({});
  const [zoom, setZoomState] = useState<number | undefined>();
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [struggling, setStruggling] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const confirmer = useRef(new ScanConfirmer());
  const readingRef = useRef(reading);
  const onCodeRef = useRef(onCode);
  const loopRef = useRef<{ stop: () => void } | null>(null);
  const startToken = useRef(0);
  const lumaRef = useRef(128);
  const searchingSince = useRef(0);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    readingRef.current = reading;
    confirmer.current.clearPartial();
    searchingSince.current = performance.now();
  }, [reading]);

  const track = () => streamRef.current?.getVideoTracks()[0];

  const stop = useCallback(() => {
    startToken.current++;
    loopRef.current?.stop();
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
  }, [videoRef]);

  const runLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    let stopped = false;
    let busy = false;
    let last = 0;
    let darkSince = 0;
    let frame = 0;
    searchingSince.current = performance.now();

    const schedule = () => {
      if (stopped) return;
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => void tick());
      else requestAnimationFrame(() => void tick());
    };

    const tick = async () => {
      if (stopped) return;
      const now = performance.now();
      if (busy || !readingRef.current || now - last < MIN_FRAME_GAP_MS || video.readyState < 2 || !video.videoWidth) {
        schedule();
        return;
      }
      busy = true;
      last = now;
      try {
        const box = boxRef.current?.getBoundingClientRect();
        const view = video.getBoundingClientRect();
        const area = box
          ? { x: box.left - view.left, y: box.top - view.top, width: box.width, height: box.height }
          : { x: view.width * 0.1, y: view.height * 0.3, width: view.width * 0.8, height: view.height * 0.4 };
        const crop = cropForViewfinder({ width: video.videoWidth, height: video.videoHeight }, view, area);
        if (crop.width > 16 && crop.height > 16) {
          const size = decodeSize(crop);
          if (canvas.width !== size.width) canvas.width = size.width;
          if (canvas.height !== size.height) canvas.height = size.height;
          const angle = FRAME_ANGLES[frame++ % FRAME_ANGLES.length];
          if (angle) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, size.width, size.height);
            ctx.translate(size.width / 2, size.height / 2);
            ctx.rotate(angle);
            ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, -size.width / 2, -size.height / 2, size.width, size.height);
            ctx.restore();
          } else {
            ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height);
          }
          const image = ctx.getImageData(0, 0, size.width, size.height);

          // Smoothed brightness, so one dark frame does not flash the hint.
          lumaRef.current = lumaRef.current * 0.8 + meanLuma(image.data) * 0.2;
          const isDark = lumaRef.current < DARK_LUMA;
          if (isDark && !darkSince) darkSince = now;
          if (!isDark) darkSince = 0;
          setDark(isDark && now - darkSince > 1200);

          const codes = await decodeFrame(image);
          if (stopped) return;
          const t = performance.now();
          for (const raw of codes) {
            const code = confirmer.current.push(raw, t);
            if (code && readingRef.current) {
              searchingSince.current = t;
              setStruggling(false);
              onCodeRef.current(code);
              break;
            }
          }
          setStruggling(t - searchingSince.current > 9000);
        }
      } catch {
        /* a failed frame is skipped; the next one is tried */
      } finally {
        busy = false;
        schedule();
      }
    };

    schedule();
    loopRef.current = {
      stop: () => {
        stopped = true;
      },
    };
  }, [boxRef, videoRef]);

  const applyTrackSettings = useCallback(async (label: string) => {
    const t = track();
    if (!t) return;
    const c = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & TrackCaps;
    const next: TrackCaps = {
      torch: c.torch === true,
      zoom: c.zoom && typeof c.zoom === 'object' ? { min: c.zoom.min ?? 1, max: c.zoom.max ?? 1 } : undefined,
      focusMode: Array.isArray(c.focusMode) ? c.focusMode : undefined,
    };
    setCaps(next);
    const advanced: Record<string, unknown> = {};
    if (next.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
    const z = initialZoom(next.zoom, isMultiLens(label));
    if (z !== undefined) advanced.zoom = z;
    if (Object.keys(advanced).length) {
      try {
        await t.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
      } catch {
        /* not supported: keep defaults */
      }
    }
    const s = t.getSettings() as MediaTrackSettings & { zoom?: number };
    setZoomState(s.zoom ?? z);
  }, []);

  const startRef = useRef<(deviceId?: string) => Promise<void>>(async () => undefined);
  const start = useCallback(
    async (deviceId?: string): Promise<void> => {
      stop();
      const token = startToken.current;
      if (!window.isSecureContext) return setStatus('insecure');
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable');
      setStatus('starting');
      void loadDecoder().catch(() => undefined); // compile while the camera warms up
      const wanted = deviceId ?? storedCamera() ?? undefined;
      const video = (id?: string): MediaTrackConstraints => ({
        ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' } }),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      });
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: video(wanted) });
        } catch (e) {
          if (!wanted || (e as Error).name === 'NotAllowedError') throw e;
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: video() }); // saved camera gone
        }
        if (token !== startToken.current) return stream.getTracks().forEach((t) => t.stop());

        // Labels are only visible after permission, so pick the best lens now.
        const list = rankBackCameras(
          (await navigator.mediaDevices.enumerateDevices())
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label })),
        );
        if (token !== startToken.current) return stream.getTracks().forEach((t) => t.stop());
        setCameras(list);
        const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (!wanted && list[0] && currentId && list[0].deviceId !== currentId) {
          stream.getTracks().forEach((t) => t.stop());
          return void startRef.current(list[0].deviceId);
        }

        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return stop();
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        if (token !== startToken.current) return;
        const label = list.find((d) => d.deviceId === currentId)?.label ?? stream.getVideoTracks()[0]?.label ?? '';
        setCameraId(currentId ?? null);
        await applyTrackSettings(label);
        setStatus('live');
        runLoop();
      } catch (e) {
        if (token !== startToken.current) return;
        const name = (e as Error).name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    },
    [applyTrackSettings, runLoop, stop, videoRef],
  );
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Start on mount; release the camera when hidden and pick it back up on return.
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => (alive ? start() : undefined)); // after mount, so the video element is attached
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        setStatus('stopped');
      } else void start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [start, stop]);

  const toggleTorch = useCallback(async () => {
    const t = track();
    if (!t) return;
    const next = !torchOn;
    try {
      await t.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      /* torch busy or unsupported */
    }
  }, [torchOn]);

  const setZoom = useCallback(async (value: number) => {
    const t = track();
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
      setZoomState(value);
    } catch {
      /* unsupported */
    }
  }, []);

  const label = cameras.find((c) => c.deviceId === cameraId)?.label ?? '';
  const nextCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.deviceId === cameraId);
    const next = cameras[(i + 1) % cameras.length];
    storeCamera(next.deviceId);
    void start(next.deviceId);
  }, [cameraId, cameras, start]);

  return {
    status,
    restart: () => void start(),
    torch: caps.torch ? { on: torchOn, toggle: toggleTorch } : null,
    zoom: { steps: zoomSteps(caps.zoom, isMultiLens(label)), value: zoom, set: setZoom },
    cameras: { count: cameras.length, label, next: nextCamera },
    dark,
    struggling,
  };
}
