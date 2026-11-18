import { describe, expect, it } from 'vitest';
import { LOGO_HEIGHT_MAX, LOGO_MAX_ASPECT, headerLogoBox, parseLogoFit } from './headerLogo';

describe('parseLogoFit', () => {
  it("is 'height' only for that exact string", () => {
    expect(parseLogoFit('height')).toBe('height');
    for (const raw of [undefined, null, '', 'box', 'x', 'Height', ' height', 1, true, {}, ['height']]) {
      expect(parseLogoFit(raw), String(raw)).toBe('box');
    }
  });
});

describe('headerLogoBox', () => {
  it('box: the square the header always drew, style keys in the stored order', () => {
    for (const size of [16, 32, 44, 100]) {
      const box = headerLogoBox('box', size);
      expect(box).toEqual({
        width: size,
        height: size,
        sizes: `${size}px`,
        style: { width: size, height: size },
        className: 'object-contain shrink-0',
        nameClassName: '',
      });
      expect(Object.keys(box.style)).toEqual(['width', 'height']);
    }
  });

  it('height: fixed height, automatic width under a cap of five times the height', () => {
    const box = headerLogoBox('height', 40);
    expect(box).toEqual({
      width: 40,
      height: 40,
      sizes: '200px',
      style: { height: 40, width: 'auto', maxWidth: 'min(200px, 50vw)' },
      className: 'object-contain min-w-0',
      // The name gives way before the logo, which can shrink in this mode.
      nameClassName: 'shrink-[999]',
    });
    expect(Object.keys(box.style)).toEqual(['height', 'width', 'maxWidth']);
  });

  it('height: clamps at the tallest logo the bar holds', () => {
    expect(LOGO_HEIGHT_MAX).toBe(56);
    expect(LOGO_MAX_ASPECT).toBe(5);
    expect(headerLogoBox('height', 56).style).toEqual({ height: 56, width: 'auto', maxWidth: 'min(280px, 50vw)' });
    const clamped = headerLogoBox('height', 96);
    expect(clamped.width).toBe(56);
    expect(clamped.height).toBe(56);
    expect(clamped.sizes).toBe('280px');
    expect(clamped.style).toEqual({ height: 56, width: 'auto', maxWidth: 'min(280px, 50vw)' });
    // The square box is never clamped.
    expect(headerLogoBox('box', 96).style).toEqual({ width: 96, height: 96 });
  });
});
