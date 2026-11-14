import { describe, expect, it } from 'vitest';
import { buildColumnCss } from './containerCss';

// Selector semantics of the double-divider rule against real column markup
// (wrapper .s-<id> > inner div > content), as SectionRenderer renders it.

function column(children: { id: string; html: string; divider?: boolean }[]) {
  const host = document.createElement('div');
  host.innerHTML =
    `<div class="lc-c">` +
    children
      .map((c) => `<style></style><div data-section-id="${c.id}" class="s-${c.id}"><div class="s-${c.id}-i">${c.html}</div></div>`)
      .join('') +
    `</div>`;
  document.body.replaceChildren(host);
  const css = buildColumnCss('c', {}, children.map((c) => ({ id: c.id, layout: {}, divider: c.divider })));
  // Every `display:none` rule's selector, as emitted.
  const hiddenSelectors = [...css.matchAll(/([^{}]+)\{display:none\}/g)].map((m) => m[1]);
  return (id: string) => {
    const el = host.querySelector(`.s-${id}`)!;
    return hiddenSelectors.some((sel) => el.matches(sel));
  };
}

const HR = '<div style="height:1px"><hr></div>';

describe('double divider rule (DOM)', () => {
  it('hides the second divider when the blocks between rendered nothing', () => {
    const hidden = column([
      { id: 'price', html: '<p>275 kr</p>' },
      { id: 'd1', html: HR, divider: true },
      { id: 'bundles', html: '' },
      { id: 'variants', html: '' },
      { id: 'd2', html: HR, divider: true },
      { id: 'buy', html: '<button>Köp</button>' },
    ]);
    expect(hidden('d1')).toBe(false);
    expect(hidden('d2')).toBe(true);
    expect(hidden('price')).toBe(false);
    expect(hidden('buy')).toBe(false);
  });

  it('keeps both dividers when a block between them has content', () => {
    const hidden = column([
      { id: 'd1', html: HR, divider: true },
      { id: 'bundles', html: '' },
      { id: 'variants', html: '<fieldset>Färg</fieldset>' },
      { id: 'd2', html: HR, divider: true },
    ]);
    expect(hidden('d1')).toBe(false);
    expect(hidden('d2')).toBe(false);
  });
});
