import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleSwitcher } from './LocaleSwitcher.client';
import { switcherLocales } from '@/lib/storeLocales';

// Kurmanji ('ku') in review: hidden from the switcher, shown (selected) only
// to the reviewer who opened /ku/. Label "Kurdî", a neutral globe, no flag.

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

describe('LocaleSwitcher with ku in review', () => {
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

  it('on /ku/ the current locale is shown as "Kurdî" with a globe, never a flag', () => {
    const { getByRole, getAllByRole, container } = renderSwitcher('ku', ['en', 'ku']);
    const button = getByRole('button');
    expect(button.textContent).toContain('Kurdî');
    // The button carries no flag image (the globe is an inline svg).
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Svenska', 'English', 'Kurdî']);
    const kuItem = getAllByRole('menuitem')[2]!;
    expect(kuItem.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('img').length).toBe(2);
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
