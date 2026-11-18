// Settings schema of the ornament divider, the one section the motion engine
// adds. The dashboard keeps a hand-made mirror
// (multi-stores-dashboard/src/lib/section-schemas.ts) with six-locale labels;
// creative.contract.test.tsx compares the two field by field.

import type { ComponentType } from 'react';
import type { FieldDefinition, LocalizedString, SectionDefinition, SectionRenderProps, SectionSchema } from '../types';
import type { CreativeSectionKey } from './constants';
import { entry as coverHero } from './schemas/cover-hero.schema';
import { entry as impactArc } from './schemas/impact-arc.schema';
import { entry as lookSpread } from './schemas/look-spread.schema';
import { entry as objectStudy } from './schemas/object-study.schema';
import { entry as patternBand } from './schemas/pattern-band.schema';
import { entry as scriptManifesto } from './schemas/script-manifesto.schema';

// ── Compact field builders ──────────────────────────────────────────────

type Extra = Partial<Pick<FieldDefinition, 'description' | 'showIf' | 'maxItems'>>;
type Option = [value: string, en: string, ar: string];

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

const area = (key: string, en: string, ar: string, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'textarea',
  label: L(en, ar),
  maxLength,
  ...extra,
});
const color = (key: string, en: string, ar: string, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'color',
  label: L(en, ar),
  ...extra,
});
const num = (
  key: string,
  en: string,
  ar: string,
  defaultValue: number,
  min: number,
  max: number,
  extra: Extra = {},
): FieldDefinition => ({ key, type: 'number', label: L(en, ar), defaultValue, min, max, ...extra });
const select = (
  key: string,
  en: string,
  ar: string,
  defaultValue: string,
  options: Option[],
  extra: Extra = {},
): FieldDefinition => ({
  key,
  type: 'select',
  label: L(en, ar),
  defaultValue,
  options: options.map(([value, oen, oar]) => ({ value, label: L(oen, oar) })),
  ...extra,
});
const repeater = (
  key: string,
  en: string,
  ar: string,
  maxItems: number,
  fields: FieldDefinition[],
  extra: Extra = {},
): FieldDefinition => ({ key, type: 'repeater', label: L(en, ar), maxItems, fields, ...extra });

// ── Shared option lists ─────────────────────────────────────────────────

const EMPTY_ACCENT = L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.');

export interface CreativeSchemaEntry {
  schema: SectionSchema;
  defaultSettings: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
}

const PAGE_AND_FOOTER = ['HOME', 'STATIC', 'LANDING', 'FOOTER'] as const;

const ORNAMENT_PATH_FIELDS: FieldDefinition[] = [
  area('d', 'Path data', 'بيانات المسار', 600, {
    description: L(
      'The "d" value of an SVG path (commands and numbers only).',
      'قيمة "d" لمسار SVG (أوامر وأرقام فقط).',
    ),
  }),
  select('color', 'Colour', 'اللون', 'a', [
    ['a', 'Colour A', 'اللون أ'],
    ['b', 'Colour B', 'اللون ب'],
    ['c', 'Colour C', 'اللون ج'],
  ]),
];

const ornamentLine: CreativeSchemaEntry = {
  schema: {
    id: 'ornament-line',
    label: L('Ornament line', 'خط زخرفي'),
    icon: 'minus',
    category: 'content',
    description: L(
      'A thin divider drawn from your own motif (SVG path data), which draws itself as it scrolls into view.',
      'فاصل رفيع مرسوم من نقشك الخاص (بيانات مسار SVG) يرسم نفسه عند ظهوره.',
    ),
    pageTypes: [...PAGE_AND_FOOTER],
    translatable: [],
    schema: [
      num('tile_width', 'Tile width', 'عرض البلاطة', 120, 24, 400),
      num('tile_height', 'Tile height', 'ارتفاع البلاطة', 48, 8, 120),
      repeater('paths', 'Motif paths', 'مسارات النقش', 12, ORNAMENT_PATH_FIELDS),
      color('color_a', 'Colour A', 'اللون أ', {
        description: L('Empty = the theme text colour.', 'فارغ = لون النص في الثيم.'),
      }),
      color('color_b', 'Colour B', 'اللون ب', { description: EMPTY_ACCENT }),
      color('color_c', 'Colour C', 'اللون ج', {
        description: L('Empty = the theme secondary colour.', 'فارغ = اللون الثانوي في الثيم.'),
      }),
      select('stroke', 'Line weight', 'سماكة الخط', 'regular', [
        ['thin', 'Thin', 'رفيع'],
        ['regular', 'Regular', 'عادي'],
      ]),
      select('width', 'Width', 'العرض', 'contained', [
        ['contained', 'Contained', 'ضمن الحاوية'],
        ['full', 'Full width', 'عرض كامل'],
      ]),
      select('draw', 'Drawing', 'الرسم', 'once', [
        ['once', 'Draws once', 'يُرسم مرة واحدة'],
        ['scroll', 'Follows scrolling', 'يتبع التمرير'],
        ['none', 'Static', 'ثابت'],
      ]),
    ],
  },
  defaultSettings: {
    tile_width: 120,
    tile_height: 48,
    stroke: 'regular',
    width: 'contained',
    draw: 'once',
  },
  defaultContent: {},
};

export const CREATIVE_SCHEMAS: Record<CreativeSectionKey, CreativeSchemaEntry> = {
  'ornament-line': ornamentLine,
  'cover-hero': coverHero,
  'look-spread': lookSpread,
  'object-study': objectStudy,
  'script-manifesto': scriptManifesto,
  'impact-arc': impactArc,
  'pattern-band': patternBand,
};

/**
 * The SectionDefinition of a creative section: its frozen schema and
 * defaults plus the component. Every creative section gets an explicit
 * `builderPreview` flag (empty state in the builder, nothing on the store).
 */
export function defineCreativeSection(
  key: CreativeSectionKey,
  Component: ComponentType<SectionRenderProps>,
): SectionDefinition {
  const entry = CREATIVE_SCHEMAS[key];
  return {
    needsBuilderPreview: true,
    schema: entry.schema,
    Component,
    defaultSettings: entry.defaultSettings,
    defaultContent: entry.defaultContent,
  };
}
