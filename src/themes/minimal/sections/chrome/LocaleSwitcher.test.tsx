import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleSwitcher } from './LocaleSwitcher.client';

function renderSwitcher(current = 'ar', others = ['ar', 'sv']) {
  return render(
    <LocaleSwitcher current={current} primary="en" others={others} accent="#111" bg="#fff" fg="#000" borderColor="#ddd" />,
  );
}

const flags = (container: HTMLElement) => [...container.querySelectorAll('img')];
/** Every class token of the switcher, the flags and all their wrappers included. */
const allTokens = (container: HTMLElement) =>
  [...container.querySelectorAll('*')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

// Flags that carry writing (Saudi Arabia, Iran) must be shown whole: never
// cropped, never mirrored, in their own proportions.
describe('LocaleSwitcher flags', () => {
  it('draws the whole flag in a fixed 24x16 slot, in its own proportions', () => {
    const { container } = renderSwitcher();
    const [flag] = flags(container);
    expect(flag.getAttribute('src')).toBe('https://flagcdn.com/sa.svg');
    expect(flag.getAttribute('width')).toBe('24');
    expect(flag.getAttribute('height')).toBe('16');
    const tokens = (flag.getAttribute('class') ?? '').split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(['object-contain', 'h-4', 'w-6', 'shrink-0']));
    // Nothing that crops, clips or covers the artwork.
    expect(tokens).not.toContain('object-cover');
    expect(tokens.filter((t) => t.startsWith('rounded') || t.startsWith('ring') || t.startsWith('overflow'))).toEqual([]);
    // Decorative: the language name next to it is the label.
    expect(flag.getAttribute('alt')).toBe('');
    expect(flag.getAttribute('aria-hidden')).toBe('true');
  });

  it('never mirrors a flag: no rtl or scale class on the flags or around them, closed and open', () => {
    const MIRROR = /scale-x|^rtl:|-scale-|rotate-y/;
    const { container, getByRole } = renderSwitcher('ar');
    expect(allTokens(container).filter((t) => MIRROR.test(t))).toEqual([]);
    fireEvent.click(getByRole('button'));
    // Open: one flag on the button, one per language in the list.
    expect(flags(container).map((f) => f.getAttribute('src'))).toEqual([
      'https://flagcdn.com/sa.svg',
      'https://flagcdn.com/gb.svg',
      'https://flagcdn.com/sa.svg',
      'https://flagcdn.com/se.svg',
    ]);
    expect(allTokens(container).filter((t) => MIRROR.test(t))).toEqual([]);
    for (const flag of flags(container)) {
      const tokens = (flag.getAttribute('class') ?? '').split(/\s+/);
      expect(tokens).toContain('object-contain');
      expect(tokens).not.toContain('object-cover');
      expect(flag.getAttribute('style')).toBeNull();
    }
  });

  it('every flag gets the same treatment (Iran for a stored fa locale)', () => {
    const { container } = renderSwitcher('fa', ['fa']);
    const [flag] = flags(container);
    expect(flag.getAttribute('src')).toBe('https://flagcdn.com/ir.svg');
    expect((flag.getAttribute('class') ?? '').split(/\s+/)).toContain('object-contain');
  });

  it('falls back to the globe when the image fails or the locale has no flag', () => {
    const { container } = renderSwitcher('ar');
    expect(container.querySelector('svg.lucide-globe')).toBeNull();
    fireEvent.error(flags(container)[0]);
    expect(flags(container)).toHaveLength(0);
    expect(container.querySelector('svg.lucide-globe')).not.toBeNull();
    const unknown = renderSwitcher('xx', ['xx']);
    expect(flags(unknown.container)).toHaveLength(0);
    expect(unknown.container.querySelector('svg.lucide-globe')).not.toBeNull();
  });

  it('a single-language store renders nothing', () => {
    const { container } = renderSwitcher('en', []);
    expect(container.innerHTML).toBe('');
  });
});
