import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hud?: boolean;
  padded?: boolean;
}

export function Card({ hud, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div className={cn('panel', hud && 'hud-corners', padded && 'p-4', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2.5 flex items-center gap-3', className)}>
      <h2 className="hud-label shrink-0">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" aria-hidden />
      {action}
    </div>
  );
}
