import { Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SectionRenderer, shouldReveal } from './SectionRenderer';
import { animationClass, readSectionStyle, resolveSectionStyle } from './sectionStyle';
import { Reveal } from './_motion';
import type { SectionDefinition, SectionInstance, SectionRenderProps, Theme } from './types';
import { minimalTheme } from './minimal/theme';

// ── Frozen copy of the flat renderer before nesting existed ──────────────
// Used as the byte-for-byte reference for pages without parent_id.

function legacyScopeClassFor(sectionId: string): string {
  return `s-${sectionId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function LegacySectionRenderer({
  theme,
  sections,
  locale,
  storeSlug,
  primaryLocale,
  preloaded,
  chrome,
  collapseWrappers,
}: {
  theme: Theme;
  sections: SectionInstance[];
  locale: string;
  storeSlug: string;
  primaryLocale: string;
  preloaded?: Record<string, unknown>;
  chrome?: boolean;
  collapseWrappers?: boolean;
}) {
  const wrapperStyle = (collapseWrappers ?? chrome) ? ({ display: 'contents' } as const) : undefined;
  const ordered = sections.filter((s) => !s.is_hidden).sort((a, b) => a.sort_order - b.sort_order);
  const firstId = ordered.find((s) => theme.sections[s.section_key]?.Component)?.id;
  return (
    <>
      {ordered.map((section) => {
        const def = theme.sections[section.section_key];
        if (!def || !def.Component) return null;
        const rawTranslations = section.translations as unknown;
        let content: Record<string, unknown> = {};
        if (Array.isArray(rawTranslations)) {
          const t = rawTranslations as Array<{ locale: string; content: Record<string, unknown> }>;
          content =
            t.find((row) => row.locale === locale)?.content ||
            t.find((row) => row.locale === primaryLocale)?.content ||
            t[0]?.content ||
            {};
        } else if (rawTranslations && typeof rawTranslations === 'object') {
          const t = rawTranslations as Record<string, Record<string, unknown>>;
          content = t[locale] || t[primaryLocale] || Object.values(t)[0] || {};
        }
        const Component = def.Component;
        const sectionStyle = readSectionStyle(section.settings);
        const wrapperScope = legacyScopeClassFor(section.id);
        const innerScope = `${wrapperScope}-i`;
        const { css } = resolveSectionStyle(sectionStyle, wrapperScope);
        const animClass = animationClass(sectionStyle?.animate);
        const wrapperClass = [wrapperScope, animClass].filter(Boolean).join(' ');
        const inner = (
          <div className={innerScope} style={wrapperStyle}>
            <Component
              settings={section.settings}
              content={content}
              locale={locale}
              primaryLocale={primaryLocale}
              storeSlug={storeSlug}
              chrome={chrome || undefined}
              preloaded={preloaded?.[section.id]}
            />
          </div>
        );
        return (
          <Fragment key={section.id}>
            {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
            {chrome || !shouldReveal(section.section_key, section.id === firstId) ? (
              <div data-section-id={section.id} data-section-key={section.section_key} className={wrapperClass} style={wrapperStyle}>
                {inner}
              </div>
            ) : (
              <Reveal data-section-id={section.id} data-section-key={section.section_key} className={wrapperClass} style={wrapperStyle}>
                {inner}
              </Reveal>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

// ── Stub theme ──────────────────────────────────────────────────────────

// Prints every prop it receives, so a prop change shows up in the markup.
function Probe(props: SectionRenderProps) {
  const keys = Object.keys(props).filter((k) => (props as unknown as Record<string, unknown>)[k] !== undefined).sort();
  return (
    <p data-props={keys.join(',')} data-content={JSON.stringify(props.content)} data-preloaded={JSON.stringify(props.preloaded ?? null)}>
      {String(props.content.text ?? '')}
    </p>
  );
}

const probe = (id: string): SectionDefinition => ({
  schema: { id, label: { en: id }, category: 'content', translatable: [], schema: [] },
  Component: Probe,
});

const theme: Theme = {
  ...minimalTheme,
  key: 'stub',
  sections: {
    'hero-banner': probe('hero-banner'),
    'rich-text': probe('rich-text'),
    'faq-list': probe('faq-list'),
    'product-page': probe('product-page'),
    'product-gallery': probe('product-gallery'),
    'product-details': probe('product-details'),
    'layout-row': minimalTheme.sections['layout-row'],
    'layout-column': minimalTheme.sections['layout-column'],
    'layout-grid': minimalTheme.sections['layout-grid'],
  },
};

function sec(id: string, key: string, sort_order: number, extra: Partial<SectionInstance> = {}): SectionInstance {
  return {
    id,
    section_key: key,
    sort_order,
    settings: {},
    translations: [{ locale: 'en', content: { text: id } }],
    ...extra,
  };
}

const base = { theme, locale: 'en', primaryLocale: 'en', storeSlug: 'demo' };

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(() => warn.mockRestore());

// ── Flat-page regression ────────────────────────────────────────────────

const flatFixtures: Record<string, SectionInstance[]> = {
  'mixed page with styles, hidden and unknown sections': [
    sec('b', 'rich-text', 2, { settings: { _style: { padding: { top: 'md' }, width: 'full', animate: 'fade-up' } } }),
    sec('a', 'hero-banner', 1),
    sec('hidden', 'rich-text', 0, { is_hidden: true }),
    sec('unknown', 'nope', 0),
    sec('c', 'faq-list', 3, {
      settings: { _style: { width: { desktop: 'full', mobile: 'narrow' }, hide_on: ['mobile'] } },
      translations: [
        { locale: 'sv', content: { text: 'sv' } },
        { locale: 'en', content: { text: 'en' } },
      ],
    }),
    sec('d', 'product-page', 4),
  ],
  'first section is a plain content section': [sec('x', 'rich-text', 0), sec('y', 'rich-text', 1), sec('z', 'rich-text', 1)],
  'legacy record-keyed translations': [
    { id: 'r', section_key: 'rich-text', sort_order: 0, settings: {}, translations: { en: { text: 'rec' } } as never },
  ],
  'explicit null parent_id': [sec('p', 'rich-text', 0, { parent_id: null }), sec('q', 'rich-text', 1, { parent_id: null })],
};

describe('SectionRenderer flat-page regression', () => {
  for (const [name, sections] of Object.entries(flatFixtures)) {
    it(`renders byte-identical markup: ${name}`, () => {
      for (const mode of [{}, { chrome: true }, { chrome: true, collapseWrappers: false }] as const) {
        const preloaded = { a: { rows: 1 }, x: [1, 2] };
        const expected = renderToStaticMarkup(<LegacySectionRenderer {...base} {...mode} sections={sections} preloaded={preloaded} />);
        const actual = renderToStaticMarkup(<SectionRenderer {...base} {...mode} sections={sections} preloaded={preloaded} />);
        expect(actual).toBe(expected);
      }
    });
  }

  it('does not hand container props to regular sections', () => {
    const html = renderToStaticMarkup(<SectionRenderer {...base} sections={[sec('a', 'rich-text', 0)]} />);
    expect(html).toContain('data-props="content,locale,primaryLocale,settings,storeSlug"');
  });
});

// ── Tree rendering ──────────────────────────────────────────────────────

const productTree: SectionInstance[] = [
  sec('row', 'layout-row', 0),
  sec('left', 'layout-column', 0, { parent_id: 'row', settings: { sticky_desktop: true } }),
  sec('right', 'layout-column', 1, { parent_id: 'row' }),
  sec('gallery', 'product-gallery', 0, { parent_id: 'left' }),
  sec('title', 'product-details', 0, { parent_id: 'right' }),
  sec('desc', 'rich-text', 1, { parent_id: 'right', settings: { _layout: { order: { mobile: -1 } } } }),
  sec('faq', 'faq-list', 1),
];

function ids(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-section-id]')).map((el) => el.getAttribute('data-section-id')!);
}

describe('SectionRenderer tree', () => {
  it('renders children inside their containers in document order', () => {
    const { container } = render(<SectionRenderer {...base} sections={productTree} />);
    expect(ids(container)).toEqual(['row', 'left', 'gallery', 'right', 'title', 'desc', 'faq']);
    const row = container.querySelector('[data-section-id="row"]')!;
    const rowEl = row.querySelector('.lc-row')!;
    expect(rowEl.getAttribute('data-layout')).toBe('row');
    // Direct children of the flex element are the child wrappers.
    const direct = Array.from(rowEl.children)
      .filter((el) => el.tagName !== 'STYLE')
      .map((el) => el.getAttribute('data-section-id'));
    expect(direct).toEqual(['left', 'right']);
    expect(container.querySelector('[data-section-id="right"] .lc-right [data-section-id="desc"]')).not.toBeNull();
  });

  it('emits container CSS for the children layout', () => {
    const { container } = render(<SectionRenderer {...base} sections={productTree} />);
    const css = Array.from(container.querySelectorAll('style'))
      .map((el) => el.innerHTML)
      .join('\n');
    expect(css).toContain('.lc-row{display:flex');
    expect(css).toContain('@media (min-width: 1024px){.s-left-i{position:sticky;top:24px}}');
    expect(css).toContain('@media (max-width: 767px){.lc-right>.s-desc{order:-1}}');
  });

  it('drops a hidden container with its subtree', () => {
    const sections = productTree.map((s) => (s.id === 'right' ? { ...s, is_hidden: true } : s));
    const { container } = render(<SectionRenderer {...base} sections={sections} />);
    expect(ids(container)).toEqual(['row', 'left', 'gallery', 'faq']);
  });

  it('skips a container left empty on the live store but shows a placeholder in the builder', () => {
    const sections = [sec('row', 'layout-row', 0), sec('t', 'rich-text', 1), sec('orphan', 'rich-text', 0, { parent_id: 'gone' })];
    const live = render(<SectionRenderer {...base} sections={sections} />);
    expect(ids(live.container)).toEqual(['t']);
    expect(live.container.querySelector('[data-layout-empty]')).toBeNull();
    live.unmount();
    const builder = render(<SectionRenderer {...base} builderPreview sections={sections} />);
    expect(ids(builder.container)).toEqual(['row', 't']);
    expect(builder.container.querySelector('[data-layout-empty="row"]')).not.toBeNull();
  });

  it('skips a container whose children are all unknown in the theme', () => {
    const sections = [sec('row', 'layout-row', 0), sec('u', 'nope', 0, { parent_id: 'row' }), sec('t', 'rich-text', 1)];
    const { container } = render(<SectionRenderer {...base} sections={sections} />);
    expect(ids(container)).toEqual(['t']);
  });

  it('ignores _style full width on children only', () => {
    const full = { _style: { width: 'full' } };
    const sections = [
      sec('row', 'layout-row', 0, { settings: full }),
      sec('child', 'rich-text', 0, { parent_id: 'row', settings: { _style: { width: { desktop: 'full', mobile: 'narrow' } } } }),
    ];
    const { container } = render(<SectionRenderer {...base} sections={sections} />);
    const css = Array.from(container.querySelectorAll('style'))
      .map((el) => el.innerHTML)
      .join('\n');
    expect(css).toContain('.s-row{width:100vw');
    expect(css).not.toContain('.s-child{width:100vw');
    expect(css).toContain('.s-child-i{max-width:720px');
  });
});

// ── Reveal / LCP rules ──────────────────────────────────────────────────

function revealed(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-reveal]')).map((el) => el.getAttribute('data-section-id')!);
}

describe('SectionRenderer reveal and LCP', () => {
  it('never reveals the container holding the first leaf, nor any nested child', () => {
    const { container } = render(<SectionRenderer {...base} sections={productTree} />);
    expect(revealed(container)).toEqual(['faq']);
  });

  it('treats the first leaf (not the first container) as the LCP section', () => {
    // An empty first row (builder) is not the LCP: the next root leaf is.
    const sections = [sec('row', 'layout-row', 0), sec('t', 'rich-text', 1), sec('u', 'rich-text', 2)];
    const { container } = render(<SectionRenderer {...base} builderPreview sections={sections} />);
    expect(revealed(container)).toEqual(['row', 'u']);
  });

  it('reveals a later root container as one unit', () => {
    const sections = [
      sec('t', 'rich-text', 0),
      sec('grid', 'layout-grid', 1),
      sec('g1', 'rich-text', 0, { parent_id: 'grid' }),
      sec('g2', 'rich-text', 1, { parent_id: 'grid' }),
    ];
    const { container } = render(<SectionRenderer {...base} sections={sections} />);
    expect(revealed(container)).toEqual(['grid']);
  });

  it('keeps chrome mode free of reveals with containers too', () => {
    const sections = [sec('t', 'rich-text', 0), sec('row', 'layout-row', 1), sec('c', 'rich-text', 0, { parent_id: 'row' })];
    const { container } = render(<SectionRenderer {...base} chrome sections={sections} />);
    expect(revealed(container)).toEqual([]);
  });
});

// ── builderPreview on product blocks ────────────────────────────────────

describe('SectionRenderer builderPreview on product blocks', () => {
  const productProbe: SectionDefinition = {
    schema: { id: 'product-title', label: { en: 'Product title' }, category: 'product', translatable: [], schema: [] },
    Component: (props: SectionRenderProps) => <p data-bp={String(props.builderPreview)} />,
  };
  const contentProbe: SectionDefinition = {
    schema: { id: 'rich-text', label: { en: 'Rich text' }, category: 'content', translatable: [], schema: [] },
    Component: (props: SectionRenderProps) => <p data-bp={String(props.builderPreview)} />,
  };
  const blockTheme: Theme = {
    ...theme,
    sections: { ...theme.sections, 'product-title': productProbe, 'rich-text': contentProbe },
  };
  const sections = [sec('p', 'product-title', 0), sec('t', 'rich-text', 1)];
  const flags = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-bp]')).map((el) => el.getAttribute('data-bp'));

  it('passes an explicit flag to product blocks only', () => {
    const live = render(<SectionRenderer {...base} theme={blockTheme} sections={sections} />);
    expect(flags(live.container)).toEqual(['false', 'undefined']);
    live.unmount();
    const builder = render(<SectionRenderer {...base} theme={blockTheme} builderPreview sections={sections} />);
    expect(flags(builder.container)).toEqual(['true', 'undefined']);
  });

  it('registers every product block in the minimal theme', () => {
    for (const key of [
      'product-breadcrumb', 'product-title', 'product-price', 'product-short-description',
      'product-promotions', 'product-bundles', 'product-variants', 'product-personalization',
      'product-buy', 'product-gallery', 'product-trust', 'product-shipping', 'product-tabs',
      'product-details', 'add-to-cart', 'product-page',
    ]) {
      expect(minimalTheme.sections[key]?.Component, key).toBeTruthy();
    }
  });
});

// ── builderPreview on sections with a dynamic source ─────────────────────

describe('SectionRenderer builderPreview on dynamic-source sections', () => {
  const contentProbe: SectionDefinition = {
    schema: { id: 'rich-text', label: { en: 'Rich text' }, category: 'content', translatable: [], schema: [] },
    Component: (props: SectionRenderProps) => <p data-bp={String(props.builderPreview)} />,
  };
  const dynTheme: Theme = { ...theme, sections: { ...theme.sections, 'rich-text': contentProbe } };
  const sections = [
    sec('static', 'rich-text', 0),
    sec('explicit-static', 'rich-text', 1, { settings: { content_source: 'static', image_source: 'static' } }),
    sec('dyn-text', 'rich-text', 2, { settings: { content_source: 'product_description' } }),
    sec('dyn-image', 'rich-text', 3, { settings: { image_source: 'variant_image' } }),
    sec('unknown', 'rich-text', 4, { settings: { content_source: 'bogus' } }),
  ];
  const flags = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-bp]')).map((el) => el.getAttribute('data-bp'));

  it('passes the flag only to sections with a dynamic source; static ones keep their props', () => {
    const live = render(<SectionRenderer {...base} theme={dynTheme} sections={sections} />);
    expect(flags(live.container)).toEqual(['undefined', 'undefined', 'false', 'false', 'undefined']);
    live.unmount();
    const builder = render(<SectionRenderer {...base} theme={dynTheme} builderPreview sections={sections} />);
    expect(flags(builder.container)).toEqual(['undefined', 'undefined', 'true', 'true', 'undefined']);
  });

  it('registers the single-image section with the builder flag', () => {
    expect(minimalTheme.sections['single-image']?.needsBuilderPreview).toBe(true);
  });
});
