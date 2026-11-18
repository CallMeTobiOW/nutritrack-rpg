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

/** Bottom sheet dialog, the main modal surface on mobile. */
export function Sheet({ open, onClose, title, subtitle, children, footer, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-[var(--backdrop)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
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
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
        {(title || subtitle) && (
          <div className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-3">
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
