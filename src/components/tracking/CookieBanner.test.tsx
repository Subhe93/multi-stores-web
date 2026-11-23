import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import sv from '@/i18n/messages/sv.json';
import ar from '@/i18n/messages/ar.json';
import de from '@/i18n/messages/de.json';
import fr from '@/i18n/messages/fr.json';
import tr from '@/i18n/messages/tr.json';
import ku from '@/i18n/messages/ku.json';
import { consentText } from '@/lib/consentLog';
import { CONSENT_INSET_VAR, CookieBanner, consentSentences, type CookieBannerProps } from './CookieBanner';

// First layer (plans/consent-v2/CONTRACT.md §4.2, §9 web-ui).

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/consentLog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/consentLog')>()),
  consentTextHash: vi.fn(async () => 'a'.repeat(64)),
}));

function renderBanner(props: Partial<CookieBannerProps> = {}, messages: Record<string, unknown> = en, locale = 'en') {
  const handlers = { onAcceptAll: vi.fn(), onRejectAll: vi.fn(), onOpenSettings: vi.fn() };
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CookieBanner
        offered={{ analytics: true, marketing: true }}
        recordings={false}
        cookiePolicyHref="/om-cookies"
        privacyHref="/legal/privacy"
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...utils, ...handlers };
}

const buttons = () => Array.from(screen.getByTestId('consent-banner').querySelectorAll('button'));

