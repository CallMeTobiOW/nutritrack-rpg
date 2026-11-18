import { NavLink } from 'react-router-dom';
import { FlaskConical, House, ScrollText, UserRound, Utensils } from 'lucide-react';
import { cn } from '../../lib/cn';

const TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/food', label: 'Food', icon: Utensils },
  { to: '/nutrition', label: 'Nutrition', icon: FlaskConical },
  { to: '/quests', label: 'Quests', icon: ScrollText },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl pb-safe"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-16 flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-primary' : 'text-faint hover:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute top-0 h-[2px] w-8 rounded-full bg-primary transition-opacity',
                      isActive ? 'opacity-100 shadow-[0_0_12px_var(--primary)]' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <Icon size={22} strokeWidth={isActive ? 2.3 : 1.9} className={cn(isActive && 'drop-shadow-[0_0_8px_var(--primary)]')} />
                  <span className="font-hud text-[11px] font-semibold uppercase tracking-wider">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
