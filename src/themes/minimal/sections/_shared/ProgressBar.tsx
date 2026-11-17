// Static progress bar. The fill starts at the inline start by normal flow,
// so it grows from the right in right-to-left languages. No animation.

interface ProgressBarProps {
  /** Whole percent, 0-100. */
  percent: number;
  /** Spoken value, e.g. "60 of 100 completed". */
  text: string;
  /** Accessible name of the bar. */
  label: string;
  barColor: string;
}

export function ProgressBar({ percent, text, label, barColor }: ProgressBarProps) {
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
      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: barColor }} />
    </div>
  );
}
