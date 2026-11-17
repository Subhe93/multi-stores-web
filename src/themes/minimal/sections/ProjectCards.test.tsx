import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { projectCardsSection } from './ProjectCards';
import { classTokens, hrefs, imgAlts, imgTags, physicalClasses } from './_shared/testHelpers';

const ProjectCards = projectCardsSection.Component;

const DEFAULTS = { ...projectCardsSection.defaultSettings };

function html(
  props: Partial<SectionRenderProps> & { settings?: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <ProjectCards locale="en" primaryLocale="en" storeSlug="demo" settings={DEFAULTS} content={{}} builderPreview={false} {...props} />,
  );
}

const ITEMS = [
  {
    image: '/uploads/pages/one.jpg', alt: 'A finished room', title: 'First project', category: 'Supplies', location: 'North',
    status: 'completed', description: 'Done last spring.', url: '/first-project',
  },
  { image: '/uploads/pages/two.jpg', title: 'Second project', category: 'Equipment', status: 'in_progress', url: 'https://example.org/second' },
  { title: 'Third project', location: 'South', status: 'planned', description: 'Starts next year.' },
  { image: '/uploads/pages/four.jpg', title: 'Fourth project', status: 'none' },
  { title: 'Fifth project' },
];
const CONTENT = { heading: 'Our projects', subheading: 'Planned, under way and done.', items: ITEMS };

const badges = (out: string) => [...out.matchAll(/data-status="([^"]*)"/g)].map((m) => m[1]);
const articles = (out: string) => out.split('<article').slice(1);

