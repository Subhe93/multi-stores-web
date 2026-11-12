import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HeaderBarMobileMenu } from './HeaderBarMobileMenu.client';
import { requestMobileMenu } from './mobileMenuEvent';

// next-intl: return the key (plus values) so labels are assertable.
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string>) =>
    `${ns ? `${ns}.` : ''}${key}${values?.label ? `:${values.label}` : ''}`,
}));

const listeners = new Set<() => void>();
let desktop = false;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return desktop;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
});

const items = [
  { label: 'Shop', url: '/products', children: [{ label: 'New', url: '/products?sort=newest' }] },
  { label: 'About', url: '/about' },
];

function renderMenu() {
  return render(
    <div className="store-root">
      <HeaderBarMobileMenu items={items} fg="#000" bg="#fff" ariaLabel="Open menu" />
    </div>,
  );
}

describe('HeaderBarMobileMenu', () => {
  it('opens a named dialog, moves focus in and returns it on Escape', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'nav.menu' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Tab inside the dialog', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'common.close' });
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button');
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('labels the sub-menu toggle with the item name', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const toggle = screen.getByRole('button', { name: 'nav.expand:Shop' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'nav.collapse:Shop' })).toBeTruthy();
  });

  it('opens on a request from the bottom nav and reports it handled', () => {
    renderMenu();
    let handled = false;
    act(() => {
      handled = requestMobileMenu();
    });
    expect(handled).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes and releases the scroll lock when the viewport grows to desktop', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.body.style.overflow).toBe('hidden');
    desktop = true;
    act(() => listeners.forEach((fn) => fn()));
    desktop = false;
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
