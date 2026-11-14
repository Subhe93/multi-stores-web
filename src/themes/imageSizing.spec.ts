import { describe, expect, it } from 'vitest';
import {
  cascade,
  hasImageSize,
  imageSizeFromLegacy,
  resolveImageSizeAt,
  resolveImageSizing,
  type ImageSizeSettings,
} from './imageSizing';

const S = 'isz';

describe('hasImageSize', () => {
  it('is false for missing / empty values', () => {
    expect(hasImageSize(undefined)).toBe(false);
    expect(hasImageSize(null)).toBe(false);
    expect(hasImageSize({})).toBe(false);
    expect(hasImageSize([])).toBe(false);
    expect(hasImageSize('full')).toBe(false);
    expect(hasImageSize({ width_mode: {} })).toBe(false);
    expect(hasImageSize({ width_mode: { tablet: '' }, fit: '' })).toBe(false);
    expect(hasImageSize({ unknown_key: 1 })).toBe(false);
  });

  it('is true when any known key carries a value', () => {
    expect(hasImageSize({ width_mode: 'px' })).toBe(true);
    expect(hasImageSize({ align: { mobile: 'center' } })).toBe(true);
    expect(hasImageSize({ max_width_px: 300 })).toBe(true);
    expect(hasImageSize({ fit: 'contain' })).toBe(true);
  });
});

describe('cascade', () => {
  it('treats a bare value as desktop and inherits downwards', () => {
    expect(cascade('a', 'desktop')).toBe('a');
    expect(cascade('a', 'tablet')).toBe('a');
    expect(cascade('a', 'mobile')).toBe('a');
  });
  it('mobile inherits tablet before desktop', () => {
    const v = { desktop: 'd', tablet: 't' };
    expect(cascade(v, 'mobile')).toBe('t');
    expect(cascade({ desktop: 'd', mobile: 'm' }, 'tablet')).toBe('d');
  });
  it('skips empty strings and nulls', () => {
    expect(cascade({ desktop: 'd', tablet: '' as string }, 'tablet')).toBe('d');
    expect(cascade({ desktop: 'd', mobile: null as unknown as string }, 'mobile')).toBe('d');
  });
});

describe('resolveImageSizeAt', () => {
  it('applies defaults', () => {
    expect(resolveImageSizeAt(undefined, 'desktop')).toEqual({
      width: { mode: 'full' },
      height: { mode: 'auto' },
      align: 'start',
    });
  });

  it('clamps numbers and accepts numeric strings', () => {
    const at = resolveImageSizeAt(
      { width_mode: 'px', width_px: '99999' as unknown as number, height_mode: 'px', height_px: 3 },
      'desktop',
    );
    expect(at.width).toEqual({ mode: 'px', px: 2400 });
    expect(at.height).toEqual({ mode: 'px', px: 16 });
  });

  it('falls back to defaults for missing values of a chosen mode', () => {
    const at = resolveImageSizeAt({ width_mode: 'percent', height_mode: 'ratio' }, 'desktop');
    expect(at.width).toEqual({ mode: 'percent', percent: 100 });
    expect(at.height).toEqual({ mode: 'ratio', ratio: '1:1' });
    expect(resolveImageSizeAt({ width_mode: 'px' }, 'desktop').width).toEqual({ mode: 'px', px: 400 });
  });

  it('ignores invalid enum values', () => {
    const at = resolveImageSizeAt(
      { width_mode: 'huge' as never, height_mode: 'ratio', ratio: '5:7' as never, align: 'left' as never },
      'desktop',
    );
    expect(at).toEqual({ width: { mode: 'full' }, height: { mode: 'ratio', ratio: '1:1' }, align: 'start' });
  });

  it('keeps px and percent values separate across breakpoints', () => {
    const s: ImageSizeSettings = {
      width_mode: { desktop: 'px', mobile: 'percent' },
      width_px: 320,
      width_percent: { mobile: 80 },
    };
    expect(resolveImageSizeAt(s, 'tablet').width).toEqual({ mode: 'px', px: 320 });
    expect(resolveImageSizeAt(s, 'mobile').width).toEqual({ mode: 'percent', percent: 80 });
  });

  it('forces full width when a ratio is combined with auto width', () => {
    expect(resolveImageSizeAt({ width_mode: 'auto', height_mode: 'ratio', ratio: '16:9' }, 'desktop').width).toEqual({
      mode: 'full',
    });
    // auto width + px height stays natural (logo at a fixed height)
    expect(resolveImageSizeAt({ width_mode: 'auto', height_mode: 'px', height_px: 40 }, 'desktop').width).toEqual({
      mode: 'auto',
    });
  });
});

