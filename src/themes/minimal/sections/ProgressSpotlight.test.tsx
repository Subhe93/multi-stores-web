import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

// Translations echo their key; values are appended so the numbers the
// section passes can be asserted.
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));

import { progressSpotlightSection } from './ProgressSpotlight';
import { classTokens, hrefs, imgAlts, physicalClasses } from './_shared/testHelpers';

const ProgressSpotlight = progressSpotlightSection.Component;

const DEFAULTS = { ...progressSpotlightSection.defaultSettings };
const CONTENT = { ...progressSpotlightSection.defaultContent };

function html(
  props: Partial<SectionRenderProps> & { settings?: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <ProgressSpotlight locale="en" primaryLocale="en" storeSlug="demo" settings={DEFAULTS} content={CONTENT} builderPreview={false} {...props} />,
  );
}

const withNumbers = (goal: unknown, reached: unknown, extra: Record<string, unknown> = {}) =>
  html({ settings: { ...DEFAULTS, goal, reached, ...extra } });

const bar = (out: string) => out.match(/<div role="progressbar"[^>]*>/)?.[0] ?? null;

describe('progress-spotlight numbers', () => {
  it('computes the bar from the two numbers', () => {
    const out = withNumbers(100, 60);
    const el = bar(out)!;
    expect(el).toContain('aria-valuemin="0"');
    expect(el).toContain('aria-valuemax="100"');
    expect(el).toContain('aria-valuenow="60"');
    expect(el).toContain('aria-valuetext="sections.progress.reachedOfGoal[reached=60,goal=100] completed"');
    expect(el).toContain('aria-label="Name of the goal"');
    expect(out).toContain('width:60%');
    expect(out).toContain('>60%<');
    // The same line is shown as text under the bar.
    expect(out).toContain('<p class="mt-2 text-sm">sections.progress.reachedOfGoal[reached=60,goal=100] completed</p>');
  });

  it('shows no bar and no numbers when the goal is missing, 0, negative or not a number', () => {
    for (const goal of [undefined, null, '', 0, -10, Number.NaN]) {
      const out = withNumbers(goal, 5);
      expect(bar(out), String(goal)).toBeNull();
      expect(out, String(goal)).not.toContain('reachedOfGoal');
      expect(out, String(goal)).not.toContain('%<');
      // The panel itself stays: it still has a name and a status.
      expect(out, String(goal)).toContain('Name of the goal');
    }
  });

  it('caps at 100 when more than the goal was reached, and shows 100 only once it is met', () => {
    const over = withNumbers(100, 250);
    expect(bar(over)).toContain('aria-valuenow="100"');
    expect(over).toContain('reached=250,goal=100');
    expect(bar(withNumbers(1000, 996))).toContain('aria-valuenow="99"');
    expect(withNumbers(1000, 996)).toContain('>99%<');
    expect(bar(withNumbers(1000, 1000))).toContain('aria-valuenow="100"');
  });

  it('formats the numbers for the locale', () => {
    const out = withNumbers(12000, 3000);
    expect(out).toContain('reached=3,000,goal=12,000');
    expect(html({ settings: { ...DEFAULTS, goal: 12000, reached: 3000 }, locale: 'de' })).toContain('reached=3.000,goal=12.000');
  });

  it('a default section shows an empty bar without claiming progress', () => {
    const out = html({});
    expect(bar(out)).toContain('aria-valuenow="0"');
    expect(out).toContain('width:0%');
    expect(out).toContain('reached=0,goal=100');
  });

  it('show_progress unset or off hides the bar and the percent', () => {
    for (const show_progress of [undefined, false]) {
      const out = withNumbers(100, 60, { show_progress });
      expect(bar(out)).toBeNull();
      expect(out).not.toContain('>60%<');
    }
    // Booleans left unset are off: the percent needs its own switch too.
    const noPercent = withNumbers(100, 60, { show_percent: undefined });
    expect(bar(noPercent)).not.toBeNull();
    expect(noPercent).not.toContain('>60%<');
  });

  it('bar colour: the accent by default, overridable', () => {
    expect(withNumbers(100, 60)).toContain('background:var(--theme-colors-accent)');
    expect(withNumbers(100, 60, { bar_color: '#123456' })).toContain('background:#123456');
  });
});

