import { describe, expect, it } from 'vitest';
import { sceneProps, sceneValue } from './scene';

describe('sceneValue', () => {
  it('keeps the three scenes', () => {
    expect(sceneValue('dark')).toBe('dark');
    expect(sceneValue('light')).toBe('light');
    expect(sceneValue('accent')).toBe('accent');
  });
  it.each(['none', '', 'Dark', 'primary', 1, null, undefined])('%j is no scene', (raw) => {
    expect(sceneValue(raw)).toBeNull();
  });
});

describe('sceneProps', () => {
  it('no scene and no override renders nothing', () => {
    expect(sceneProps(null)).toEqual({});
    expect(sceneProps(null, {})).toEqual({});
    expect(sceneProps(null, { bg: '', text: undefined, accent: null })).toEqual({});
  });

  it('a scene alone is one attribute, no inline style', () => {
    expect(sceneProps('dark')).toEqual({ 'data-cx-scene': 'dark' });
  });

  it('hex overrides become inline variables', () => {
    expect(sceneProps('accent', { bg: '#AA2233', text: '#fff', accent: '#11111180' })).toEqual({
      'data-cx-scene': 'accent',
      style: { '--cx-bg': '#AA2233', '--cx-fg': '#fff', '--cx-ac': '#11111180' },
    });
  });

  it('an override without a scene uses the light scene', () => {
    expect(sceneProps(null, { bg: '#F4F1EA' })).toEqual({
      'data-cx-scene': 'light',
      style: { '--cx-bg': '#F4F1EA' },
    });
  });

  it.each(['red', 'rgb(0,0,0)', '#12', '#12345', 'url(x)', '#fff;color:red', 123, {}])(
    'ignores a non-hex override (%j)',
    (value) => {
      expect(sceneProps('dark', { bg: value })).toEqual({ 'data-cx-scene': 'dark' });
      expect(sceneProps(null, { text: value })).toEqual({});
    },
  );
});
