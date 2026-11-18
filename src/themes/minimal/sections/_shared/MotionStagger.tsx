// Grid / list entrance that follows the store motion style.
//
// Without the section's `motion` prop these two render exactly today's
// StaggerGroup / StaggerItem (same elements, same attributes). With it they
// render a plain div carrying the cards-stagger recipe, so the engine arms
// the items row by row and the legacy stagger never runs beside it.
//
// No hooks: usable from server and client components.

import type { CSSProperties, ReactNode } from 'react';
import { StaggerGroup, StaggerItem } from '../../../_motion';
import { item, rise, stagger, type MotionProp } from '../../../creative/recipes';

interface GroupProps {
  motion: MotionProp;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function MotionGroup({ motion, className, style, children }: GroupProps) {
  if (!motion) {
    return (
      <StaggerGroup className={className} style={style}>
        {children}
      </StaggerGroup>
    );
  }
  return (
    <div className={className} style={style} {...stagger(motion)}>
      {children}
    </div>
  );
}

/**
 * A block that rises as one. Without `motion` the children are returned as
 * they are (no wrapper element).
 */
export function MotionRise({
  motion,
  i,
  d,
  className,
  children,
}: {
  motion: MotionProp;
  /** Step in the section's sequence (0.09 s each). */
  i?: number;
  /** Extra delay in tenths of a second. */
  d?: number;
  className?: string;
  children: ReactNode;
}) {
  if (!motion) return <>{children}</>;
  return (
    <div className={className} {...rise(motion, { i, d })}>
      {children}
    </div>
  );
}

interface ItemProps {
  motion: MotionProp;
  /** Place of the item in its list. */
  index: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function MotionItem({ motion, index, className, style, children }: ItemProps) {
  if (!motion) {
    return (
      <StaggerItem className={className} style={style}>
        {children}
      </StaggerItem>
    );
  }
  return (
    <div className={className} style={style} {...item(motion, index)}>
      {children}
    </div>
  );
}
