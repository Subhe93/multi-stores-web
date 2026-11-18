// STUB (owner: B3). Decorative background pattern (dots, particles, glow),
// CSS only (contract 4.10). Also used by hero-outline and stage-scenes. The
// foundation renders nothing.

import type { ReactNode } from 'react';

export interface PatternProps {
  kind: 'dots' | 'particles' | 'glow';
  color1?: string;
  color2?: string;
  intensity?: 'soft' | 'medium';
  motion?: 'slow' | 'still';
  particle?: 'dot' | 'ring';
}

export function Pattern(props: PatternProps): ReactNode {
  void props;
  return null;
}
