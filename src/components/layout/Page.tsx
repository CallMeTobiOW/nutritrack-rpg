import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Standard scrolling page with safe-area padding and room for the tab bar. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main
      className={cn(
        'animate-fade-in mx-auto w-full px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
        wide ? 'max-w-3xl' : 'max-w-lg',
        className,
      )}
    >
      {children}
    </main>
  );
}
