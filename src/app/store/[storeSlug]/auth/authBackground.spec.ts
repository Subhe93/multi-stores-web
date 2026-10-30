import { describe, expect, it } from 'vitest';
import { resolveAuthBackground } from './authBackground';

describe('resolveAuthBackground', () => {
  it('returns null when nothing usable is set', () => {
    expect(resolveAuthBackground(undefined)).toBeNull();
    expect(resolveAuthBackground({})).toBeNull();
    expect(resolveAuthBackground([])).toBeNull();
    expect(resolveAuthBackground({ image_position: 'top', overlay_opacity: 30 })).toBeNull();
  });

  it('normalises a full config', () => {
    expect(
      resolveAuthBackground({
        background_image: '/uploads/auth/bg.webp',
        background_color: '#FFE9A8',
        image_position: 'bottom',
        overlay_opacity: 25,
      }),
    ).toEqual({ image: '/uploads/auth/bg.webp', color: '#FFE9A8', position: 'bottom', overlay: 0.25 });
  });

  it('accepts a colour-only config without overlay', () => {
    expect(resolveAuthBackground({ background_color: '#fff', overlay_opacity: 50 })).toEqual({
      image: undefined,
      color: '#fff',
      position: 'center',
      overlay: 0,
    });
  });

  it('drops unsafe values and clamps the overlay', () => {
    expect(resolveAuthBackground({ background_image: 'javascript:alert(1)' })).toBeNull();
    expect(resolveAuthBackground({ background_image: '//evil.com/x.png' })).toBeNull();
    expect(resolveAuthBackground({ background_color: 'red;x:y' })).toBeNull();
    expect(
      resolveAuthBackground({ background_image: 'https://cdn.x/a.jpg', image_position: 'left', overlay_opacity: 500 }),
    ).toEqual({ image: 'https://cdn.x/a.jpg', color: undefined, position: 'center', overlay: 0.9 });
  });
});
