import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleSwitcher } from './LocaleSwitcher.client';
import { switcherLocales } from '@/lib/storeLocales';
import { injectReviewLocales } from '@/test/reviewLocales';

// Kurmanji ('ku'): shown in the switcher like any locale now that it left
// review. The review mechanism (hidden, shown only to the reviewer who opened
// /ku/) is covered with ku injected as a review locale. Label "Kurdî" with the bundled Kurdistan flag.

function renderSwitcher(current: string, secondary: string[]) {
  return render(
    <LocaleSwitcher
      current={current}
      primary="sv"
      others={switcherLocales('sv', secondary, current)}
      accent="#111"
      bg="#fff"
      fg="#000"
      borderColor="#ddd"
    />,
  );
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe('LocaleSwitcher with ku in review (ku injected)', () => {
  injectReviewLocales('ku');

  it('ku is not listed on the public locales', () => {
    const { getByRole, queryByText, getAllByRole } = renderSwitcher('sv', ['en', 'ku']);
    fireEvent.click(getByRole('button'));
    expect(getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Svenska', 'English']);
    expect(queryByText('Kurdî')).toBeNull();
  });

  it('a store whose only extra locale is ku shows no switcher', () => {
    const { container } = renderSwitcher('sv', ['ku']);
    expect(container.innerHTML).toBe('');
  });

  it('on /ku/ the current locale is shown as "Kurdî" with the Kurdistan flag', () => {
    const { getByRole, getAllByRole, container } = renderSwitcher('ku', ['en', 'ku']);
    const button = getByRole('button');
    expect(button.textContent).toContain('Kurdî');
    // The button carries no flag image (the globe is an inline svg).
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/flags/kurdistan.svg');
    fireEvent.click(button);
    expect(getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Svenska', 'English', 'Kurdî']);
    const kuItem = getAllByRole('menuitem')[2]!;
    expect(kuItem.querySelector('img')?.getAttribute('src')).toBe('/flags/kurdistan.svg');
    expect(container.querySelectorAll('img').length).toBe(4);
  });

  it('switching back from /ku/ strips the ku prefix', () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, pathname: '/ku/products/x', search: '?a=1', assign },
    });
    restore = () => Object.defineProperty(window, 'location', { configurable: true, value: original });
    const { getByRole, getAllByRole } = renderSwitcher('ku', ['en', 'ku']);
    fireEvent.click(getByRole('button'));
    fireEvent.click(getAllByRole('menuitem')[0]!);
    expect(assign).toHaveBeenCalledWith('/products/x?a=1');
    // The list stays open (navigation is mocked).
    fireEvent.click(getAllByRole('menuitem')[1]!);
    expect(assign).toHaveBeenLastCalledWith('/en/products/x?a=1');
  });
});

describe('LocaleSwitcher with ku as a normal locale', () => {
  it('ku is listed as "Kurdî" with the bundled Kurdistan flag on the primary page', () => {
    const { getByRole, getAllByRole, queryByText, container } = renderSwitcher('sv', ['en', 'ku']);
    fireEvent.click(getByRole('button'));
    expect(getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Svenska', 'English', 'Kurdî']);
    expect(queryByText('Kurdî')).not.toBeNull();
    const kuImg = getAllByRole('menuitem')[2]!.querySelector('img')!;
    expect(kuImg.getAttribute('src')).toBe('/flags/kurdistan.svg');
    expect(kuImg.getAttribute('width')).toBe('24');
    expect(kuImg.getAttribute('height')).toBe('16');
    expect(kuImg.getAttribute('class') ?? '').toContain('object-contain');
    expect(container.querySelectorAll('img').length).toBe(4);
  });

  it('a store whose only extra locale is ku shows the switcher', () => {
    const { container } = renderSwitcher('sv', ['ku']);
    expect(container.innerHTML).not.toBe('');
  });
});
