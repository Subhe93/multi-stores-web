import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import sv from '@/i18n/messages/sv.json';
import { CONSENT_OPEN_EVENT } from '@/lib/consent';
import { CookieSettingsLauncher } from './CookieSettingsLauncher';
import { CookieSettingsLink } from './CookieSettingsLink';

// Re-open entry points (plans/consent-v2/CONTRACT.md §4.4, D4): neither the
// footer link nor the desktop pill ever clears a choice; they only open the
// settings dialog.

function wrap(ui: React.ReactNode, messages: Record<string, unknown> = en, locale = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('CookieSettingsLink', () => {
  it('renders on the server as a plain button', () => {
    const html = renderToString(wrap(<CookieSettingsLink variant="footer-row" />, sv, 'sv'));
    expect(html).toContain('data-consent-settings-link');
    expect(html).toContain('Cookieinställningar');
  });

  it('a click dispatches the open event and touches no storage', () => {
    window.localStorage.setItem('consent:namez', 'keep');
    const onOpen = vi.fn();
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    render(wrap(<CookieSettingsLink />));
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('consent:namez')).toBe('keep');
    window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
    window.localStorage.clear();
  });

  it('footer-row wraps it in a centred row; inline renders the bare button', () => {
    const { container, unmount } = render(wrap(<CookieSettingsLink variant="footer-row" />));
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');
    expect((container.firstChild as HTMLElement).className).toContain('justify-center');
    unmount();
    const inline = render(wrap(<CookieSettingsLink variant="inline" />));
    expect((inline.container.firstChild as HTMLElement).tagName).toBe('BUTTON');
  });

  it('has a real touch target (44px on phones, at least 24px on desktop)', () => {
    render(wrap(<CookieSettingsLink />));
    const cls = screen.getByRole('button', { name: 'Cookie settings' }).className;
    expect(cls).toContain('min-h-11');
    expect(cls).toContain('md:min-h-6');
    expect(cls).toContain('px-2');
  });
});

describe('checkout footer', () => {
  it('translates "Return to store" next to the cookie settings link', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/store/[storeSlug]/(checkout)/layout.tsx'), 'utf8');
    expect(src).not.toContain('Return to store');
    expect(src).toContain("t('checkout.returnToStore')");
    expect(sv.checkout.returnToStore).toBe('Tillbaka till butiken');
  });
});

describe('CookieSettingsLauncher', () => {
  it('is desktop-only (hidden below md), at the bottom start corner', () => {
    render(wrap(<CookieSettingsLauncher onOpen={() => {}} />));
    const pill = screen.getByTestId('consent-launcher');
    expect(pill.className).toMatch(/(^| )hidden( |$)/);
    expect(pill.className).toContain('md:inline-flex');
    expect(pill.className).toContain('inset-s-3');
    expect(pill.className).toContain('bottom-3');
    expect(pill).toHaveTextContent('Cookie settings');
  });

  it('moves above a visible sticky CTA bar (--ms-bottom-bar) instead of sharing its corner', () => {
    render(wrap(<CookieSettingsLauncher onOpen={() => {}} />));
    expect(screen.getByTestId('consent-launcher').style.bottom).toBe('calc(0.75rem + var(--ms-bottom-bar, 0px))');
  });

  it('a click only calls onOpen (never clears the stored choice)', () => {
    window.localStorage.setItem('consent:namez', 'keep');
    const onOpen = vi.fn();
    render(wrap(<CookieSettingsLauncher onOpen={onOpen} />));
    fireEvent.click(screen.getByTestId('consent-launcher'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('consent:namez')).toBe('keep');
    window.localStorage.clear();
  });
});

describe('fixed bottom bars sit above the cookie banner', () => {
  const files = [
    'src/themes/minimal/sections/product/AddToCartMagic.client.tsx',
    'src/themes/minimal/sections/product/blocks/ProductBuyBlock.client.tsx',
    'src/themes/minimal/sections/StickyCtaBar.client.tsx',
    'src/themes/minimal/sections/chrome/MobileBottomNav.tsx',
  ];
  it.each(files)('%s uses --ms-consent-inset for `bottom`', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).toContain("bottom: 'var(--ms-consent-inset, 0px)'");
    expect(src).not.toMatch(/className="[^"]*\bfixed\b[^"]*\bbottom-0\b/);
  });

  const toasts = ['src/themes/minimal/sections/product/blocks/b1Shared.tsx', 'src/components/product/ProductDetailClient.tsx'];
  it.each(toasts)('%s lifts its add-to-cart / error toasts above the banner', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).not.toMatch(/className="fixed bottom-6 /);
    expect(src.match(/calc\(1\.5rem \+ var\(--ms-consent-inset, 0px\)\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
