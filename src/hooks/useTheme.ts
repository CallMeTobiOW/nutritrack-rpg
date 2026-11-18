import { useEffect } from 'react';
import type { ThemePreference } from '../lib/models';

const META_COLORS = { dark: '#070a12', light: '#eef2f8' };

/** Apply the theme to <html data-theme> and keep the iOS status bar colour in sync. */
export function useApplyTheme(pref: ThemePreference) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const theme = pref === 'system' ? (mq.matches ? 'light' : 'dark') : pref;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
      try {
        localStorage.setItem('nt-theme', theme);
      } catch {
        /* private mode */
      }
    };
    apply();
    if (pref === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [pref]);
}
