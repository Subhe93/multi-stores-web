// Decorative living background (contract 4.10): a halftone dot cloud, tiny
// drifting particles or a soft glow, in two colours. CSS only (css/
// decor.css.ts): static by default, moving only behind the motion gate.
// Used by the section decor (settings._style.backdrop) and directly by
// hero-outline and stage-scenes. The parent must be positioned
// (position: relative) and paint its content above z-index 0.

import type { CSSProperties, ReactNode } from 'react';
import { DECOR_CSS, PARTICLE_COUNT } from '../css/decor.css';
import { CxStyle } from '../primitives/CxStyle';

export const PATTERN_KINDS = ['dots', 'particles', 'glow'] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export interface PatternProps {
  kind: PatternKind;
  /** Hex colours; empty = the theme accent / secondary. */
  color1?: string;
  color2?: string;
  intensity?: 'soft' | 'medium';
  motion?: 'slow' | 'still';
  particle?: 'dot' | 'ring';
}

/** The stored backdrop as a known kind; 'none', unset or junk reads as null. */
export function patternKind(raw: unknown): PatternKind | null {
  return typeof raw === 'string' && (PATTERN_KINDS as readonly string[]).includes(raw) ? (raw as PatternKind) : null;
}

// Only a hex colour or a plain custom-property reference reaches the style.
const COLOR = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|var\(--[a-z0-9-]+\))$/i;

/** A colour safe to write into an inline variable, or undefined. */
export function patternColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return COLOR.test(value) ? value : undefined;
}

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => i);

/**
 * One aria-hidden layer (`div.cx-bd`) filling its positioned parent, plus
 * the decor stylesheet (hoisted and deduplicated by React). An unknown kind
 * renders nothing.
 */
export function Pattern({ kind, color1, color2, intensity, motion, particle }: PatternProps): ReactNode {
  const known = patternKind(kind);
  if (!known) return null;
  const c1 = patternColor(color1);
  const c2 = patternColor(color2);
  const vars: Record<string, string> = {};
  if (c1) vars['--cx-bd-1'] = c1;
  if (c2) vars['--cx-bd-2'] = c2;
  const still = motion === 'still';
  return (
    <>
      <CxStyle id="decor" css={DECOR_CSS} />
      <div
        aria-hidden="true"
        className="cx-bd"
        data-cx-bd={known}
        data-cx-int={intensity === 'medium' ? 'medium' : undefined}
        data-cx-particle={known === 'particles' && particle === 'ring' ? 'ring' : undefined}
        data-cx-still={still ? '' : undefined}
        data-cx-loop={still ? undefined : ''}
        style={c1 || c2 ? (vars as CSSProperties) : undefined}
      >
        {known === 'particles' ? PARTICLES.map((i) => <i key={i} />) : null}
      </div>
    </>
  );
}
