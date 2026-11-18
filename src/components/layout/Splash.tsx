import { AppEmblem } from '../ui/AppEmblem';

export function Splash({ error }: { error?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <AppEmblem size={84} className="mx-auto animate-pulse-glow" />
        <p className="font-hud mt-5 text-2xl font-bold tracking-[0.2em]">NUTRITRACK</p>
        {error ? (
          <p className="mt-3 max-w-xs text-sm text-danger">
            {error} If you are in a private browsing window, open the app in a normal Safari tab instead.
          </p>
        ) : (
          <p className="hud-label mt-2">Loading your campaign…</p>
        )}
      </div>
    </div>
  );
}