describe('progress-spotlight status', () => {
  it('status texts come from the sections.status keys', () => {
    expect(withNumbers(100, 60, { status: 'planned' })).toContain('sections.status.planned');
    expect(withNumbers(100, 60, { status: 'in_progress' })).toContain('sections.status.inProgress');
    expect(withNumbers(100, 60, { status: 'completed' })).toContain('sections.status.completed');
    // Unset reads as the default.
    expect(withNumbers(100, 60, { status: undefined })).toContain('sections.status.inProgress');
  });

  it('planned never shows a bar or a percent, only the goal', () => {
    const out = withNumbers(100, 60, { status: 'planned' });
    expect(bar(out)).toBeNull();
    expect(out).not.toContain('>60%<');
    expect(out).not.toContain('reachedOfGoal');
    expect(out).toContain('sections.progress.goal[goal=100] completed');
    // Without a goal a planned item shows the badge alone.
    const noGoal = withNumbers(undefined, 60, { status: 'planned' });
    expect(noGoal).toContain('sections.status.planned');
    expect(noGoal).not.toContain('sections.progress.goal');
  });

  it('completed keeps the real numbers', () => {
    const out = withNumbers(100, 40, { status: 'completed' });
    expect(bar(out)).toContain('aria-valuenow="40"');
    expect(out).toContain('reached=40,goal=100');
  });

  it('none: no badge, the bar when the numbers allow it', () => {
    const out = withNumbers(100, 60, { status: 'none' });
    expect(out).not.toContain('sections.status.');
    expect(bar(out)).toContain('aria-valuenow="60"');
  });

  it('the three badges differ by icon, not by colour alone', () => {
    const icon = (status: string) => withNumbers(100, 60, { status }).match(/data-status="[^"]*"[^>]*><svg[^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(icon('planned')).toContain('lucide-circle-dashed');
    expect(icon('in_progress')).toContain('lucide-circle-dot');
    expect(icon('completed')).toContain('lucide-check');
    expect(withNumbers(100, 60, { status: 'planned' })).toMatch(/data-status="planned"[^>]*><svg[^>]*aria-hidden="true"/);
  });

  it('omits the panel without a name, a goal and a status', () => {
    const out = html({
      settings: { ...DEFAULTS, status: 'none', goal: undefined },
      content: { ...CONTENT, item_title: '', item_meta: 'ignored', note: 'ignored too' },
    });
    expect(out).not.toContain('data-progress-panel');
    expect(out).not.toContain('ignored');
    expect(out).toContain('Follow our progress');
  });

  it('icon and note', () => {
    const out = html({ settings: { ...DEFAULTS, icon: 'graduation' }, content: { ...CONTENT, note: 'Figures as of March' } });
    expect(classTokens(out)).toContain('lucide-graduation-cap');
    expect(out).toContain('Figures as of March');
    expect(classTokens(html({}))).not.toContain('lucide-graduation-cap');
    expect(classTokens(html({ settings: { ...DEFAULTS, icon: 'constructor' } }))).not.toContain('size-8');
  });
});

