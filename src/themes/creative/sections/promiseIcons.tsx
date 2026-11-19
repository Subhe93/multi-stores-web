// The built-in line icons of "promise-band" (48 x 48, stroked, no fill).
// Paths marked `accent` are drawn in the gold colour and redraw themselves
// in the accent colour on hover. Every path carries pathLength="1" so the
// `promise` behaviour can draw it in with one dash offset.

import type { ReactElement } from 'react';

type IconPath = readonly [d: string, accent?: true];

const ICONS: Record<string, readonly IconPath[]> = {
  book: [
    ['M24 41c-6-3.5-13-4-19-2.5V17.5c6-1.5 13-1 19 2.5c6-3.5 13-4 19-2.5v21c-6-1.5-13-1-19 2.5Z'],
    ['M24 20v21'],
    ['M17 15.5a7 7 0 0 1 14 0', true],
    ['M24 3.5v2.5M15.2 7.2l1.7 1.7M32.8 7.2l-1.7 1.7M11.5 14h2.4M34.1 14h2.4', true],
  ],
  mountain: [
    ['M3 41L17 17l7 11l6-8l15 21Z'],
    ['M13.4 23.2l3.6 2.6l3.4-2.9'],
    ['M30.5 10a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0', true],
    ['M35 2.5v1.6M41.5 10h1.6M40 5l1.1-1.1', true],
  ],
  gem: [['M13 9h22l9 11l-20 21L4 20Z'], ['M4 20h40'], ['M18 9l6 11l6-11M15 20l9 21l9-21', true]],
  heart: [
    ['M24 41C14 34 6 27.5 6 19a9 9 0 0 1 18-2.5a9 9 0 0 1 18 2.5c0 8.5-8 15-18 22Z'],
    ['M24 3.5v2.6M16.5 6.2l1.5 2.1M31.5 6.2L30 8.3', true],
  ],
  leaf: [
    ['M9 39C9 21 21 9 40 8c0 19-12 31-31 31Z'],
    ['M9 39c6-9 13-16 22-22', true],
    ['M17 31h7M22 25.5h6', true],
  ],
  truck: [
    ['M4 13h24v21H4Z'],
    ['M28 20h8.5l6.5 7.5V34H28'],
    ['M10 37a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0M31.6 37a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0', true],
  ],
  shield: [['M24 4l16 6v12c0 10-7 17.5-16 22C15 39.5 8 32 8 22V10Z'], ['M17 23.5l5 5l9.5-10', true]],
  gift: [
    ['M7 19h34v8H7Z'],
    ['M10 27h28v15H10Z'],
    ['M24 19v23'],
    ['M24 19c-3-6-10-8.5-11.5-4c-1.2 3.6 5.5 4 11.5 4c6 0 12.7-.4 11.5-4C34 10.5 27 13 24 19', true],
  ],
};

/** Whether a stored icon value names a built-in icon. */
export function isPromiseIcon(value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ICONS, value);
}

/** One built-in icon as inline SVG (decorative). */
export function PromiseIcon({ name }: { name: string }): ReactElement | null {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg className="cx-pm-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {paths.map(([d, accent], i) => (
        <path key={i} pathLength={1} className={accent ? 'cx-pm-accent' : undefined} d={d} />
      ))}
    </svg>
  );
}
