import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

/** Shows a small banner when a new version of the app has been downloaded. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates hourly while the app is open.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="animate-fade-up fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-2xl">
      <RefreshCw size={20} className="ml-1 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">A new version of NutriTrack is ready.</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
        Update
      </Button>
    </div>
  );
}
