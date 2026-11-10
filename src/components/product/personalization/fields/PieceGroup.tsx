'use client';

import type { ReactNode } from 'react';

interface PieceGroupProps {
  heading: string;
  children: ReactNode;
}

/**
 * One boxed piece ("st 1", "st 2", …). Shared by the repeater items and the
 * piece-1 box so every piece on the page has the same frame.
 */
export function PieceGroup({ heading, children }: PieceGroupProps) {
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{heading}</legend>
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}
