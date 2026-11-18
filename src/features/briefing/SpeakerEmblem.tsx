import { useId } from 'react';
import { Flame, Lamp, Rocket, Swords } from 'lucide-react';
import { SPEAKERS, type BriefingCategory } from '../../data/briefings';

const GLYPHS = { fantasy: Flame, commander: Rocket, warrior: Swords, mentor: Lamp } as const;

/** Original hexagonal crest for each briefing voice. */
export function SpeakerEmblem({ category, size = 56 }: { category: BriefingCategory; size?: number }) {
  const id = useId().replace(/:/g, '');
  const accent = SPEAKERS[category].accent;
  const Glyph = GLYPHS[category];
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" style={{ filter: `drop-shadow(0 0 ${size / 6}px ${accent}66)` }}>
        <defs>
          <linearGradient id={`e-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="1" stopColor={accent} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="var(--surface-2)" stroke={`url(#e-${id})`} strokeWidth="4" />
        <polygon points="50,15 82,33 82,67 50,85 18,67 18,33" fill="none" stroke={accent} strokeOpacity="0.25" strokeWidth="1.5" />
      </svg>
      <Glyph size={size * 0.42} color={accent} strokeWidth={2} className="relative" />
    </div>
  );
}
