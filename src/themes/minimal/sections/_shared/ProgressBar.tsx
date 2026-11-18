// Static progress bar. The fill starts at the inline start by normal flow,
// so it grows from the right in right-to-left languages. No animation of its
// own; with the store motion style (`motion`) the fill draws once from the
// inline start when it enters. Its width is always the real value in the
// markup (the entrance is a scale), and aria-valuenow never changes.

import { line, type MotionProp } from '../../../creative/recipes';

interface ProgressBarProps {
  /** Whole percent, 0-100. */
  percent: number;
  /** Spoken value, e.g. "60 of 100 completed". */
  text: string;
  /** Accessible name of the bar. */
  label: string;
  barColor: string;
  /** The section's motion prop. Unset = the static bar. */
  motion?: MotionProp;
}

export function ProgressBar({ percent, text, label, barColor, motion }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={text}
      aria-label={label}
      className="h-2 w-full rounded-full overflow-hidden"
      style={{ backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}
    >
      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: barColor }} {...line(motion, { d: 3 })} />
    </div>
  );
}
