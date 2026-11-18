// Behaviours by name (the value of data-cx-behavior). Each one is its own
// async chunk, loaded by the core only when a scope that uses it comes
// within 1.5 viewports. `calm: false` behaviours do not run under the store
// motion profile "calm".

import type { Behavior } from './core';

export interface BehaviorEntry {
  calm: boolean;
  load: () => Promise<{ default: Behavior }>;
}

export const BEHAVIORS: Record<string, BehaviorEntry> = {
  scrub: { calm: false, load: () => import('./behaviors/scrub') },
  pointer: { calm: false, load: () => import('./behaviors/pointer') },
  draw: { calm: true, load: () => import('./behaviors/draw') },
};
