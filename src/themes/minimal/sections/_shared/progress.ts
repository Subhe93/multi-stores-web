// Progress of a goal, computed from two numbers the owner enters. There is
// no typed percentage anywhere: the bar always follows `reached / goal`.

export type ProgressStatus = 'none' | 'planned' | 'in_progress' | 'completed';

const STATUSES: readonly ProgressStatus[] = ['none', 'planned', 'in_progress', 'completed'];

/** Stored status; unset or unknown reads as `fallback`. */
export function statusValue(raw: unknown, fallback: ProgressStatus = 'none'): ProgressStatus {
  return typeof raw === 'string' && (STATUSES as readonly string[]).includes(raw)
    ? (raw as ProgressStatus)
    : fallback;
}

export interface ProgressInput {
  goal: unknown;
  reached: unknown;
  status: unknown;
  /** The `show_progress` setting; only the literal `true` shows the bar. */
  show: unknown;
}

export interface ProgressResult {
  /** Null when no valid goal (a finite number above 0) is set. */
  goal: number | null;
  reached: number;
  /** Whole percent, 0-100; null without a goal. */
  percent: number | null;
  showBar: boolean;
}

// A stored number. A numeric string counts as its number; a blank one does not.
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function computeProgress({ goal, reached, status, show }: ProgressInput): ProgressResult {
  const g = toNumber(goal);
  const validGoal = g !== null && g > 0 ? g : null;
  const r = toNumber(reached);
  const validReached = r !== null && r >= 0 ? r : 0;
  // Floor: 100 appears only once the goal is really met.
  const percent = validGoal ? Math.min(100, Math.floor((validReached / validGoal) * 100)) : null;
  return {
    goal: validGoal,
    reached: validReached,
    percent,
    // A planned goal has no progress to show. `completed` leaves the numbers alone.
    showBar: show === true && validGoal !== null && status !== 'planned',
  };
}
