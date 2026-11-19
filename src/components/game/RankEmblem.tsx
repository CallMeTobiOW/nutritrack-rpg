import { useId } from 'react';
import { ICONS } from '../ui/Icon';
import type { TierId } from '../../lib/rank';

/**
 * Competitive rank emblems. Original artwork built on the app's hexagon
 * crest: each tier adds an ornament (chevrons → gem → blades → crown → halo),
 * so the climb is readable at a glance even at small sizes.
 */
export const TIER_PALETTE: Record<TierId, { light: string; mid: string; dark: string }> = {
  bronze: { light: '#f3c09a', mid: '#c27a45', dark: '#6e3a1a' },
  silver: { light: '#f4f7fb', mid: '#a9b4c6', dark: '#556075' },
  gold: { light: '#fff3c4', mid: '#f5c046', dark: '#9a5b08' },
  platinum: { light: '#dffbf6', mid: '#5fd1c1', dark: '#22717a' },
  diamond: { light: '#dcefff', mid: '#5ea2fa', dark: '#1d3fa8' },
  master: { light: '#f4e9ff', mid: '#bd7dfb', dark: '#62219e' },
  grandmaster: { light: '#ffe2e6', mid: '#f7637b', dark: '#931236' },
  zenith: { light: '#fffbea', mid: '#fcd96a', dark: '#f0760f' },
};

/** Tier accent for text, bars and glows. */
export function tierColor(tier: TierId): string {
  return TIER_PALETTE[tier].mid;
}

const TIER_ORDER: TierId[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'zenith'];
const HEX = '50,10 84,30 84,70 50,90 16,70 16,30';
const WING = 'M18 34 L2 26 L8 40 L-2 44 L10 52 L2 60 L16 62 Z';

interface RankEmblemProps {
  tier: TierId;
  /** 5…1, or null for Zenith / unknown. Shown as pips under the crest. */
  division?: number | null;
  size?: number;
  /** Placement: a muted crest with a question mark (or the glyph, muted). */
  unranked?: boolean;
  /** Icon name (see ICONS) drawn in the crest instead of the tier's own glyph: used by badges. */
  glyph?: string;
  /** Accessible name; defaults to the tier. */
  label?: string;
  className?: string;
}

