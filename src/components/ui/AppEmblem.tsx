import { useId } from 'react';

/**
 * The NutriTrack crest: a hexagonal frame with two rising rank chevrons and
 * a gem — progression, discipline and reward. Original artwork.
 */
export function AppEmblem({ size = 64, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`hex-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#glow-${id})`}>
        <polygon points="256,62 424,159 424,353 256,450 88,353 88,159" fill="none" stroke={`url(#hex-${id})`} strokeWidth="22" strokeLinejoin="round" />
        <path d="M166 296 L256 214 L346 296" fill="none" stroke={`url(#gold-${id})`} strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M186 356 L256 294 L326 356" fill="none" stroke={`url(#hex-${id})`} strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M256 116 L284 150 L256 184 L228 150 Z" fill={`url(#gold-${id})`} />
      </g>
    </svg>
  );
}
