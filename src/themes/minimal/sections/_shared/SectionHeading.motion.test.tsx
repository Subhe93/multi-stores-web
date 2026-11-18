import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SectionHeading } from './SectionHeading';

const base = { eyebrow: 'Label', heading: 'Two words', subheading: 'Body copy', ruled: true } as const;

describe('SectionHeading with the store motion style', () => {
  it('without the motion prop the markup carries no engine attribute', () => {
    const html = renderToStaticMarkup(<SectionHeading {...base} />);
    expect(html).not.toContain('data-cx-');
    expect(html).not.toContain('cx-w');
    expect(html).toBe(renderToStaticMarkup(<SectionHeading {...base} motion={undefined} />));
  });

  it('scroll: eyebrow and subheading rise, the heading splits into masked words, the rules draw', () => {
    const html = renderToStaticMarkup(<SectionHeading {...base} motion="scroll" />);
    expect(html.match(/data-cx-reveal="rise"/g)?.length).toBe(2);
    expect(html.match(/data-cx-reveal="line"/g)?.length).toBe(2);
    expect(html).toContain('data-cx-reveal="words"');
    expect(html.match(/class="cx-wi"/g)?.length).toBe(2);
  });

  it('intro: the same elements use the load-time variants', () => {
    const html = renderToStaticMarkup(<SectionHeading {...base} motion="intro" />);
    expect(html).toContain('data-cx-intro="words"');
    expect(html).toContain('data-cx-intro="rise"');
    expect(html).toContain('data-cx-intro="rule"');
    expect(html).not.toContain('data-cx-reveal');
  });

  it('the text of the heading does not change', () => {
    const el = document.createElement('div');
    el.innerHTML = renderToStaticMarkup(<SectionHeading heading={'First line\nsecond line'} multiline motion="scroll" />);
    expect(el.querySelector('h2')?.textContent).toBe('First line\nsecond line');
  });
});
