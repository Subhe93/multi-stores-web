import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { minimalTheme } from '../theme';
import { classicTheme } from '../../classic/theme';
import type { FieldDefinition } from '../../types';
import en from '@/i18n/messages/en.json';
import ar from '@/i18n/messages/ar.json';
import tr from '@/i18n/messages/tr.json';
import de from '@/i18n/messages/de.json';
import fr from '@/i18n/messages/fr.json';
import sv from '@/i18n/messages/sv.json';

// The three new page-builder sections. Keys, translatable arrays and defaults
// are a contract with the dashboard copy of each schema
// (multi-stores-dashboard/src/lib/section-schemas.ts): a change here is made
// on both sides.
const EXPECTED: Record<
  string,
  { translatable: string[]; defaultSettings: Record<string, unknown>; category: string; settingsKeys: string[] }
> = {
  'category-tiles': {
    category: 'commerce',
    translatable: ['heading', 'subheading', 'items'],
    defaultSettings: {
      card_style: 'caption',
      aspect: 'square',
      columns: 4,
      columns_tablet: 3,
      columns_mobile: 2,
      mobile_scroll: false,
      heading_align: 'center',
      heading_rule: false,
      show_arrow: true,
      card_surface: true,
      rounded: true,
    },
    settingsKeys: [
      'card_style', 'aspect', 'columns', 'columns_tablet', 'columns_mobile', 'mobile_scroll', 'heading_align',
      'heading_rule', 'show_arrow', 'card_surface', 'rounded', 'heading_color', 'subheading_color', 'title_color',
      'subtitle_color', 'arrow_bg_color', 'arrow_color',
    ],
  },
  'progress-spotlight': {
    category: 'content',
    translatable: ['eyebrow', 'heading', 'body', 'item_title', 'item_meta', 'unit_label', 'note', 'cta_text', 'alt'],
    defaultSettings: {
      layout: 'split',
      image_side: 'start',
      image_focus: 'center',
      tone: 'surface',
      icon: 'none',
      status: 'in_progress',
      goal: 100,
      reached: 0,
      show_progress: true,
      show_percent: true,
      cta_tone: 'primary',
      cta_arrow: false,
    },
    settingsKeys: [
      'layout', 'image', 'image_side', 'image_focus', 'tone', 'bg_color', 'icon', 'status', 'goal', 'reached',
      'show_progress', 'show_percent', 'cta_url', 'cta_tone', 'cta_arrow', 'eyebrow_color', 'heading_color',
      'body_color', 'bar_color', 'cta_bg_color', 'cta_text_color', 'cta_border_color', 'cta_border_width',
      'cta_border_radius',
    ],
  },
  'project-cards': {
    category: 'content',
    translatable: ['heading', 'subheading', 'link_label', 'items'],
    defaultSettings: {
      columns: 3,
      columns_tablet: 2,
      columns_mobile: 1,
      aspect: 'landscape',
      card_style: 'bordered',
      show_status: true,
      heading_align: 'start',
      heading_rule: false,
      rounded: true,
    },
    settingsKeys: [
      'columns', 'columns_tablet', 'columns_mobile', 'aspect', 'card_style', 'show_status', 'heading_align',
      'heading_rule', 'rounded', 'link_url', 'heading_color', 'subheading_color', 'title_color', 'body_color',
      'link_color',
    ],
  },
};

const optionValues = (fields: FieldDefinition[], key: string) =>
  fields.find((f) => f.key === key)?.options?.map((o) => o.value);

