import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Go back one screen, or to `fallback` when this screen was the first one
 * opened (a reload, a deep link or the PWA starting here). React Router keeps
 * its own position in `history.state.idx`, which is reliable where
 * `history.length` is not.
 */
export function useGoBack() {
  const navigate = useNavigate();
  return useCallback(
    (fallback = '/') => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate(fallback, { replace: true });
    },
    [navigate],
  );
}
