import { describe, expect, it } from 'vitest';
import { buildColumnCss, buildGridCss, buildRowCss, containerClassFor, readGridSettings } from './containerCss';

const T = '@media (max-width: 1023px)';
const M = '@media (max-width: 767px)';
const D = '@media (min-width: 1024px)';

describe('containerClassFor', () => {
  it('strips unsafe characters', () => {
    expect(containerClassFor('ab"c{1}')).toBe('lc-abc1');
  });
});

describe('buildRowCss', () => {
  it('emits a flex row that stacks on tablet by default', () => {
    const css = buildRowCss('r1', {}, []);
    expect(css).toContain('.lc-r1{display:flex;flex-direction:row;flex-wrap:nowrap;gap:32px;align-items:stretch;justify-content:flex-start}');
    expect(css).toContain('.lc-r1>[data-section-id]{flex:1 1 0%;min-width:0}');
    expect(css).toContain(`${T}{.lc-r1{flex-direction:column;flex-wrap:nowrap}.lc-r1>[data-section-id]{flex:0 0 auto;width:100%}}`);
    expect(css).not.toContain(M);
  });

  it('uses spans as width ratios only while side by side', () => {
    const css = buildRowCss('r1', { stack_on: 'mobile' }, [
      { id: 'a', layout: { span: { desktop: 2, tablet: 1, mobile: 3 } } },
    ]);
    expect(css).toContain('.lc-r1>.s-a{flex-grow:2}');
    expect(css).toContain(`${T}{.lc-r1>.s-a{flex-grow:1}}`);
    // Mobile is stacked: no flex-grow there, children take full width.
    expect(css).toContain(`${M}{.lc-r1{flex-direction:column;flex-wrap:nowrap}.lc-r1>[data-section-id]{flex:0 0 auto;width:100%}}`);
    expect(css).not.toContain('flex-grow:3');
  });

  it('reverses on mobile (stacked: column-reverse, not stacked: row-reverse)', () => {
    expect(buildRowCss('r', { reverse_on_mobile: true }, [])).toContain(`${M}{.lc-r{flex-direction:column-reverse}}`);
    expect(buildRowCss('r', { reverse_on_mobile: true, stack_on: 'never' }, [])).toContain(
      `${M}{.lc-r{flex-direction:row-reverse}}`,
    );
    expect(buildRowCss('r', { stack_on: 'never' }, [])).not.toContain('@media (max');
  });

  it('applies gap, align, justify, wrap and content width', () => {
    const css = buildRowCss('r', { gap_px: 12, align: 'center', justify: 'between', wrap: true, child_width: 'auto' }, [
      { id: 'a', layout: { span: { desktop: 2 } } },
    ]);
    expect(css).toContain('flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between');
    expect(css).toContain('.lc-r>[data-section-id]{flex:0 1 auto;min-width:0}');
    expect(css).not.toContain('flex-grow');
    const fillWrap = buildRowCss('r', { wrap: true }, []);
    expect(fillWrap).toContain('min-width:min(100%,240px)');
  });

  it('emits per-breakpoint order, align_self and desktop-only sticky', () => {
    const css = buildRowCss('r', {}, [
      { id: 'a', layout: { order: { desktop: 2, mobile: -1 }, align_self: 'start', sticky: true } },
    ]);
    expect(css).toContain('.lc-r>.s-a{order:2}');
    expect(css).toContain('.lc-r>.s-a{align-self:start}');
    expect(css).toContain(`${M}{.lc-r>.s-a{order:-1}}`);
    expect(css).toContain(`${D}{.lc-r>.s-a>.s-a-i{position:sticky;top:var(--sd-sticky-top,24px)}}`);
  });

  it('clamps out-of-range settings', () => {
    expect(buildRowCss('r', { gap_px: 9999, align: 'weird' }, [])).toContain('gap:200px;align-items:stretch');
  });
});

describe('buildColumnCss', () => {
  it('emits a vertical stack with gap and align', () => {
    const css = buildColumnCss('c', { gap_px: 8, align: 'center' }, []);
    expect(css).toContain('.lc-c{display:flex;flex-direction:column;gap:8px;align-items:center}');
    expect(css).not.toContain('sticky');
  });

  it('makes its own inner sticky on desktop', () => {
    const css = buildColumnCss('c', { sticky_desktop: true, sticky_top_px: 96 }, []);
    expect(css).toContain(`${D}{.s-c-i{position:sticky;top:96px}}`);
  });

  it('applies child order per breakpoint', () => {
    const css = buildColumnCss('c', {}, [{ id: 'x', layout: { order: { tablet: 3 } } }]);
    expect(css).toContain(`${T}{.lc-c>.s-x{order:3}}`);
  });
});

describe('buildGridCss', () => {
  it('emits columns per breakpoint and gaps', () => {
    const css = buildGridCss('g', { columns_desktop: 4, columns_tablet: 2, columns_mobile: 1, gap_px: 10, row_gap_px: 20 }, []);
    expect(css).toContain('.lc-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:10px;row-gap:20px;align-items:stretch}');
    expect(css).toContain(`${T}{.lc-g{grid-template-columns:repeat(2,minmax(0,1fr))}`);
    expect(css).toContain(`${M}{.lc-g{grid-template-columns:repeat(1,minmax(0,1fr))}`);
  });

  it('skips a breakpoint whose column count equals the wider one', () => {
    const css = buildGridCss('g', { columns_desktop: 2, columns_tablet: 2, columns_mobile: 2 }, []);
    expect(css).not.toContain('@media');
  });

  it('cascades and clamps spans to the column count', () => {
    const css = buildGridCss('g', { columns_desktop: 3, columns_tablet: 2, columns_mobile: 1 }, [
      { id: 'a', layout: { span: { desktop: 3 } } },
      { id: 'b', layout: { span: { desktop: 1, tablet: 2 } } },
    ]);
    expect(css).toContain('.lc-g>.s-a{grid-column:span 3/span 3}');
    expect(css).toContain('.lc-g>.s-a{grid-column:span 2/span 2}');
    expect(css).toContain('.lc-g>.s-a{grid-column:span 1/span 1}');
    expect(css).toContain('.lc-g>.s-b{grid-column:span 1/span 1}');
    expect(css).toContain(`.lc-g>.s-b{grid-column:span 2/span 2}`);
  });

  it('defaults row gap to the column gap', () => {
    expect(readGridSettings({ gap_px: 16 }).rowGap).toBe(16);
    expect(readGridSettings({}).columns).toEqual({ desktop: 2, tablet: 2, mobile: 1 });
  });
});