describe('editorial sections: registry and contract', () => {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    describe(key, () => {
      const def = minimalTheme.sections[key];

      it('is registered in the minimal theme and inherited by the classic theme', () => {
        expect(def).toBeDefined();
        expect(def.schema.id).toBe(key);
        expect(def.schema.category).toBe(expected.category);
        expect(classicTheme.sections[key]).toBe(def);
        // Content pages only: no chrome flag, default page types.
        expect(def.schema.pageTypes).toBeUndefined();
        expect(def.schema.chrome).toBeUndefined();
      });

      it('has the agreed translatable keys and defaults', () => {
        expect(def.schema.translatable).toEqual(expected.translatable);
        expect(def.defaultSettings).toEqual(expected.defaultSettings);
        expect(def.needsBuilderPreview).toBe(true);
        expect(def.needsStoreContext).toBeUndefined();
      });

      it('stores exactly the agreed keys: translatable in content, the rest in settings', () => {
        const fields = def.schema.schema;
        const keys = fields.map((f) => f.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const t of expected.translatable) expect(keys, t).toContain(t);
        expect(keys.filter((k) => !expected.translatable.includes(k)).sort()).toEqual([...expected.settingsKeys].sort());
        // Defaults never put a translatable key into settings or the reverse.
        for (const k of Object.keys(def.defaultSettings ?? {})) expect(expected.translatable, k).not.toContain(k);
        for (const k of Object.keys(def.defaultContent ?? {})) expect(expected.translatable, k).toContain(k);
      });

      it('writes every boolean default explicitly and labels every field in en and ar', () => {
        const walk = (list: FieldDefinition[]): FieldDefinition[] => list.flatMap((f) => [f, ...walk(f.fields ?? [])]);
        const fields = walk(def.schema.schema);
        for (const f of def.schema.schema.filter((x) => x.type === 'boolean')) {
          expect(typeof (def.defaultSettings ?? {})[f.key], f.key).toBe('boolean');
          expect(f.defaultValue, f.key).toBe((def.defaultSettings ?? {})[f.key]);
        }
        for (const f of fields) {
          expect(f.label.en, f.key).toBeTruthy();
          expect(f.label.ar, f.key).toBeTruthy();
          for (const o of f.options ?? []) {
            expect(o.label.en, `${f.key}.${o.value}`).toBeTruthy();
            expect(o.label.ar, `${f.key}.${o.value}`).toBeTruthy();
          }
          // No repeater without a limit.
          if (f.type === 'repeater') expect(f.maxItems, f.key).toBeGreaterThan(0);
        }
        expect(def.schema.label.ar).toBeTruthy();
        expect(def.schema.description?.ar).toBeTruthy();
      });
    });
  }

  it('default content of the three sections', () => {
    expect(minimalTheme.sections['category-tiles'].defaultContent).toEqual({
      heading: 'Shop by category',
      items: [
        { title: 'New in', subtitle: 'The latest arrivals', url: '/products' },
        { title: 'Clothing', subtitle: 'Everyday pieces', url: '/products' },
        { title: 'Accessories', subtitle: 'Finishing touches', url: '/products' },
        { title: 'Gifts', subtitle: 'Something for everyone', url: '/products' },
      ],
    });
    expect(minimalTheme.sections['progress-spotlight'].defaultContent).toEqual({
      eyebrow: 'Our goal',
      heading: 'Follow our progress',
      body: 'Describe what you are working towards and why it matters. The bar is calculated from the two numbers you enter.',
      item_title: 'Name of the goal',
      item_meta: 'Where or when',
      unit_label: 'completed',
      cta_text: 'Learn more',
    });
    const description = 'Describe the project in one or two sentences.';
    expect(minimalTheme.sections['project-cards'].defaultContent).toEqual({
      heading: 'Our projects',
      subheading: 'What is planned, what is under way and what is done.',
      items: [
        { title: 'First project', category: 'Category', location: 'Location', status: 'completed', description },
        { title: 'Second project', category: 'Category', location: 'Location', status: 'in_progress', description },
        { title: 'Third project', category: 'Category', location: 'Location', status: 'planned', description },
      ],
    });
  });

  it('option values of the selects', () => {
    const tiles = minimalTheme.sections['category-tiles'].schema.schema;
    expect(optionValues(tiles, 'card_style')).toEqual(['caption', 'overlay']);
    expect(optionValues(tiles, 'aspect')).toEqual(['square', 'portrait', 'landscape']);
    expect(optionValues(tiles, 'heading_align')).toEqual(['start', 'center']);
    expect(tiles.find((f) => f.key === 'card_surface')?.showIf).toEqual({ key: 'card_style', in: ['', 'caption'] });

    const spotlight = minimalTheme.sections['progress-spotlight'].schema.schema;
    expect(optionValues(spotlight, 'layout')).toEqual(['split', 'card']);
    expect(optionValues(spotlight, 'image_side')).toEqual(['start', 'end']);
    expect(optionValues(spotlight, 'image_focus')).toEqual(['center', 'top', 'bottom']);
    expect(optionValues(spotlight, 'tone')).toEqual(['none', 'surface', 'primary', 'accent']);
    expect(optionValues(spotlight, 'status')).toEqual(['none', 'planned', 'in_progress', 'completed']);
    expect(optionValues(spotlight, 'cta_tone')).toEqual(['primary', 'accent']);
    expect(optionValues(spotlight, 'icon')).toEqual([
      'none', 'truck', 'refresh', 'shield', 'card', 'award', 'star', 'headphones', 'leaf',
      'graduation', 'gem', 'globe', 'book', 'heart', 'sparkles',
    ]);
    for (const key of ['image', 'alt', 'image_side', 'image_focus']) {
      expect(spotlight.find((f) => f.key === key)?.showIf, key).toEqual({ key: 'layout', in: ['', 'split'] });
    }

    const cards = minimalTheme.sections['project-cards'].schema.schema;
    expect(optionValues(cards, 'aspect')).toEqual(['landscape', 'square', 'portrait', 'wide']);
    expect(optionValues(cards, 'card_style')).toEqual(['plain', 'bordered', 'surface']);
    expect(optionValues(cards, 'heading_align')).toEqual(['start', 'center']);
    const items = cards.find((f) => f.key === 'items')?.fields ?? [];
    expect(optionValues(items, 'status')).toEqual(['none', 'planned', 'in_progress', 'completed']);
  });

  it('hero-split variant fields', () => {
    const fields = minimalTheme.sections['hero-split'].schema.schema;
    const keys = fields.map((f) => f.key);
    expect(keys[0]).toBe('variant');
    expect(keys.indexOf('alt')).toBe(keys.indexOf('image') + 1);
    expect(optionValues(fields, 'variant')).toEqual(['framed', 'bleed']);
    expect(optionValues(fields, 'image_width')).toEqual(['half', 'wide']);
    expect(optionValues(fields, 'image_focus')).toEqual(['center', 'top', 'bottom']);
    expect(optionValues(fields, 'tone')).toEqual(['none', 'surface', 'primary', 'accent']);
    expect(optionValues(fields, 'edge')).toEqual(['soft', 'hard']);
    expect(optionValues(fields, 'mobile_order')).toEqual(['image-first', 'text-first']);
    expect(optionValues(fields, 'cta_tone')).toEqual(['primary', 'accent']);
    for (const key of ['image_width', 'image_focus', 'tone', 'bg_color', 'edge', 'mobile_order', 'cta_arrow']) {
      expect(fields.find((f) => f.key === key)?.showIf, key).toEqual({ key: 'variant', in: ['bleed'] });
    }
    // Both variants.
    expect(fields.find((f) => f.key === 'cta_tone')?.showIf).toBeUndefined();
    expect(fields.find((f) => f.key === 'alt')?.showIf).toBeUndefined();
  });
});