describe('progress-spotlight layout', () => {
  it('split with an image: edge to edge, hard edge, alt text', () => {
    const out = html({ settings: { ...DEFAULTS, image: '/uploads/pages/goal.jpg' }, content: { ...CONTENT, alt: 'A classroom' } });
    expect(out).toContain('data-bleed-split="bleed"');
    expect(out).toContain('width:100vw');
    expect(out).not.toContain('linear-gradient');
    expect(imgAlts(out)).toEqual(['A classroom']);
    expect(classTokens(out)).toEqual(expect.arrayContaining(['aspect-[4/3]', 'md:min-h-[480px]']));
    expect(classTokens(out)).not.toContain('md:order-2');
    expect(classTokens(html({ settings: { ...DEFAULTS, image: '/uploads/pages/goal.jpg', image_side: 'end' } }))).toContain('md:order-2');
    expect(imgAlts(html({ settings: { ...DEFAULTS, image: '/uploads/pages/goal.jpg' } }))).toEqual(['']);
  });

  it('split without an image: one contained column live, a box in the builder', () => {
    const live = html({});
    expect(live).toContain('data-bleed-split="contained"');
    expect(live).not.toContain('100vw');
    const preview = html({ builderPreview: true });
    expect(preview).toContain('data-bleed-split="bleed"');
    expect(preview).toContain('data-bleed-placeholder');
    expect(preview).not.toContain('<img');
  });

  it('card layout: one centred panel, the image is ignored', () => {
    const out = html({ settings: { ...DEFAULTS, layout: 'card', image: '/uploads/pages/goal.jpg' } });
    expect(out).not.toContain('data-bleed-split');
    expect(out).not.toContain('<img');
    expect(classTokens(out)).toEqual(expect.arrayContaining(['mx-auto', 'max-w-3xl']));
    expect(out).toContain('background-color:var(--theme-colors-surface)');
    expect(out).toContain('Follow our progress');
  });

  it('tone and background override', () => {
    expect(html({ settings: { ...DEFAULTS, layout: 'card', tone: 'primary' } })).toContain(
      'background-color:var(--theme-colors-primary);color:var(--theme-colors-primaryContrast, #fff)',
    );
    expect(html({ settings: { ...DEFAULTS, layout: 'card', bg_color: '#f2f2f2' } })).toContain('background-color:#f2f2f2');
  });

  it('button: localized link, tone, radius default and optional arrow', () => {
    const settings = { ...DEFAULTS, cta_url: '/learn-more' };
    expect(hrefs(html({ settings }))).toEqual(['/learn-more']);
    expect(hrefs(html({ settings, locale: 'ar', primaryLocale: 'en' }))).toEqual(['/ar/learn-more']);
    expect(hrefs(html({ settings: { ...DEFAULTS, cta_url: 'https://example.org/report' }, locale: 'ar', primaryLocale: 'en' }))).toEqual([
      'https://example.org/report',
    ]);
    const plain = html({ settings });
    expect(plain).toContain('border-radius:var(--theme-radius-button, var(--theme-radius-full))');
    expect(plain).toContain('background-color:var(--theme-colors-primary);color:var(--theme-colors-primaryContrast, #fff)');
    expect(plain).not.toContain('lucide-arrow-right');
    const accent = html({ settings: { ...settings, cta_tone: 'accent', cta_arrow: true, cta_border_radius: 4 } });
    expect(accent).toContain('background-color:var(--theme-colors-accent);color:var(--theme-colors-accentContrast, #fff)');
    expect(accent).toContain('border-radius:4px');
    expect(classTokens(accent)).toEqual(expect.arrayContaining(['lucide-arrow-right', 'rtl:-scale-x-100']));
    expect(html({ settings, content: { ...CONTENT, cta_text: '' } })).not.toContain('<a');
  });

  it('shows the entered number beside the same percent (29 of 100 is 29%)', () => {
    for (const reached of [29, 57, 58]) {
      const out = withNumbers(100, reached);
      expect(out, String(reached)).toContain(`aria-valuenow="${reached}"`);
      expect(out, String(reached)).toContain(`>${reached}%<`);
      expect(out, String(reached)).toContain(`width:${reached}%`);
    }
  });

  it('eyebrow: letter-spacing is dropped in right-to-left (joined scripts)', () => {
    const tokens = classTokens(html({}));
    expect(tokens).toContain('tracking-[0.2em]');
    expect(tokens).toContain('rtl:tracking-normal');
  });

  it('heading level and eyebrow tag', () => {
    expect(html({})).toMatch(/<h2[^>]*>Follow our progress<\/h2>/);
    expect(html({ settings: { ...DEFAULTS, heading_level: 'h3', eyebrow_tag: 'p' } })).toMatch(/<h3[^>]*>Follow our progress<\/h3>/);
    expect(html({ settings: { ...DEFAULTS, eyebrow_tag: 'p' } })).toMatch(/<p data-text-look="body"[^>]*>Our goal<\/p>/);
  });

  it('empty: nothing on the live store, a placeholder in the builder', () => {
    // A status alone is not content (unset reads as "in progress").
    for (const settings of [{}, { layout: 'split', status: 'none' }, { layout: 'card', status: 'completed', reached: 5 }]) {
      expect(html({ settings, content: {} })).toBe('');
      const preview = html({ settings, content: {}, builderPreview: true });
      expect(preview).toContain('sections.empty.progressSpotlight');
      expect(preview).not.toContain('data-progress-panel');
    }
  });

  it('uses no physical direction classes', () => {
    const variants: Array<Record<string, unknown>> = [
      { image: '/uploads/pages/goal.jpg', goal: 100, reached: 60, cta_arrow: true, icon: 'book' },
      { image: '/uploads/pages/goal.jpg', image_side: 'end', status: 'planned' },
      { layout: 'card', status: 'completed', goal: 10, reached: 10 },
    ];
    for (const v of variants) {
      const out = html({ settings: { ...DEFAULTS, ...v }, locale: 'ar', primaryLocale: 'en' });
      expect(physicalClasses(out)).toEqual([]);
    }
    expect(physicalClasses(html({ settings: {}, content: {}, builderPreview: true }))).toEqual([]);
  });
});

