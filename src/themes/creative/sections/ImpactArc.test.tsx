import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt, fill, unoptimized }: { src: string; alt: string; fill?: boolean; unoptimized?: boolean }) => (
    <img src={src} alt={alt} data-fill={fill ? '' : undefined} data-unoptimized={unoptimized ? '' : undefined} />
  ),
}));

import { physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G, G_RTL } from '../css/base.css';
import { IMPACT_ARC_CSS } from '../css/impactArc.css';
import { entry } from '../schemas/impact-arc.schema';
import { impactArcSection } from './ImpactArc';

const ImpactArc = impactArcSection.Component;

const CONTENT = {
  eyebrow: 'Eyebrow',
  heading: 'First line.\nSecond line.',
  body: 'Body text.',
  status_label: 'Planned',
  unit_label: 'units',
  item_title: 'Item one',
  item_meta: 'Somewhere',
  note: 'A note.',
  cta_text: 'Read more',
  steps: [
    { title: 'One', text: 'First step.' },
    { title: 'Two', text: 'Second step.' },
    { title: 'Three', text: 'Third step.' },
    { title: 'Four', text: 'Never shown.' },
  ],
};
const ACTIVE = { goal: 100, reached: 37, status: 'active', cta_url: '/about' };

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <ImpactArc locale="en" primaryLocale="en" storeSlug="demo" settings={ACTIVE} content={CONTENT} {...props} />,
  );
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const tag = (markup: string, cls: string) => markup.match(new RegExp(`<[a-z0-9]+[^>]*class="[^"]*${cls}[^"]*"[^>]*>`))?.[0] ?? '';

