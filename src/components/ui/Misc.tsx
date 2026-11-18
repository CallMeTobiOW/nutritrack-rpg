import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useGoBack } from '../../hooks/useGoBack';
import { IconButton } from './Button';

export function PageHeader({
  title,
  kicker,
  back,
  actions,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  return (
    <header className="flex items-end gap-2 pb-4 pt-3">
      {back && (
        <IconButton
          label="Back"
          className="-ml-2 mb-0.5"
          onClick={() => (typeof back === 'string' ? navigate(back) : goBack('/'))}
        >
          <ChevronLeft size={24} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <div className="hud-label mb-0.5 text-primary">{kicker}</div>}
        <h1 className="font-hud truncate text-[28px] font-bold leading-none tracking-wide">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      {icon && <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-3 text-primary">{icon}</div>}
      <p className="font-hud text-lg font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Chip({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider', className)}
      style={{
        color: color ?? 'var(--muted)',
        borderColor: `color-mix(in srgb, ${color ?? 'var(--muted)'} 35%, transparent)`,
        background: `color-mix(in srgb, ${color ?? 'var(--muted)'} 10%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="hud-label !text-[10px]">{label}</div>
      <div className="font-hud tabular truncate text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 py-3 text-left', onClick && 'transition-colors active:opacity-70', className)}
    >
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-primary">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {trailing}
    </Tag>
  );
}