describe('editorial sections: messages in six locales', () => {
  const LOCALES: Record<string, { sections?: unknown }> = { en, ar, tr, de, fr, sv };
  const flatten = (value: unknown, prefix = ''): Record<string, string> =>
    value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
          (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
          {},
        )
      : { [prefix]: String(value) };

  const KEYS = [
    'status.planned',
    'status.inProgress',
    'status.completed',
    'progress.label',
    'progress.reachedOfGoal',
    'progress.goal',
    'viewDetails',
    'empty.categoryTiles',
    'empty.projectCards',
    'empty.progressSpotlight',
  ];

  it('every locale has the same non-empty keys', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const flat = flatten(messages.sections);
      expect(Object.keys(flat).sort(), locale).toEqual([...KEYS].sort());
      for (const k of KEYS) expect(flat[k].trim(), `${locale}.${k}`).not.toBe('');
    }
  });

  it('keeps the placeholders of the two number messages', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const flat = flatten(messages.sections);
      expect(flat['progress.reachedOfGoal'], locale).toContain('{reached}');
      expect(flat['progress.reachedOfGoal'], locale).toContain('{goal}');
      expect(flat['progress.goal'], locale).toContain('{goal}');
      // A straight apostrophe starts an escape in the message syntax.
      for (const k of KEYS) expect(flat[k], `${locale}.${k}`).not.toContain("'");
    }
  });

  it('translates the texts (no English left in the other five)', () => {
    const base = flatten(en.sections);
    for (const [locale, messages] of Object.entries(LOCALES)) {
      if (locale === 'en') continue;
      const flat = flatten(messages.sections);
      for (const k of KEYS) expect(flat[k], `${locale}.${k}`).not.toBe(base[k]);
    }
  });
});
