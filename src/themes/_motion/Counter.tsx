'use client';

// Animated number that counts up from zero when scrolled into view. Accepts the
// raw value string authored in the builder (e.g. "510K", "4.9", "43") and
// animates only its leading numeric part, preserving any trailing unit ("K",
// "/5") and decimal precision. Renders the final value immediately under
// prefers-reduced-motion or when the value has no number to animate.

import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface ParsedValue {
  target: number;
  decimals: number;
  prefixUnit: string; // non-numeric chars before the number
  suffixUnit: string; // non-numeric chars after the number (e.g. "K", "/5")
}

function parseValue(raw: string): ParsedValue | null {
  const match = raw.match(/-?\d[\d,]*(\.\d+)?/);
  if (!match) return null;
  const numStr = match[0].replace(/,/g, '');
  const target = parseFloat(numStr);
  if (!Number.isFinite(target)) return null;
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return {
    target,
    decimals,
    prefixUnit: raw.slice(0, match.index),
    suffixUnit: raw.slice((match.index ?? 0) + match[0].length),
  };
}

interface CounterProps {
  value: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}

export function Counter({ value, prefix = '', suffix = '', className, style }: CounterProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const parsed = parseValue(value);
  // Initialise to the final value so SSR and the first client render match
  // (no hydration mismatch). The count-up starts from 0 in an effect, after
  // hydration, only when in view and motion is allowed.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!parsed || reduced || !inView) return;
    const controls = animate(0, parsed.target, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        setDisplay(`${parsed.prefixUnit}${v.toFixed(parsed.decimals)}${parsed.suffixUnit}`);
      },
    });
    return () => controls.stop();
  }, [inView, reduced, parsed]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