beforeEach(() => {
  document.documentElement.style.removeProperty(CONSENT_INSET_VAR);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('CookieBanner', () => {
  it('is a non-modal region labelled by its title and described by its body', () => {
    renderBanner();
    const region = screen.getByRole('region', { name: 'We use cookies' });
    expect(region).toHaveAttribute('data-testid', 'consent-banner');
    expect(region).not.toHaveAttribute('aria-modal');
    expect(region.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders three buttons in DOM order Accept all, Reject all, Settings with one identical class and style', () => {
    renderBanner();
    const [accept, reject, settings] = buttons();
    expect(buttons()).toHaveLength(3);
    expect([accept, reject, settings].map((b) => b.textContent)).toEqual(['Accept all', 'Reject all', 'Settings']);
    expect(reject.className).toBe(accept.className);
    expect(settings.className).toBe(accept.className);
    expect(reject.getAttribute('style')).toBe(accept.getAttribute('style'));
    expect(settings.getAttribute('style')).toBe(accept.getAttribute('style'));
  });

  it('uses the Swedish copy', () => {
    renderBanner({}, sv, 'sv');
    expect(buttons().map((b) => b.textContent)).toEqual(['Acceptera alla', 'Avböj alla', 'Inställningar']);
    expect(screen.getByText(/Cookieinställningar längst ner på sidan/)).toBeInTheDocument();
  });

  it('picks the body variant from the offered categories', () => {
    // The body paragraph holds one block per sentence (M166 E): match its text.
    const byText = (text: string) => screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === text);
    const { unmount } = renderBanner({ offered: { analytics: true, marketing: false } });
    expect(byText(en.consent.bodyAnalytics)).toBeInTheDocument();
    unmount();
    const second = renderBanner({ offered: { analytics: false, marketing: true } });
    expect(byText(en.consent.bodyMarketing)).toBeInTheDocument();
    second.unmount();
    renderBanner();
    expect(byText(en.consent.bodyAnalyticsMarketing)).toBeInTheDocument();
  });

  it('links the cookie page only when it exists; the privacy page always', () => {
    const { unmount } = renderBanner();
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/om-cookies');
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/legal/privacy');
    unmount();
    renderBanner({ cookiePolicyHref: null });
    expect(screen.queryByRole('link', { name: 'Cookie policy' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument();
  });

  it('shows the recordings sentence only with Clarity', () => {
    const { unmount } = renderBanner();
    expect(screen.queryByText(en.consent.recordings)).toBeNull();
    unmount();
    renderBanner({ recordings: true });
    expect(screen.getByText(en.consent.recordings)).toBeInTheDocument();
  });

  it('hashes the rendered text, then calls back once per decision', async () => {
    const { onAcceptAll, onRejectAll, onOpenSettings } = renderBanner();
    const [accept, reject, settings] = buttons();
    fireEvent.click(accept);
    await waitFor(() => expect(onAcceptAll).toHaveBeenCalledWith('a'.repeat(64)));
    fireEvent.click(reject);
    await waitFor(() => expect(onRejectAll).toHaveBeenCalledWith('a'.repeat(64)));
    fireEvent.click(settings);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it('a double tap while hashing saves only once', async () => {
    const { onAcceptAll } = renderBanner();
    const [accept] = buttons();
    fireEvent.click(accept);
    fireEvent.click(accept);
    await waitFor(() => expect(onAcceptAll).toHaveBeenCalled());
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it('marks the decision text with data-consent-text, never the buttons container', () => {
    renderBanner({ recordings: true });
    const marked = Array.from(screen.getByTestId('consent-banner').querySelectorAll('[data-consent-text]')).map(
      (el) => el.textContent,
    );
    expect(marked).toContain('We use cookies');
    expect(marked).toContain(en.consent.bodyAnalyticsMarketing);
    expect(marked).toContain(en.consent.recordings);
    expect(marked).toContain('Accept all');
  });

  it('sets --ms-consent-inset from its height and pads the body; removes it on unmount', () => {
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    let height = 120;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height, width: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    );
    const { unmount, container } = renderBanner();
    const html = document.documentElement;
    expect(html.style.getPropertyValue(CONSENT_INSET_VAR)).toBe('120px');
    expect(container.querySelector('style')?.textContent).toBe('body{padding-bottom:var(--ms-consent-inset,0px)}');
    height = 180.4;
    act(() => observers.forEach((cb) => cb()));
    expect(html.style.getPropertyValue(CONSENT_INSET_VAR)).toBe('181px');
    unmount();
    expect(html.style.getPropertyValue(CONSENT_INSET_VAR)).toBe('');
    rect.mockRestore();
  });

  it('ESC does nothing and the banner never steals focus', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const { onAcceptAll, onRejectAll, onOpenSettings } = renderBanner();
    expect(document.activeElement).toBe(outside);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(screen.getByTestId('consent-banner'), { key: 'Escape' });
    expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
    expect(onAcceptAll).not.toHaveBeenCalled();
    expect(onRejectAll).not.toHaveBeenCalled();
    expect(onOpenSettings).not.toHaveBeenCalled();
    outside.remove();
  });

  it('mobile sheet / desktop card layout classes use logical insets (RTL-safe)', () => {
    renderBanner();
    const cls = screen.getByTestId('consent-banner').className;
    expect(cls).toContain('max-md:inset-x-0');
    // Small-viewport unit: the sheet never grows under Safari's toolbar.
    expect(cls).toContain('max-md:max-h-[50svh]');
    expect(cls).toContain('md:inset-s-4');
    expect(cls).toContain('md:max-w-[34rem]');
    expect(cls).not.toMatch(/\b(left|right)-/);
  });

  it('only the text scrolls: the three buttons sit in a non-shrinking footer, always visible', () => {
    renderBanner();
    const root = screen.getByTestId('consent-banner');
    expect(root.className).toContain('flex-col');
    expect(root.className).not.toContain('overflow-y-auto');
    const scroller = screen.getByRole('heading', { name: 'We use cookies' }).parentElement!;
    expect(scroller.className).toContain('overflow-y-auto');
    expect(scroller.className).toContain('min-h-0');
    const footer = buttons()[0].parentElement!.parentElement!;
    expect(footer.className).toContain('shrink-0');
    expect(scroller.contains(buttons()[0])).toBe(false);
  });

  it('stacks below full-height overlays (cart drawer z-50, mobile menu z-40) and above the bottom bars (z-30)', () => {
    renderBanner();
    expect(screen.getByTestId('consent-banner').className).toContain('z-[35]');
  });

  it('hidden (dialog open): stays mounted and keeps its inset, but is invisible and inert', () => {
    renderBanner({ hidden: true });
    const root = screen.getByTestId('consent-banner');
    expect(root.style.visibility).toBe('hidden');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.hasAttribute('inert')).toBe(true);
  });
});

// M166 E: the body is one block per sentence (smaller LCP candidates) while
// the text, and so the consent text hash, stays exactly the same.
describe('CookieBanner sentence blocks (M166 E)', () => {
  const BODY_KEYS = ['bodyAnalyticsMarketing', 'bodyAnalytics', 'bodyMarketing'] as const;
  const ALL = { en, sv, de, fr, tr, ar, ku } as Record<string, { consent: Record<string, string> }>;

  it('splitting never changes the text, in every locale and variant', () => {
    for (const [locale, messages] of Object.entries(ALL)) {
      for (const key of BODY_KEYS) {
        const text = messages.consent[key]!;
        const parts = consentSentences(text);
        expect(parts.join(''), `${locale}.${key}`).toBe(text);
        expect(parts.length, `${locale}.${key}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('renders one block per sentence with the same textContent as one paragraph', () => {
    for (const offered of [
      { analytics: true, marketing: true },
      { analytics: true, marketing: false },
      { analytics: false, marketing: true },
    ]) {
      const { unmount } = renderBanner({ offered });
      const key = offered.analytics && offered.marketing ? 'bodyAnalyticsMarketing' : offered.marketing ? 'bodyMarketing' : 'bodyAnalytics';
      const banner = screen.getByTestId('consent-banner');
      const p = banner.querySelector('p[data-consent-text]')!;
      expect(p.textContent).toBe(en.consent[key]);
      const blocks = p.querySelectorAll(':scope > span.block');
      expect(blocks.length).toBe(consentSentences(en.consent[key]).length);
      // Hash input: the body line equals the plain sentence text.
      expect(consentText(banner).split(/\n/)).toContain(en.consent[key]);
      unmount();
    }
  });

  it('splits Arabic (caseless script) on sentence ends', () => {
    const text = ar.consent.bodyAnalyticsMarketing;
    renderBanner({}, ar, 'ar');
    const p = screen.getByTestId('consent-banner').querySelector('p[data-consent-text]')!;
    expect(p.textContent).toBe(text);
    expect(p.querySelectorAll('span.block').length).toBeGreaterThanOrEqual(2);
  });

  it('abbreviations never end a sentence', () => {
    expect(consentSentences('Zum Beispiel z. B. Analyse. Danach mehr.')).toEqual(['Zum Beispiel z. B. Analyse. ', 'Danach mehr.']);
    expect(consentSentences('Use e.g. YouTube here. Then go.')).toEqual(['Use e.g. YouTube here. ', 'Then go.']);
    expect(consentSentences('One sentence only.')).toEqual(['One sentence only.']);
  });
});
