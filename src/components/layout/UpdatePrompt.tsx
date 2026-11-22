import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const RELOAD_KEY = 'nutritrack-update-reloaded-at';
/** Never reload twice within this window, so a misbehaving worker can't cause a loop. */
const RELOAD_COOLDOWN_MS = 30_000;

function isTyping(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function reload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: reload anyway, once per controller change.
  }
  window.location.reload();
}

/**
 * Applies new versions automatically. The service worker activates itself as
 * soon as it has downloaded the new files; once it takes control we reload so
 * the page runs the new code. If the user is typing, we wait until they leave
 * the field or send the app to the background. User data in IndexedDB is not
 * touched by any of this.
 */
export function UpdatePrompt() {
  useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => void reg.update().catch(() => undefined);
      // Check hourly while open, and whenever the app comes back to the foreground
      // (an iPhone home-screen app is resumed, not relaunched).
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // No controller yet means this is the first install, not an update.
    let hadController = Boolean(navigator.serviceWorker.controller);
    let pending = false;

    const tryReload = () => {
      if (!pending) return;
      if (document.visibilityState === 'hidden' || !isTyping()) reload();
    };
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      pending = true;
      tryReload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('focusout', tryReload);
    document.addEventListener('visibilitychange', tryReload);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('focusout', tryReload);
      document.removeEventListener('visibilitychange', tryReload);
    };
  }, []);

  return null;
}