describe('resolveImageSizing — css', () => {
  it('emits only a desktop block for defaults', () => {
    const r = resolveImageSizing({}, S);
    expect(r.css).toBe(
      '.isz{position:relative;width:100%;max-width:100%;margin-inline-start:0;margin-inline-end:auto}' +
        '.isz-img{display:block;max-width:100%;width:100%;height:auto;aspect-ratio:auto 1200/1200;object-fit:fill;object-position:center}',
    );
    expect(r.css).not.toContain('@media');
    expect(r.natural).toBe(false);
    expect(r.intrinsic).toEqual({ width: 1200, height: 1200 });
  });

  it('custom px width with max width and centered alignment', () => {
    const r = resolveImageSizing({ width_mode: 'px', width_px: 600, max_width_px: 500, align: 'center' }, S);
    expect(r.css).toContain('.isz{position:relative;width:600px;max-width:min(100%,500px);margin-inline-start:auto;margin-inline-end:auto}');
  });

  it('end alignment uses logical margins (RTL-safe)', () => {
    const r = resolveImageSizing({ width_mode: 'percent', width_percent: 50, align: 'end' }, S);
    expect(r.css).toContain('width:50%');
    expect(r.css).toContain('margin-inline-start:auto;margin-inline-end:0');
    expect(r.css).not.toMatch(/margin-(left|right)/);
  });

  it('ratio height sets aspect-ratio and object-fit/position', () => {
    const r = resolveImageSizing({ height_mode: 'ratio', ratio: '4:5', fit: 'cover', position: 'top' }, S);
    expect(r.css).toContain('.isz-img{display:block;max-width:100%;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;object-position:center top}');
    expect(r.intrinsic).toEqual({ width: 1200, height: 1500 });
  });

  it('px height with contain ignores position', () => {
    const r = resolveImageSizing({ height_mode: 'px', height_px: 300, fit: 'contain', position: 'left' }, S);
    expect(r.css).toContain('height:300px;aspect-ratio:auto 1200/1200;object-fit:contain;object-position:center');
  });

  it('left/right positions stay physical', () => {
    expect(resolveImageSizing({ height_mode: 'px', position: 'left' }, S).css).toContain('object-position:left center');
    expect(resolveImageSizing({ height_mode: 'px', position: 'right' }, S).css).toContain('object-position:right center');
  });

  it('emits only changed declarations for narrower breakpoints', () => {
    const r = resolveImageSizing(
      {
        width_mode: { desktop: 'px', mobile: 'full' },
        width_px: 400,
        height_mode: { desktop: 'ratio', tablet: 'ratio', mobile: 'auto' },
        ratio: { desktop: '16:9', tablet: '1:1' },
        align: { desktop: 'center' },
      },
      S,
    );
    expect(r.css).toBe(
      '.isz{position:relative;width:400px;max-width:100%;margin-inline-start:auto;margin-inline-end:auto}' +
        '.isz-img{display:block;max-width:100%;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:center}' +
        '@media (max-width: 1023px){.isz-img{aspect-ratio:1/1}}' +
        '@media (max-width: 767px){.isz{width:100%}.isz-img{aspect-ratio:auto 1200/675;object-fit:fill}}',
    );
    expect(r.intrinsic).toEqual({ width: 1200, height: 675 });
  });

  it('skips a breakpoint whose resolved state equals the wider one', () => {
    const r = resolveImageSizing({ width_mode: { desktop: 'px', tablet: 'px' }, width_px: { desktop: 300, tablet: 300 } }, S);
    expect(r.css).not.toContain('@media');
  });

  it('auto width is natural (fit-content frame, auto img width)', () => {
    const r = resolveImageSizing({ width_mode: 'auto', height_mode: 'px', height_px: 40 }, S);
    expect(r.natural).toBe(true);
    expect(r.sizes).toBe('');
    expect(r.css).toContain('.isz{position:relative;width:fit-content;');
    expect(r.css).toContain('.isz-img{display:block;max-width:100%;width:auto;height:40px;');
  });

  it('natural on any breakpoint makes the whole image natural', () => {
    const r = resolveImageSizing({ width_mode: { desktop: 'full', mobile: 'auto' } }, S);
    expect(r.natural).toBe(true);
    expect(r.css).toContain('@media (max-width: 767px){.isz{width:fit-content}.isz-img{width:auto}}');
  });

  it('uses the custom fallback intrinsic size', () => {
    const r = resolveImageSizing({}, S, { fallbackIntrinsic: { width: 800, height: 600 } });
    expect(r.intrinsic).toEqual({ width: 800, height: 600 });
    expect(r.css).toContain('aspect-ratio:auto 800/600');
  });
});

