// Active-state look for top-level header nav items. Plain module (no
// 'use client') so both the server HeaderBar and the client desktop nav use it.

import type { CSSProperties } from 'react';
import { readableTextOn } from '@/lib/readableText';

export type NavActiveStyle = 'text' | 'pill';

export interface NavActiveLook {
  style: NavActiveStyle;
  /** Padding + shape shared by active and inactive items (no layout shift). */
  itemClass: string;
  activeStyle: CSSProperties;
  activeClassName: string;
}

export function parseNavActiveStyle(value: unknown): NavActiveStyle {
  return value === 'pill' ? 'pill' : 'text';
}

/** Label colour on the pill: computed for hex, theme contrast var otherwise. */
export function pillTextColor(background: string): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background.trim())
    ? readableTextOn(background)
    : 'var(--theme-colors-primaryContrast, #fff)';
}

export function navActiveLook(style: NavActiveStyle, accent: string): NavActiveLook {
  if (style === 'pill') {
    return {
      style,
      itemClass: 'px-4 py-2 rounded-full',
      activeStyle: { backgroundColor: accent, color: pillTextColor(accent) },
      activeClassName: '',
    };
  }
  return {
    style,
    itemClass: 'px-3 py-1.5 rounded-md',
    activeStyle: { color: accent },
    activeClassName: 'bg-black/5',
  };
}
