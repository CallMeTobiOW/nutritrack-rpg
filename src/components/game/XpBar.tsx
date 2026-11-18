import type { LevelInfo } from '../../lib/xp';
import { ProgressBar } from '../ui/ProgressBar';

export function XpBar({ level, showNumbers = true }: { level: LevelInfo; showNumbers?: boolean }) {
  return (
    <div>
      <ProgressBar value={level.ratio} color="var(--gold)" to="var(--orange)" height={8} label="Experience to next level" />
      {showNumbers && (
        <div className="mt-1.5 flex justify-between text-xs text-muted tabular">
          <span>
            {level.intoLevel.toLocaleString()} / {level.needed.toLocaleString()} XP
          </span>
          <span>{level.remaining.toLocaleString()} XP to level {level.level + 1}</span>
        </div>
      )}
    </div>
  );
}