export function RankEmblem({ tier, division = null, size = 64, unranked, glyph, label, className }: RankEmblemProps) {
  // Tier in the id too, so emblems rendered in separate roots never share gradients.
  const id = `${unranked ? 'u' : tier}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const level = TIER_ORDER.indexOf(tier);
  const p = unranked ? { light: '#c3cad8', mid: '#7f8aa3', dark: '#3a4358' } : TIER_PALETTE[tier];
  const g = `url(#re-${id})`;
  const pips = !unranked && division !== null && division !== undefined ? 6 - division : 0;

  return (
    <svg
      viewBox="-10 -6 120 112"
      width={size * 1.2}
      height={size * 1.12}
      className={className}
      role="img"
      aria-label={label ?? (unranked ? 'Unranked: placements in progress' : `${tier} rank emblem`)}
      style={{ filter: unranked ? undefined : `drop-shadow(0 0 ${size / 9}px color-mix(in srgb, ${p.mid} 55%, transparent))`, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`re-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.55" stopColor={p.mid} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
        <radialGradient id={`rf-${id}`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor={p.dark} stopOpacity="0.55" />
          <stop offset="1" stopColor="#0a0f1c" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Zenith halo */}
      {!unranked && level >= 7 &&
        Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI) / 8;
          const r1 = 44;
          const r2 = i % 2 ? 52 : 58;
          return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)} x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)} stroke={g} strokeWidth={i % 2 ? 2.5 : 4} strokeLinecap="round" />;
        })}

      {/* Blades (Platinum+) and second pair (Grandmaster+) */}
      {!unranked && level >= 3 && (
        <g fill={g} stroke={p.dark} strokeWidth="1" strokeLinejoin="round">
          <path d={WING} />
          <path d={WING} transform="translate(100 0) scale(-1 1)" />
          {level >= 6 && (
            <>
              <path d="M18 60 L4 66 L12 70 L6 78 L22 72 Z" />
              <path d="M18 60 L4 66 L12 70 L6 78 L22 72 Z" transform="translate(100 0) scale(-1 1)" />
            </>
          )}
        </g>
      )}

      {/* Crown (Master+) */}
      {!unranked && level >= 5 && (
        <path
          d={level >= 6 ? 'M30 18 L32 2 L40 12 L50 -4 L60 12 L68 2 L70 18 Z' : 'M34 18 L38 4 L45 13 L50 2 L55 13 L62 4 L66 18 Z'}
          fill={g}
          stroke={p.dark}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      )}

      {/* Crest */}
      <polygon points={HEX} fill={`url(#rf-${id})`} stroke={g} strokeWidth="5" strokeLinejoin="round" />
      {!unranked && level >= 1 && <polygon points="50,18 77,34 77,66 50,82 23,66 23,34" fill="none" stroke={g} strokeWidth="1.5" opacity="0.6" />}

      {/* Glyph */}
      {glyph && ICONS[glyph] ? (
        <GlyphIcon name={glyph} stroke={g} />
      ) : unranked ? (
        <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="700" fill={g} fontFamily="Rajdhani, system-ui, sans-serif">
          ?
        </text>
      ) : level <= 2 ? (
        <g fill="none" stroke={g} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          {level >= 2 && <path d="M38 40 L50 31 L62 40" />}
          {level >= 1 && <path d="M36 52 L50 42 L64 52" />}
          <path d="M34 64 L50 53 L66 64" />
        </g>
      ) : level === 3 ? (
        <g stroke={p.dark} strokeWidth="1" strokeLinejoin="round">
          <path d="M50 30 L62 48 L50 68 L38 48 Z" fill={g} />
          <path d="M38 48 H62 M50 30 V68" fill="none" stroke={p.light} strokeOpacity="0.7" />
        </g>
      ) : level === 4 ? (
        <g strokeLinejoin="round">
          <path d="M36 42 L43 32 H57 L64 42 L50 68 Z" fill={g} stroke={p.dark} strokeWidth="1" />
          <path d="M36 42 H64 M43 32 L50 42 L57 32 M43 42 L50 68 L57 42" fill="none" stroke={p.light} strokeOpacity="0.75" strokeWidth="1.2" />
        </g>
      ) : (
        <path
          d="M50 30 L55 44 L70 44 L58 53 L62 68 L50 59 L38 68 L42 53 L30 44 L45 44 Z"
          fill={g}
          stroke={p.dark}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      )}

      {/* Division pips: one lit for division 5, all five for division 1 */}
      {division !== null && division !== undefined && (
        <g>
          {Array.from({ length: 5 }, (_, i) => {
            const cx = 50 + (i - 2) * 11;
            return <path key={i} d={`M${cx} 94 L${cx + 4.5} 99 L${cx} 104 L${cx - 4.5} 99 Z`} fill={i < pips ? g : 'none'} stroke={i < pips ? p.dark : p.mid} strokeOpacity={i < pips ? 1 : 0.5} strokeWidth="1" />;
          })}
        </g>
      )}
    </svg>
  );
}

function GlyphIcon({ name, stroke }: { name: string; stroke: string }) {
  const Glyph = ICONS[name];
  // Lucide draws on a 24-unit grid; place it in the crest's inner hexagon.
  return <Glyph x={33} y={32} width={34} height={34} color={stroke} strokeWidth={2.2} aria-hidden />;
}

/** Tier colour mixed toward the theme's text colour, so labels stay readable in light and dark. */
export function tierTextColor(tier: TierId): string {
  return `color-mix(in srgb, ${TIER_PALETTE[tier].mid} 62%, var(--text))`;
}
