import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import sv from '@/i18n/messages/sv.json';
import { clearExternalMediaConsent, grantExternalMediaConsent } from '@/lib/consent';
import { embedAllowed } from '@/lib/productVideo';
import { MapSection } from './MapSection.client';

// Map facade under consent v2 (plans/consent-v2/CONTRACT.md §4.5): "Show
// map" loads once, "Always allow external media" grants the store's
// external-media consent and loads; with the consent the map loads without
// the facade, but never in SSR markup.

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const SLUG = 'namez';

function clearAll() {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
}

beforeEach(() => {
  clearAll();
  // The grant logs the decision; never hit the network from tests.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
});
afterEach(clearAll);

function section(messages: Record<string, unknown> = en, locale = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MapSection
        settings={{ layout: 'full' }}
        content={{ locations: [{ name: 'Namez', address: 'Storgatan 1, Stockholm' }] }}
        locale={locale}
        primaryLocale="sv"
        storeSlug={SLUG}
      />
    </NextIntlClientProvider>
  );
}

const iframe = () => document.querySelector('iframe');

describe('MapSection consent facade', () => {
  it('shows the facade with two equally styled buttons and no iframe', () => {
    render(section(sv, 'sv'));
    expect(iframe()).toBeNull();
    const load = screen.getByRole('button', { name: 'Visa karta' });
    const always = screen.getByRole('button', { name: 'Tillåt alltid externa medier' });
    expect(always.className).toBe(load.className);
    expect(always.getAttribute('style')).toBe(load.getAttribute('style'));
    expect(document.querySelector('[data-map-facade] [data-consent-text]')).not.toBeNull();
  });

  it('"Show map" loads this map once without storing consent', () => {
    render(section());
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }));
    expect(iframe()).not.toBeNull();
    expect(embedAllowed(SLUG)).toBe(false);
  });

  it('"Always allow external media" grants the consent and loads the map', () => {
    render(section());
    fireEvent.click(screen.getByRole('button', { name: 'Always allow external media' }));
    expect(iframe()?.getAttribute('src')).toContain('maps.google.com');
    expect(embedAllowed(SLUG)).toBe(true);
  });

  it('logs the grant with the sha256 of the facade text the visitor read (not a fixed marker)', async () => {
    render(section(sv, 'sv'));
    fireEvent.click(screen.getByRole('button', { name: 'Tillåt alltid externa medier' }));
    const fetchMock = vi.mocked(fetch);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body).toMatchObject({ action: 'external_media_grant', source: 'facade', external_media: true });
    expect(body.text_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('withdrawing external media unloads a map loaded by a click', () => {
    render(section());
    fireEvent.click(screen.getByRole('button', { name: 'Always allow external media' }));
    expect(iframe()).not.toBeNull();
    act(() => clearExternalMediaConsent(SLUG));
    expect(iframe()).toBeNull();
    expect(document.querySelector('[data-map-facade]')).not.toBeNull();
  });

  it('facade buttons show a keyboard focus ring', () => {
    render(section());
    expect(screen.getByRole('button', { name: 'Show map' }).className).toContain('focus-visible:outline');
  });

  it('auto-loads when the consent already exists, and reacts to a grant elsewhere', () => {
    const { unmount } = render(section());
    expect(iframe()).toBeNull();
    act(() => grantExternalMediaConsent(SLUG));
    expect(iframe()).not.toBeNull();
    unmount();
    render(section());
    expect(iframe()).not.toBeNull();
    expect(document.querySelector('[data-map-facade]')).toBeNull();
  });

  it('never renders the iframe in SSR markup, even with consent', () => {
    grantExternalMediaConsent(SLUG);
    const html = renderToString(section());
    expect(html).not.toContain('<iframe');
    expect(html).toContain('data-map-facade');
  });
});
