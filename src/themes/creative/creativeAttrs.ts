// Store switch of the creative engine: theme_customizations.motion.creative.
// Absent = off. Only `enabled: true` turns it on; unset options mean "on"
// (smooth scrolling, magnetic buttons) or "off" (page transition).

import type { ThemeCustomizations } from '../types';

export interface CreativeOptions {
  smooth: boolean;
  magnetic: boolean;
  curtain: boolean;
}

/** The stored switch as options; null unless `enabled === true`. */
export function readCreative(c?: ThemeCustomizations | null): CreativeOptions | null {
  const motion: unknown = c?.motion;
  if (!motion || typeof motion !== 'object' || Array.isArray(motion)) return null;
  const creative: unknown = (motion as { creative?: unknown }).creative;
  if (!creative || typeof creative !== 'object' || Array.isArray(creative)) return null;
  const { enabled, smooth, magnetic, transition } = creative as Record<string, unknown>;
  if (enabled !== true) return null;
  return { smooth: smooth !== 'off', magnetic: magnetic !== 'off', curtain: transition === 'curtain' };
}

/** The store switched its motion style on (sections then get the `motion` prop). */
export function storeMotion(c?: ThemeCustomizations | null): boolean {
  return readCreative(c) !== null;
}

/**
 * Data attributes for `.store-root`. An empty object when the switch is off,
 * so a store that never set it renders the same root element.
 */
export function creativeAttrs(c?: ThemeCustomizations | null): Record<string, string> {
  const options = readCreative(c);
  if (!options) return {};
  const attrs: Record<string, string> = { 'data-creative': '' };
  if (!options.smooth) attrs['data-creative-smooth'] = 'off';
  if (!options.magnetic) attrs['data-creative-magnetic'] = 'off';
  if (options.curtain) attrs['data-creative-transition'] = 'curtain';
  return attrs;
}

/** storeMotion() for a store record of any shape (pages cast their own). */
export function storeMotionOf(store: unknown): boolean {
  if (!store || typeof store !== 'object') return false;
  return storeMotion((store as { theme_customizations?: ThemeCustomizations | null }).theme_customizations);
}