describe('resolveImageSizing — sizes', () => {
  it('full width follows the container', () => {
    expect(resolveImageSizing({}, S).sizes).toBe('100vw');
    expect(
      resolveImageSizing({}, S, { container: { desktop: '50vw', tablet: '100vw' } }).sizes,
    ).toBe('(max-width: 1023px) 100vw, 50vw');
  });

  it('px width is the px value, capped by max width', () => {
    expect(resolveImageSizing({ width_mode: 'px', width_px: 320 }, S).sizes).toBe('320px');
    expect(resolveImageSizing({ width_mode: 'px', width_px: 320, max_width_px: 200 }, S).sizes).toBe('200px');
  });

  it('percent scales vw/px containers and falls back to calc()', () => {
    expect(
      resolveImageSizing({ width_mode: 'percent', width_percent: 50 }, S, { container: { desktop: '50vw', tablet: '100vw' } }).sizes,
    ).toBe('(max-width: 1023px) 50vw, 25vw');
    expect(resolveImageSizing({ width_mode: 'percent', width_percent: 50 }, S, { container: { desktop: '1200px' } }).sizes).toBe('600px');
    expect(
      resolveImageSizing({ width_mode: 'percent', width_percent: 25 }, S, { container: { desktop: 'calc(100vw - 32px)' } }).sizes,
    ).toBe('calc(calc(100vw - 32px) * 0.25)');
  });

  it('px width is capped by the container on narrow breakpoints', () => {
    // An inherited desktop 800px on a phone renders at most 100vw.
    expect(resolveImageSizing({ width_mode: 'px', width_px: 800 }, S).sizes).toBe('(max-width: 1023px) min(800px, 100vw), 800px');
    // A px container is resolved statically.
    expect(resolveImageSizing({ width_mode: 'px', width_px: 800 }, S, { container: { desktop: '600px' } }).sizes).toBe('600px');
    // A vw slot that may be narrower than the px width at the breakpoint.
    expect(
      resolveImageSizing({ width_mode: 'px', width_px: 600 }, S, { container: { desktop: '50vw', tablet: '100vw' } }).sizes,
    ).toBe('(max-width: 767px) min(600px, 100vw), (max-width: 1023px) 600px, min(600px, 50vw)');
  });

  it('percent width is capped by max width', () => {
    expect(resolveImageSizing({ width_mode: 'percent', width_percent: 80, max_width_px: 300 }, S).sizes).toBe(
      '(max-width: 767px) min(80vw, 300px), 300px',
    );
    expect(
      resolveImageSizing({ width_mode: 'percent', width_percent: 50, max_width_px: 300 }, S, { container: { desktop: '1200px' } }).sizes,
    ).toBe('300px');
    expect(
      resolveImageSizing({ width_mode: 'percent', width_percent: 25, max_width_px: 300 }, S, { container: { desktop: 'calc(100vw - 32px)' } })
        .sizes,
    ).toBe('min(calc(calc(100vw - 32px) * 0.25), 300px)');
  });

  it('full width with a vw container is capped by max width', () => {
    expect(resolveImageSizing({ max_width_px: 500 }, S).sizes).toBe('(max-width: 767px) min(100vw, 500px), 500px');
  });

  it('full width with a px container is capped by max width', () => {
    expect(resolveImageSizing({ max_width_px: 400 }, S, { container: { desktop: '1200px' } }).sizes).toBe('400px');
  });

  it('per-breakpoint widths produce narrowest-first media conditions', () => {
    const r = resolveImageSizing(
      { width_mode: { desktop: 'px', tablet: 'percent', mobile: 'full' }, width_px: 500, width_percent: 50 },
      S,
    );
    expect(r.sizes).toBe('(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 500px');
  });
});

describe('imageSizeFromLegacy', () => {
  it('maps single-image legacy keys', () => {
    expect(imageSizeFromLegacy({ aspect: 'auto', fit: 'cover' })).toEqual({
      width_mode: 'full',
      height_mode: 'auto',
      fit: 'cover',
      align: 'start',
    });
    expect(imageSizeFromLegacy({ aspect: 'wide', fit: 'contain' })).toMatchObject({ height_mode: 'ratio', ratio: '16:9', fit: 'contain' });
    expect(imageSizeFromLegacy({ aspect: 'square' }).ratio).toBe('1:1');
    expect(imageSizeFromLegacy({ aspect: 'portrait' }).ratio).toBe('3:4');
    expect(imageSizeFromLegacy({ aspect: 'landscape' }).ratio).toBe('4:3');
  });

  it('maps layout-columns width_px', () => {
    expect(imageSizeFromLegacy({ width_px: 180 })).toMatchObject({ width_mode: 'px', width_px: 180 });
    expect(imageSizeFromLegacy({ width_px: 0 })).toMatchObject({ width_mode: 'full' });
    expect(imageSizeFromLegacy(undefined)).toMatchObject({ width_mode: 'full', height_mode: 'auto', fit: 'cover' });
  });

  it('legacy mapping resolves to what the legacy markup shows', () => {
    const r = resolveImageSizing(imageSizeFromLegacy({ width_px: 180, aspect: 'square' }), S);
    expect(r.at.desktop).toEqual({ width: { mode: 'px', px: 180 }, height: { mode: 'ratio', ratio: '1:1' }, align: 'start' });
    expect(r.sizes).toBe('180px');
  });
});
