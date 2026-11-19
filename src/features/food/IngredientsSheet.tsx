import { useMemo, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { setIngredients } from '../../db/actions';
import { additiveInfo } from '../../lib/additives';
import { analyseIngredients } from '../../lib/ingredients';
import type { Food } from '../../lib/models';
import { readTextFromImage } from '../../lib/scan/ocr';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';

interface Props {
  food: Food | null;
  onClose: () => void;
}

type Reading = { state: 'idle' } | { state: 'reading'; progress: number } | { state: 'error'; message: string };

/**
 * Add a product's ingredients by photographing the list on the pack (read
 * on the phone) or typing it. The app then works out additives and
 * processing from it, and the health rating updates.
 */
export function IngredientsSheet({ food, onClose }: Props) {
  // The parent re-mounts this sheet per food (key), so state starts from the food.
  const [text, setText] = useState(() =>
    food?.quality?.ingredientsFrom && food.quality.ingredientsFrom !== 'off' ? (food.quality.ingredients ?? '') : '',
  );
  const [reading, setReading] = useState<Reading>({ state: 'idle' });
  const [from, setFrom] = useState<'photo' | 'typed'>(food?.quality?.ingredientsFrom === 'photo' ? 'photo' : 'typed');
  const [busy, setBusy] = useState(false);

  const analysis = useMemo(() => analyseIngredients(text), [text]);
  const flagged = (analysis?.additives ?? []).flatMap((c) => additiveInfo(c) ?? []);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setReading({ state: 'reading', progress: 0 });
    try {
      const result = await readTextFromImage(file, (p) => setReading({ state: 'reading', progress: p }));
      const clean = result.replace(/\n{2,}/g, '\n').trim();
      if (clean.length < 5) {
        setReading({ state: 'error', message: 'No text found. Get closer so the ingredients fill the photo, with good light and no glare.' });
        return;
      }
      setText(clean);
      setFrom('photo');
      setReading({ state: 'idle' });
    } catch {
      setReading({
        state: 'error',
        message: navigator.onLine === false ? 'The text reader needs a connection the first time. You can type the ingredients instead.' : 'Couldn’t read the photo. Try again, or type the ingredients.',
      });
    }
  };

  const save = async () => {
    if (!food) return;
    setBusy(true);
    try {
      await setIngredients(food.id, text, from);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!food}
      onClose={onClose}
      title="Add the ingredients"
      subtitle="So processing and additives count towards the rating."
      footer={
        <Button variant="primary" block disabled={busy || text.trim().length < 3 || reading.state === 'reading'} onClick={() => void save()}>
          Save ingredients
        </Button>
      }
    >
      <div className="space-y-3 py-1">
        <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#0369a1] to-[#2563eb] font-semibold text-white">
          <Camera size={18} /> Photograph the ingredients list
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {reading.state === 'reading' && (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <Loader2 size={16} className="animate-spin text-primary" />
            Reading the label{reading.progress > 0 ? ` · ${Math.round(reading.progress * 100)}%` : '…'}
          </p>
        )}
        {reading.state === 'error' && <p className="text-sm text-orange">{reading.message}</p>}
        <p className="text-xs text-faint">The photo is read on your phone and never uploaded. Check the text below and fix any misread words.</p>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (reading.state !== 'reading' && from !== 'photo') setFrom('typed');
          }}
          rows={6}
          placeholder="Or type them: Sugar, glucose syrup, gelatine, citric acid, flavourings, colours (E129, E133)…"
          aria-label="Ingredients"
          className="w-full rounded-2xl border border-line bg-surface-3/70 p-3 text-[16px] leading-snug text-text outline-none focus:border-primary"
        />

        {analysis && (
          <div className="rounded-2xl border border-line bg-surface-3/40 p-3 text-sm">
            <p className="font-semibold">
              {analysis.nova === 4 ? 'Ultra-processed' : analysis.nova === 3 ? 'Processed' : 'Unprocessed or minimally processed'}
            </p>
            {analysis.markers.length > 0 && <p className="text-muted">Because of: {analysis.markers.join(', ')}</p>}
            <p className="mt-1 text-muted">
              {flagged.length > 0 ? `Additives to know about: ${flagged.map((a) => a.name).join(', ')}` : 'No additives of concern found.'}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