describe('impact-arc', () => {
  it('without motion: complete content, the arc drawn to its value, no reveal attribute', () => {
    const out = html();
    expect(out).toContain('data-cx-section="impact-arc"');
    expect(out).not.toMatch(/data-cx-(reveal|intro|item|hover|magnetic|behavior|i|d)=/);
    const words = text(out);
    for (const w of ['Eyebrow', 'First line.', 'Second line.', 'Body text.', 'Planned', 'units', 'Item one', 'Somewhere', 'A note.', 'Read more', 'First step.', 'Third step.']) {
      expect(words).toContain(w);
    }
    // At most three steps.
    expect(words).not.toContain('Never shown.');
    expect((out.match(/class="cx-ia-step"/g) || []).length).toBe(3);
    // The dash array is the real fraction; the figure is final text.
    expect(out).toMatch(/class="cx-ia-prog" d="M40 400 A360 360 0 0 1 760 400" pathLength="1" stroke-dasharray="0.37 1"/);
    expect(out).toMatch(/<span class="cx-ia-num"[^>]*>37<\/span><span class="cx-ia-of">\/ 100<\/span>/);
    expect(out).toContain('href="/about"');
    // The mark sits on the arc at 37 %.
    expect(tag(out, 'cx-ia-mark')).toMatch(/left:\d+(\.\d+)?%;top:\d+(\.\d+)?%/);
    expect(out).toContain('class="cx-ia-disc"');
  });

  it('describes the gauge for assistive technology and hides the drawing', () => {
    const out = html();
    expect(tag(out, 'cx-ia-stage')).toContain('role="img"');
    expect(tag(out, 'cx-ia-stage')).toContain('aria-label="Item one, Somewhere, 37 / 100 units, Planned"');
    expect(tag(out, 'cx-ia-svg')).toContain('aria-hidden="true"');
  });

  it('scroll motion: recipe attributes on the named elements', () => {
    const out = html({ motion: 'scroll' });
    expect(tag(out, 'cx-ia-eyebrow')).toContain('data-cx-reveal="rise"');
    expect(tag(out, 'cx-ia-body')).toMatch(/data-cx-reveal="rise" data-cx-i="2"/);
    expect(out).toContain('class="cx-wi"');
    expect(tag(out, 'cx-ia-stage')).toContain('data-cx-reveal="fade"');
    expect(tag(out, 'cx-ia-steps')).toContain('data-cx-reveal="stagger"');
    expect((out.match(/class="cx-ia-step" data-cx-item=""/g) || []).length).toBe(3);
    expect(tag(out, 'cx-ia-note')).toContain('data-cx-reveal="fade"');
    expect(tag(out, 'cx-ia-cta')).toContain('data-cx-reveal="rise"');
    expect(tag(out, 'cx-ia-btn')).toMatch(/data-cx-hover="press" data-cx-magnetic=""/);
    // The figure keeps its final value in the markup while it counts.
    expect(text(out)).toContain('37');
  });

  it('intro motion uses the on-load attributes only', () => {
    const out = html({ motion: 'intro', settings: { ...ACTIVE, horizon_image: '/uploads/ridge.svg' } });
    expect(tag(out, 'cx-ia-stage')).toContain('data-cx-intro="fade"');
    expect(tag(out, 'cx-ia-ridge')).toMatch(/data-cx-intro="rise" data-cx-d="3"/);
    expect(out).not.toContain('data-cx-reveal=');
  });

  it('planned state: dashed track, no progress stroke, the mark at the start, the goal alone', () => {
    for (const settings of [{ goal: 100 }, { goal: 100, reached: 40, status: 'planned' }, { goal: 100, reached: '', status: 'active' }]) {
      const out = html({ settings });
      expect(tag(out, 'cx-ia-stage')).toContain('data-cx-planned=""');
      expect(out).not.toContain('cx-ia-prog');
      expect(tag(out, 'cx-ia-mark')).toContain('left:5%;top:100%');
      expect(out).toMatch(/<p class="cx-ia-fig" dir="ltr"><span class="cx-ia-num">100<\/span><\/p>/);
      expect(tag(out, 'cx-ia-stage')).toContain('aria-label="Item one, Somewhere, 100 units, Planned"');
    }
  });

  it('clamps the fraction and shows the real one for a completed status', () => {
    expect(html({ settings: { goal: 100, reached: 250, status: 'active' } })).toContain('stroke-dasharray="1 1"');
    expect(html({ settings: { goal: 100, reached: 60, status: 'completed' } })).toContain('stroke-dasharray="0.6 1"');
    // Nothing reached yet: no stroke (a zero-length dash would leave a dot).
    expect(html({ settings: { goal: 100, reached: 0, status: 'active' } })).not.toContain('cx-ia-prog');
  });

  it('without a goal there is no gauge and the steps remain', () => {
    const out = html({ settings: { reached: 10, status: 'active' } });
    expect(out).not.toContain('cx-ia-stage');
    expect(out).not.toContain('<svg class="cx-ia-svg"');
    expect((out.match(/class="cx-ia-step"/g) || []).length).toBe(3);
  });

  it('right to left: the path starts at the other end, artwork is not mirrored, classes are logical', () => {
    const out = html({
      locale: 'ar',
      primaryLocale: 'ar',
      settings: { ...ACTIVE, horizon_image: 'data:image/svg+xml;base64,AAAA', marker_image: '/uploads/mark.svg' },
    });
    expect(out).toContain('d="M760 400 A360 360 0 0 0 40 400"');
    const left = Number(tag(out, 'cx-ia-mark').match(/left:([\d.]+)%/)?.[1]);
    expect(left).toBeGreaterThan(50);
    // Inline artwork passes through untouched; SVG is never sent to the optimizer.
    expect(out).toContain('src="data:image/svg+xml;base64,AAAA"');
    expect(tag(out, 'cx-ia-ridge')).toContain('data-cx-vector=""');
    expect(out).not.toMatch(/scaleX|rotateY|mirror/);
    expect(physicalClasses(out)).toEqual([]);
    expect(IMPACT_ARC_CSS).not.toMatch(/\.cx-ia-(ridge|mark|svg)[^{]*\{[^}]*scaleX\(-1\)/);
  });

  it('empty: nothing on the store, the placeholder in the builder', () => {
    expect(html({ settings: {}, content: {} })).toBe('');
    expect(html({ settings: {}, content: {}, builderPreview: true })).toContain('data-cx-empty="impact-arc"');
  });

  it('owner colours become variables; nothing is set without them', () => {
    expect(tag(html(), 'cx-ia"')).not.toContain('style=');
    const out = html({ settings: { ...ACTIVE, bg_color: '#fff', text_color: '#111', arc_color: '#b00' } });
    expect(out).toContain('--cx-ia-bg:#fff;--cx-ia-fg:#111;--cx-ia-arc:#b00');
  });

  it('stylesheet: every rule that hides or moves sits behind the gate', () => {
    for (const rule of IMPACT_ARC_CSS.split('}').filter((r) => /data-cx-(state|intro)/.test(r))) {
      expect(rule.includes(G) || rule.includes(G_RTL)).toBe(true);
    }
    expect(IMPACT_ARC_CSS).not.toMatch(/(^|[;{])(margin|padding|border)-(left|right)/);
  });

  it('schema: keys, order, defaults and limits of the spec', () => {
    const s = entry.schema;
    expect(s.id).toBe('impact-arc');
    expect(s.icon).toBe('sunrise');
    expect(s.category).toBe('content');
    expect(s.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING']);
    expect(s.schema.map((f) => `${f.key}:${f.type}`)).toEqual([
      'eyebrow:text',
      'heading:textarea',
      'body:textarea',
      'status_label:text',
      'unit_label:text',
      'item_title:text',
      'item_meta:text',
      'note:textarea',
      'cta_text:text',
      'steps:repeater',
      'goal:number',
      'reached:number',
      'status:select',
      'horizon_image:image',
      'marker_image:image',
      'cta_url:url',
      'bg_color:color',
      'text_color:color',
      'arc_color:color',
    ]);
    expect(s.translatable).toEqual(['eyebrow', 'heading', 'body', 'status_label', 'unit_label', 'item_title', 'item_meta', 'note', 'cta_text', 'steps']);
    const by = Object.fromEntries(s.schema.map((f) => [f.key, f]));
    expect([by.eyebrow.maxLength, by.heading.maxLength, by.body.maxLength, by.status_label.maxLength, by.unit_label.maxLength]).toEqual([60, 100, 320, 30, 60]);
    expect([by.item_title.maxLength, by.item_meta.maxLength, by.note.maxLength, by.cta_text.maxLength]).toEqual([100, 60, 200, 40]);
    expect(by.steps.maxItems).toBe(3);
    expect(by.steps.fields?.map((f) => `${f.key}:${f.type}:${f.maxLength}`)).toEqual(['title:text:50', 'text:textarea:120']);
    expect(by.goal.min).toBe(1);
    expect(by.reached.min).toBe(0);
    expect(by.status.defaultValue).toBe('planned');
    expect(by.status.options?.map((o) => o.value)).toEqual(['planned', 'active', 'completed']);
    expect(entry.defaultSettings).toEqual({ status: 'planned' });
    expect(impactArcSection.needsBuilderPreview).toBe(true);
  });
});
