import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionHeading } from './SectionHeading';

// `multiline` is opt-in (category-tiles, project-cards). Every other caller
// omits it and must keep the markup it always rendered.

const TWO = 'First line\nSecond line';
const H2 = (text: string, extraStyle = '') =>
  `<h2 data-text-look="heading" style="font-family:var(--theme-font-heading);font-size:var(--theme-scale-h2);font-weight:var(--theme-weight-heading);line-height:var(--theme-line-heading);letter-spacing:var(--theme-tracking-heading);color:var(--theme-colors-text)${extraStyle}">${text}</h2>`;

describe('SectionHeading multiline', () => {
  it('without the prop: the exact markup it always rendered, break or not', () => {
    expect(renderToStaticMarkup(<SectionHeading heading="One line" subheading="Sub" eyebrow="Eye" />)).toBe(
      '<div class="flex flex-col gap-3 max-w-2xl text-center items-center mx-auto ">' +
        '<span data-text-look="body" style="color:var(--theme-colors-accent)" class="text-xs font-semibold uppercase tracking-[0.14em]">Eye</span>' +
        H2('One line') +
        '<p data-text-look="body" style="color:var(--theme-colors-muted)" class="text-base leading-relaxed">Sub</p>' +
        '</div>',
    );
    // A break in the text is passed through untouched and gets no style.
    const out = renderToStaticMarkup(<SectionHeading heading={TWO} />);
    expect(out).toContain(H2(TWO));
    expect(out).not.toContain('white-space');
    expect(renderToStaticMarkup(<SectionHeading heading={TWO} multiline={false} />)).toBe(out);
  });

  it('with the prop: white-space: pre-line only when the heading has a break', () => {
    const multi = renderToStaticMarkup(<SectionHeading heading={TWO} multiline />);
    expect(multi).toContain(H2(TWO, ';white-space:pre-line'));
    expect(multi).not.toContain('<br');
    // One line: identical to a caller that does not pass the prop.
    for (const props of [{}, { align: 'start' as const }, { ruled: true }, { as: 'h1' as const, tag: 'h3' as const }]) {
      expect(renderToStaticMarkup(<SectionHeading heading="One line" subheading="Sub" {...props} multiline />)).toBe(
        renderToStaticMarkup(<SectionHeading heading="One line" subheading="Sub" {...props} />),
      );
    }
  });

  it('with the prop and rules beside the heading: still one text node', () => {
    const out = renderToStaticMarkup(<SectionHeading heading={TWO} ruled multiline />);
    expect(out).toContain(H2(TWO, ';white-space:pre-line'));
    expect(out.match(/aria-hidden/g)).toHaveLength(2);
  });

  it('never applies to the eyebrow or the subheading', () => {
    const out = renderToStaticMarkup(<SectionHeading heading="One line" subheading={'a\nb'} eyebrow={'c\nd'} multiline />);
    expect(out).not.toContain('white-space');
  });
});
