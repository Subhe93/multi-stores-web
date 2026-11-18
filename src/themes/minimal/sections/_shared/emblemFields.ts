// The optional "emblem" of a hero (hero-split, hero-banner): a small brand
// mark the store uploads (an SVG works best), shown in a fixed square box
// above the eyebrow. Pure decoration. The four fields are appended at the
// END of the section schema and are never part of a section's
// defaultSettings: an empty image renders nothing, so stored heroes keep
// their markup. No showIf: the inspector condition only compares select
// values, it cannot test "an image is set". The dashboard carries the same
// four fields (same keys, order, options and defaults).

import type { FieldDefinition } from '../../../types';

export type EmblemMotion = 'none' | 'rise' | 'turn';
export type EmblemSize = 'sm' | 'md';
export type EmblemPosition = 'start' | 'end';

export const EMBLEM_FIELDS: FieldDefinition[] = [
  {
    key: 'emblem_image',
    type: 'image',
    label: { en: 'Emblem (small brand mark)', ar: 'الشعار الصغير (رمز العلامة)' },
    description: {
      en: 'Optional. A small mark above the text, an SVG works best. Decoration only: screen readers skip it.',
      ar: 'اختياري. رمز صغير فوق النص، ويُفضَّل ملف SVG. للزينة فقط ويتجاوزه قارئ الشاشة.',
    },
  },
  {
    key: 'emblem_motion',
    type: 'select',
    label: { en: 'Emblem motion', ar: 'حركة الشعار الصغير' },
    description: {
      en: 'Plays only when the store motion style is on. Otherwise the emblem is a still image.',
      ar: 'تعمل فقط عند تفعيل نمط الحركة في المتجر، وإلا يبقى الشعار صورة ثابتة.',
    },
    defaultValue: 'rise',
    options: [
      { value: 'none', label: { en: 'None', ar: 'بدون' } },
      { value: 'rise', label: { en: 'Slow rise', ar: 'صعود هادئ' } },
      { value: 'turn', label: { en: 'Slow turn', ar: 'دوران هادئ' } },
    ],
  },
  {
    key: 'emblem_size',
    type: 'select',
    label: { en: 'Emblem size', ar: 'حجم الشعار الصغير' },
    defaultValue: 'md',
    options: [
      { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
      { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
    ],
  },
  {
    key: 'emblem_position',
    type: 'select',
    label: { en: 'Emblem position', ar: 'موضع الشعار الصغير' },
    description: {
      en: 'Side of the text block. With centred text the emblem stays centred.',
      ar: 'جهة كتلة النص. مع النص المتوسط يبقى الشعار في الوسط.',
    },
    defaultValue: 'start',
    options: [
      { value: 'start', label: { en: 'Start', ar: 'البداية' } },
      { value: 'end', label: { en: 'End', ar: 'النهاية' } },
    ],
  },
];

/** Stored motion; unset or unknown = 'rise'. */
export function emblemMotionValue(raw: unknown): EmblemMotion {
  return raw === 'none' || raw === 'turn' ? raw : 'rise';
}

/** Stored size; unset or unknown = 'md'. */
export function emblemSizeValue(raw: unknown): EmblemSize {
  return raw === 'sm' ? 'sm' : 'md';
}

/** Stored position; unset or unknown = 'start'. */
export function emblemPositionValue(raw: unknown): EmblemPosition {
  return raw === 'end' ? 'end' : 'start';
}
