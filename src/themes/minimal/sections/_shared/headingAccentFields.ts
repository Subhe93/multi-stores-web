// The two "heading accent" settings shared by the hero and banner sections
// (hero-banner, hero-split, hero-slider, hero-video, parallax-banner,
// image-with-text, brand-band). The dashboard injects the same pair into its
// copy of those schemas (section-schemas.ts withHeadingAccent). Both are
// settings (never translatable) and never part of a section's
// defaultSettings: an unset value reads as 'none' and renders nothing.

import type { FieldDefinition } from '../../../types';

export type HeadingAccentVariant = 'none' | 'line' | 'brush';

export const HEADING_ACCENT_FIELDS: FieldDefinition[] = [
  {
    key: 'heading_accent',
    type: 'select',
    label: { en: 'Heading accent', ar: 'زخرفة العنوان' },
    defaultValue: 'none',
    options: [
      { value: 'none', label: { en: 'None', ar: 'بدون' } },
      { value: 'line', label: { en: 'Line', ar: 'خط' } },
      { value: 'brush', label: { en: 'Brush stroke', ar: 'ضربة فرشاة' } },
    ],
  },
  {
    key: 'heading_accent_color',
    type: 'color',
    label: { en: 'Accent colour', ar: 'لون الزخرفة' },
    description: { en: 'Empty = the theme accent colour.', ar: 'فارغ = لون التمييز في الثيم.' },
    showIf: { key: 'heading_accent', in: ['line', 'brush'] },
  },
];

/** The stored value as a known variant; unset or anything unknown = 'none'. */
export function headingAccentValue(raw: unknown): HeadingAccentVariant {
  return raw === 'line' || raw === 'brush' ? raw : 'none';
}
