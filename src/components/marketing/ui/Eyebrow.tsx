import type { ReactNode } from 'react';

/** Small spaced uppercase label that opens a section. */
export function Eyebrow({ children, tone = 'teal', className = '' }: { children: ReactNode; tone?: 'teal' | 'amber' | 'ivory'; className?: string }) {
  return (
    <span className={`sd-eyebrow sd-eyebrow-${tone} ${className}`.trim()}>
      <span className="sd-eyebrow-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