// ── Manual line breaks in the heading (both layouts) ────────────────────

describe('progress-spotlight manual line breaks', () => {
  const TWO = 'One goal.\nMany hands.';
  const ONE = 'One goal. Many hands.';
  // The heading tag as it rendered before line breaks were supported.
  const H2_OPEN =
    '<h2 data-text-look="heading" style="font-family:var(--theme-font-heading);font-size:var(--theme-scale-h2);font-weight:var(--theme-weight-heading);line-height:var(--theme-line-heading);letter-spacing:var(--theme-tracking-heading);color:var(--theme-colors-text)">';
  const LAYOUTS: Array<[string, Record<string, unknown>]> = [
    ['split with an image', { ...DEFAULTS, image: '/uploads/pages/goal.jpg' }],
    ['split without an image', { ...DEFAULTS }],
    ['card', { ...DEFAULTS, layout: 'card' }],
  ];

  for (const [name, settings] of LAYOUTS) {
    it(`${name}: keeps the typed breaks as one text node with white-space: pre-line`, () => {
      const out = html({ settings, content: { ...CONTENT, heading: TWO } });
      expect(out).toContain(
        `${H2_OPEN.replace('color:var(--theme-colors-text)"', 'color:var(--theme-colors-text);white-space:pre-line"')}${TWO}</h2>`,
      );
      expect(out).not.toContain('<br');
      expect(out.match(/white-space:pre-line/g)).toHaveLength(1);
      // The only difference from the same text on one line.
      const one = html({ settings, content: { ...CONTENT, heading: ONE } });
      expect(out.replace(';white-space:pre-line', '').replace(TWO, ONE)).toBe(one);
    });

    it(`${name}: a single-line heading renders exactly the markup it always did`, () => {
      const out = html({ settings, content: { ...CONTENT, heading: ONE } });
      expect(out).not.toContain('white-space');
      expect(out).toContain(`${H2_OPEN}${ONE}</h2>`);
    });
  }

  it('line ends are normalized and markup typed in the heading is escaped', () => {
    const out = html({ content: { ...CONTENT, heading: ' One <b>x</b> \r\n\r\n two\n3\n4\n5 ' } });
    expect(out).toContain('>One &lt;b&gt;x&lt;/b&gt;\ntwo\n3\n4 5</h2>');
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<br');
    expect(out).not.toContain('\r');
  });

  it('a heading of line ends only is no content', () => {
    expect(html({ settings: {}, content: { heading: '\n \r\n' } })).toBe('');
  });

  it('schema: the heading is a textarea, its limit unchanged', () => {
    const field = progressSpotlightSection.schema.schema.find((f) => f.key === 'heading');
    expect(field).toMatchObject({ type: 'textarea', maxLength: 120 });
  });
});
