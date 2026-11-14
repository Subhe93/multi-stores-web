import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import {
  clearConsent,
  clearExternalMediaConsent,
  grantExternalMediaConsent,
  readConsent,
  readExternalMediaConsent,
  writeConsent,
} from '@/lib/consent';
import { StoreTracking } from './StoreTracking';
import { ExternalMediaManageLink } from './ExternalMediaManageLink';

// Revoking "Always allow external videos" (product-video CONTRACT-AUTOPLAY
// 6.6): the cookie-settings pill of tracking stores also shows for (and
// clears) the external-media grant; stores without tracking get their own
// "Turn off external videos" pill.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSelectedLayoutSegments: () => [],
}));
vi.mock('./pageReload', () => ({ reloadPage: vi.fn() }));
vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => <script data-testid="tracker" id={id} data-src={src} />,
}));

const SLUG = 'namez';
const tracking = { ga4_measurement_id: 'G-ABCD1234', meta_pixel_id: null, tiktok_pixel_id: null, consent_required: true };
const noTracking = { ga4_measurement_id: null, meta_pixel_id: null, tiktok_pixel_id: null, consent_required: true };

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

function resetAll() {
  window.localStorage.clear();
  clearConsent(SLUG);
  clearExternalMediaConsent(SLUG);
}

beforeEach(resetAll);
afterEach(resetAll);

describe('StoreTracking pill and the external-media grant', () => {
  it('shows "Cookie settings" when only the external grant is set (banner still asks for tracking)', async () => {
    grantExternalMediaConsent(SLUG);
    render(wrap(<StoreTracking storeSlug={SLUG} tracking={tracking} />));
    expect(await screen.findByRole('button', { name: 'Cookie settings' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('one click on the pill clears the tracking choice and the external grant', async () => {
    writeConsent(SLUG, 'denied');
    grantExternalMediaConsent(SLUG);
    render(wrap(<StoreTracking storeSlug={SLUG} tracking={tracking} />));
    fireEvent.click(await screen.findByRole('button', { name: 'Cookie settings' }));
    expect(readConsent(SLUG)).toBeNull();
    expect(readExternalMediaConsent(SLUG)).toBe(false);
  });

  it('a store without tracking ids renders only the pill, and only while the grant is set', async () => {
    const { container } = render(wrap(<StoreTracking storeSlug={SLUG} tracking={noTracking} />));
    expect(container.innerHTML).toBe('');
    act(() => grantExternalMediaConsent(SLUG));
    expect(await screen.findByRole('button', { name: 'Cookie settings' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('SSR output is unchanged (nothing before hydration)', () => {
    expect(renderToString(wrap(<StoreTracking storeSlug={SLUG} tracking={tracking} />))).toBe('');
  });
});

describe('ExternalMediaManageLink', () => {
  it('renders nothing on the server and without the grant', () => {
    expect(renderToString(wrap(<ExternalMediaManageLink storeSlug={SLUG} />))).toBe('');
    const { container } = render(wrap(<ExternalMediaManageLink storeSlug={SLUG} />));
    expect(container.innerHTML).toBe('');
  });

  it('shows "Turn off external videos" while granted; a click revokes it and hides the pill', async () => {
    grantExternalMediaConsent(SLUG);
    render(wrap(<ExternalMediaManageLink storeSlug={SLUG} />));
    const pill = await screen.findByRole('button', { name: 'Turn off external videos' });
    fireEvent.click(pill);
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Turn off external videos' })).toBeNull();
  });

  it('the store layout mounts it only for stores without tracking ids', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/store/[storeSlug]/layout.tsx'), 'utf8');
    expect(src).toContain('{!hasTracking && <ExternalMediaManageLink storeSlug={storeSlug} />}');
    expect(src).toMatch(/\{hasTracking && \(\s*<StoreTracking /);
  });
});
