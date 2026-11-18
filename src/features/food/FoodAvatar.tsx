import { useState } from 'react';
import { cn } from '../../lib/cn';

const HUES = ['var(--primary)', 'var(--gold)', 'var(--success)', 'var(--violet)', 'var(--orange)', 'var(--cyan)'];

/** Product photo when available (cached for offline), otherwise a monogram tile. */
export function FoodAvatar({ name, imageUrl, size = 44, className }: { name: string; imageUrl?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const color = HUES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-xl bg-white object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn('font-hud grid shrink-0 place-items-center rounded-xl text-lg font-bold uppercase', className)}
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      aria-hidden
    >
      {name.trim()[0] ?? '?'}
    </span>
  );
}
