import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

let openSheets = 0;

const DISMISS_DISTANCE = 110; // px dragged down before release closes the sheet
const DISMISS_VELOCITY = 0.6; // px/ms flick speed that closes it regardless of distance
const DRAG_SLOP = 6; // px before a touch on the content counts as a drag

/**
 * Swipe-down-to-dismiss. A drag starting on the grab handle / title area always
 * moves the sheet; a drag starting in the content only does when that content is
 * scrolled to the top, so scrolling the form never closes the sheet by accident.
 * Uses native touch listeners (non-passive) so iOS lets us cancel the scroll.
 */
function useSwipeToDismiss(open: boolean, panelRef: React.RefObject<HTMLDivElement | null>, backdropRef: React.RefObject<HTMLDivElement | null>, onCloseRef: React.RefObject<() => void>) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let mode: 'none' | 'handle' | 'content' | 'dragging' = 'none';
    let dy = 0;

    const setOffset = (y: number, animate: boolean) => {
      panel.style.animation = 'none';
      panel.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.9, 0.25, 1)' : 'none';
      panel.style.transform = y ? `translateY(${y}px)` : '';
      if (backdropRef.current) {
        backdropRef.current.style.transition = animate ? 'opacity 0.22s' : 'none';
        backdropRef.current.style.opacity = String(Math.max(0, 1 - y / (panel.offsetHeight || 1)));
      }
    };

    /** True if something between the touch target and the panel is scrolled down. */
    const scrolledAncestor = (el: HTMLElement | null) => {
      for (let n = el; n && n !== panel; n = n.parentElement) {
        if (n.scrollTop > 0) return true;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      velocity = 0;
      dy = 0;
      if (target?.closest('[data-sheet-drag]')) mode = 'handle';
      else if (!scrolledAncestor(target)) mode = 'content';
      else mode = 'none';
    };

    const onMove = (e: TouchEvent) => {
      if (mode === 'none') return;
      const y = e.touches[0].clientY;
      dy = y - startY;
      if (mode === 'content' || mode === 'handle') {
        if (dy < -DRAG_SLOP && mode === 'content') {
          mode = 'none'; // scrolling up through the content: not ours
          return;
        }
        if (dy > DRAG_SLOP) mode = 'dragging';
        else return;
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = e.timeStamp;
      setOffset(Math.max(0, dy), false);
    };

    const onEnd = () => {
      if (mode !== 'dragging') {
        mode = 'none';
        return;
      }
      mode = 'none';
      if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
        setOffset(panel.offsetHeight, true);
        window.setTimeout(() => onCloseRef.current?.(), 200);
      } else {
        setOffset(0, true);
      }
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [open, panelRef, backdropRef, onCloseRef]);
}

/** Bottom sheet dialog, the main modal surface on mobile. */
export function Sheet({ open, onClose, title, subtitle, children, footer, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openSheets++;
    document.documentElement.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      openSheets--;
      if (openSheets === 0) document.documentElement.style.overflow = '';
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useSwipeToDismiss(open, panelRef, backdropRef, onCloseRef);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div ref={backdropRef} className="animate-fade-in absolute inset-0 bg-[var(--backdrop)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'animate-sheet-up relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[1.75rem] border border-b-0 border-line-strong bg-surface-2 shadow-2xl outline-none',
          className,
        )}
      >
        <div data-sheet-drag className="shrink-0 cursor-grab touch-none py-2.5">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
        </div>
        {(title || subtitle) && (
          <div data-sheet-drag className="flex shrink-0 items-start gap-3 px-5 pb-2">
            <div className="min-w-0 flex-1">
              {title && <h2 className="font-hud text-xl font-bold leading-tight">{title}</h2>}
              {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
              <X size={20} />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}
