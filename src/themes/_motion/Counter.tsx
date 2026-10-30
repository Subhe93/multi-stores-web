'use client';

// Animated number that counts up from zero when scrolled into view. Accepts the
// raw value string authored in the builder (e.g. "510K", "4.9", "2,8k", "43",
// "1–3") and animates only its leading numeric part, preserving any surrounding
// text ("K", "/5", "–3 dagar") and the author's decimal separator. Renders the
// final value immediately under prefers-reduced-motion or when the value has no
// number to animate, and always ends on the exact authored string.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { observeOnce, prefersReducedMotion } from './inView';

const DURATION_MS = 1400;

/** CSS-style cubic-bezier easing (x1, y1, x2, y2), solved for x by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 30; i++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < x) lo = t;
      else hi = t;
    }
    return at(y1, y2, t);
  };
}

const ease = cubicBezier(0.16, 1, 0.3, 1);

export interface ParsedValue {
  target: number;
  decimals: number;
  /** "." or "," — the decimal separator the author used. */
  decimalSeparator: '.' | ',';
  /** Thousands separator to re-insert while counting ("" when none). */
  groupSeparator: string;
  prefixUnit: string; // text before the number
  suffixUnit: string; // text after the number (e.g. "K", "/5")
}

/**
 * Leading number of an authored value. A comma followed by exactly three
 * digits is a thousands separator ("10,000"); any other comma is a decimal
 * comma ("2,8k", "4,9/5") as written in Swedish, German, French or Turkish.
 */
export function parseValue(raw: string): ParsedValue | null {
  const match = raw.match(/\d+(?:[.,]\d+)*/);
  if (!match) return null;
  const token = match[0];
  let decimalSeparator: '.' | ',' = '.';
  let groupSeparator = '';
  let numStr = token;
  const groups = token.split(/[.,]/);
  const seps = token.match(/[.,]/g) ?? [];
  const thousandsOnly =
    seps.length > 0 &&
    seps.every((s) => s === seps[0]) &&
    groups.slice(1).every((g) => g.length === 3) &&
    // "4.900" is ambiguous; a single dot with 3 digits stays a decimal.
    !(seps.length === 1 && seps[0] === '.');
  if (thousandsOnly) {
    groupSeparator = seps[0] ?? "";
    numStr = groups.join('');
  } else if (seps.length > 0) {
    const last = seps[seps.length - 1] as '.' | ',';
    decimalSeparator = last;
    const cut = token.lastIndexOf(last);
    const intPart = token.slice(0, cut).replace(/[.,]/g, '');
    groupSeparator = seps.length > 1 ? (seps[0] ?? '') : '';
    numStr = `${intPart}.${token.slice(cut + 1)}`;
  }
  const target = parseFloat(numStr);
  if (!Number.isFinite(target)) return null;
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return {
    target,
    decimals,
    decimalSeparator,
    groupSeparator,
    prefixUnit: raw.slice(0, match.index),
    suffixUnit: raw.slice((match.index ?? 0) + token.length),
  };
}

/** One animation frame of `parsed` at value `v`, in the author's notation. */
export function formatFrame(parsed: ParsedValue, v: number): string {
  const [int, frac] = v.toFixed(parsed.decimals).split('.');
  const grouped = parsed.groupSeparator
    ? int.replace(/\B(?=(\d{3})+(?!\d))/g, parsed.groupSeparator)
    : int;
  const num = frac ? `${grouped}${parsed.decimalSeparator}${frac}` : grouped;
  return `${parsed.prefixUnit}${num}${parsed.suffixUnit}`;
}

interface CounterProps {
  value: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}

export function Counter({ value, prefix = '', suffix = '', className, style }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Memoised on the authored string: a fresh object every render would
  // restart the effect (and the count-up from 0) on every render.
  const parsed = useMemo(() => parseValue(value), [value]);
  // Initialise to the final value so SSR and the first client render match
  // (no hydration mismatch). The count-up starts from 0 in an effect, after
  // hydration, only when in view and motion is allowed.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parsed || prefersReducedMotion()) return;
    let frame = 0;
    const stop = observeOnce(
      el,
      () => {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / DURATION_MS);
          // End on exactly what the author typed.
          setDisplay(p >= 1 ? value : formatFrame(parsed, parsed.target * ease(p)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setDisplay(formatFrame(parsed, 0));
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [parsed, value]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
