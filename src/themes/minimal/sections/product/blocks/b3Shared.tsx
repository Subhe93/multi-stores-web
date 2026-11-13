'use client';

// Shared bits of the B3 product blocks (description, specifications, FAQ,
// shipping & returns): the standalone pieces of what `product-tabs` shows.
// The heading markup matches the product-shipping block's heading, and its
// tag follows the builder's `heading_level` select (look stays the same).

import type { ReactNode } from 'react';
import { headingTag } from '../../_shared/headingLevel';

/** Trimmed string content value, or '' when unset / not a string. */
export function contentString(content: Record<string, unknown> | undefined, key: string): string {
  const v = content?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

/** Owner heading text when set, else the localized default. */
export function headingText(content: Record<string, unknown> | undefined, key: string, fallback: string): string {
  return contentString(content, key) || fallback;
}

/** Block heading; the tag comes from `heading_level` (default h2). */
export function ProductBlockHeading({
  level,
  children,
  id,
}: {
  level: unknown;
  children: ReactNode;
  id?: string;
}) {
  const Tag = headingTag(level, 'h2');
  return (
    <Tag id={id} className="text-sm font-semibold text-gray-900 mb-3" data-product-block-heading="">
      {children}
    </Tag>
  );
}

/** Same prose classes as the description panel of `product-tabs`. */
export const PRODUCT_PROSE_CLASS =
  'prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto';
