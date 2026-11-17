// Status pill of a goal or a project. The three states differ by icon and
// by fill (outlined, accent, primary), not by colour alone.

import type { CSSProperties } from 'react';
import { Check, CircleDashed, CircleDot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProgressStatus } from './progress';

type VisibleStatus = Exclude<ProgressStatus, 'none'>;

const LOOK: Record<VisibleStatus, { key: string; Icon: typeof Check; style: CSSProperties }> = {
  planned: {
    key: 'status.planned',
    Icon: CircleDashed,
    style: {
      backgroundColor: 'var(--theme-colors-background)',
      border: '1px solid var(--theme-colors-border)',
      color: 'var(--theme-colors-text)',
    },
  },
  in_progress: {
    key: 'status.inProgress',
    Icon: CircleDot,
    style: {
      backgroundColor: 'var(--theme-colors-accent)',
      color: 'var(--theme-colors-accentContrast, #fff)',
    },
  },
  completed: {
    key: 'status.completed',
    Icon: Check,
    style: {
      backgroundColor: 'var(--theme-colors-primary)',
      color: 'var(--theme-colors-primaryContrast, #fff)',
    },
  },
};

function lookOf(status: unknown) {
  return status === 'planned' || status === 'in_progress' || status === 'completed' ? LOOK[status] : null;
}

/** True when the status renders a badge (not `none`, missing or unknown). */
export function hasStatusBadge(status: unknown): boolean {
  return lookOf(status) !== null;
}

/** Renders nothing for `none`, a missing or an unknown status. */
export function StatusBadge({ status }: { status: unknown }) {
  // Non-async shared component: the hook works on the server and in the
  // client-rendered builder preview.
  const t = useTranslations('sections');
  const look = lookOf(status);
  if (!look) return null;
  const { Icon } = look;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full"
      style={look.style}
      data-status={status as string}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(look.key)}
    </span>
  );
}