describe('project-cards', () => {
  it('renders the heading and one article per card', () => {
    const out = html({ content: CONTENT });
    expect(out).toMatch(/<h2[^>]*>Our projects<\/h2>/);
    expect(out).toContain('Planned, under way and done.');
    expect(articles(out)).toHaveLength(5);
    expect(out.match(/<h3\b/g)).toHaveLength(5);
    expect(out).toContain('Supplies · North');
    expect(out).toContain('Equipment');
    expect(out).toContain('South');
    expect(out).toContain('Done last spring.');
  });

  it('the three badges show their sections.status text', () => {
    const out = html({ content: CONTENT });
    expect(badges(out)).toEqual(['completed', 'in_progress', 'planned']);
    expect(out).toContain('sections.status.completed');
    expect(out).toContain('sections.status.inProgress');
    expect(out).toContain('sections.status.planned');
  });

  it('a missing, "none" or unknown status shows no badge', () => {
    const items = [{ title: 'A' }, { title: 'B', status: 'none' }, { title: 'C', status: 'done' }, { title: 'D', status: '' }];
    const out = html({ content: { items } });
    expect(badges(out)).toEqual([]);
    expect(out).not.toContain('sections.status.');
  });

  it('show_status off or unset hides every badge', () => {
    for (const show_status of [false, undefined]) {
      const out = html({ settings: { ...DEFAULTS, show_status }, content: CONTENT });
      expect(badges(out)).toEqual([]);
    }
  });

  it('badge over the image, or above the meta line when the card has no image', () => {
    const [first, , third] = articles(html({ content: CONTENT }));
    expect(first).toMatch(/<span class="absolute top-3 start-3"><span[^>]*data-status="completed"/);
    expect(third).not.toContain('<img');
    expect(third).not.toContain('absolute top-3');
    expect(third.indexOf('data-status="planned"')).toBeLessThan(third.indexOf('South'));
  });

  it('the whole card is one link named by its title', () => {
    const out = html({ content: CONTENT });
    expect(hrefs(out)).toEqual(['/first-project', 'https://example.org/second']);
    const [first, , third] = articles(out);
    expect(first.match(/<a\b/g)).toHaveLength(1);
    expect(first).toMatch(/<a href="\/first-project" class="[^"]*after:absolute after:inset-0[^"]*">First project<\/a>/);
    // The "view details" line is decoration: the link name stays the title.
    expect(first).toMatch(/<span aria-hidden="true"[^>]*>sections\.viewDetails/);
    // A card without a url is plain text with no link and no details line.
    expect(third).not.toContain('<a');
    expect(third).not.toContain('sections.viewDetails');
    expect(third).toMatch(/<h3[^>]*>Third project<\/h3>/);
  });

  it('prefixes internal links on a secondary locale and leaves external ones alone', () => {
    const out = html({
      settings: { ...DEFAULTS, link_url: '/projects' },
      content: { ...CONTENT, link_label: 'All projects' },
      locale: 'sv',
      primaryLocale: 'en',
    });
    expect(hrefs(out)).toEqual(['/sv/first-project', 'https://example.org/second', '/sv/projects']);
    expect(out).toContain('All projects');
  });

  it('the link under the grid needs both a text and a url', () => {
    expect(hrefs(html({ settings: { ...DEFAULTS, link_url: '/projects' }, content: { items: [{ title: 'A' }] } }))).toEqual([]);
    expect(hrefs(html({ content: { items: [{ title: 'A' }], link_label: 'All projects' } }))).toEqual([]);
    expect(hrefs(html({ settings: { ...DEFAULTS, link_url: '/projects' }, content: { items: [{ title: 'A' }], link_label: 'All' } }))).toEqual(['/projects']);
  });

  it('renders at most twenty-four cards', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `Card ${i + 1}` }));
    const out = html({ content: { items: many } });
    expect(articles(out)).toHaveLength(24);
    expect(out).toContain('Card 24');
    expect(out).not.toContain('Card 25');
    const repeater = projectCardsSection.schema.schema.find((f) => f.key === 'items');
    expect(repeater?.maxItems).toBe(24);
    expect(repeater?.fields?.map((f) => f.key)).toEqual(['image', 'alt', 'title', 'category', 'location', 'status', 'description', 'url']);
  });

  it('card styles: bordered, surface and plain', () => {
    // Inline style of the first card frame.
    const frame = (out: string) => out.match(/<article class="[^"]*" style="([^"]*)"/)?.[1] ?? '';
    const bordered = html({ content: CONTENT });
    expect(frame(bordered)).toBe('border-radius:var(--theme-radius-md);border:1px solid var(--theme-colors-border)');
    expect(classTokens(bordered)).toContain('px-4');
    const surface = html({ settings: { ...DEFAULTS, card_style: 'surface' }, content: CONTENT });
    expect(frame(surface)).toBe('border-radius:var(--theme-radius-md);background-color:var(--theme-colors-surface)');
    const plain = html({ settings: { ...DEFAULTS, card_style: 'plain' }, content: CONTENT });
    expect(frame(plain)).toBe('border-radius:var(--theme-radius-md)');
    expect(classTokens(plain)).toContain('px-0');
    expect(classTokens(plain)).not.toContain('px-4');
    // Unset reads as bordered (and, as a boolean left unset, not rounded).
    expect(frame(html({ settings: {}, content: CONTENT }))).toBe('border-radius:0;border:1px solid var(--theme-colors-border)');
  });

  it('columns, aspect, rounding and image hints', () => {
    const out = html({ content: CONTENT });
    expect(out).toContain('--cols-d:3;--cols-t:2;--cols-m:1');
    expect(classTokens(out)).toContain('aspect-[4/3]');
    expect(out).toContain('border-radius:var(--theme-radius-md)');
    expect(imgTags(out)[0]).toContain('(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 34vw');
    expect(imgAlts(out)).toEqual(['A finished room', '', '']);
    const custom = html({ settings: { ...DEFAULTS, columns: 8, columns_tablet: 3, columns_mobile: 2, aspect: 'wide', rounded: false }, content: CONTENT });
    expect(custom).toContain('--cols-d:4;--cols-t:3;--cols-m:2');
    expect(classTokens(custom)).toContain('aspect-[16/9]');
    expect(custom).toContain('border-radius:0');
  });

  it('heading alignment: start by default, centred with optional rules', () => {
    expect(classTokens(html({ content: CONTENT }))).toContain('text-start');
    const centred = html({ settings: { ...DEFAULTS, heading_align: 'center', heading_rule: true }, content: CONTENT });
    expect(classTokens(centred)).toContain('text-center');
    expect(centred.match(/max-w-24/g)).toHaveLength(2);
    expect(html({ settings: { ...DEFAULTS, heading_rule: true }, content: CONTENT })).not.toContain('max-w-24');
  });

  it('colour overrides', () => {
    const out = html({
      settings: { ...DEFAULTS, title_color: '#101010', body_color: '#202020', link_color: '#303030', heading_color: '#404040' },
      content: CONTENT,
    });
    for (const c of ['#101010', '#202020', '#303030', '#404040']) expect(out).toContain(`color:${c}`);
  });

  it('empty: nothing on the live store, a placeholder in the builder', () => {
    expect(html({ content: {} })).toBe('');
    expect(html({ content: { heading: 'Only a heading', items: [{ description: 'no title, no image' }] } })).toBe('');
    expect(html({ content: {}, builderPreview: true })).toContain('sections.empty.projectCards');
  });

  it('one item is one card in the first track', () => {
    const out = html({ content: { items: [ITEMS[0]] } });
    expect(articles(out)).toHaveLength(1);
    expect(out).toContain('--cols-d:3');
  });

  it('uses no physical direction classes', () => {
    for (const card_style of ['plain', 'bordered', 'surface']) {
      const out = html({
        settings: { ...DEFAULTS, card_style, heading_align: 'center', heading_rule: true, link_url: '/projects' },
        content: { ...CONTENT, link_label: 'All projects' },
        locale: 'ar',
        primaryLocale: 'en',
      });
      expect(physicalClasses(out)).toEqual([]);
    }
  });
});
