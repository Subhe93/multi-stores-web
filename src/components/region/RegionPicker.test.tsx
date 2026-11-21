import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import en from '@/i18n/messages/en.json';
import ar from '@/i18n/messages/ar.json';
import tr from '@/i18n/messages/tr.json';
import de from '@/i18n/messages/de.json';
import fr from '@/i18n/messages/fr.json';
import sv from '@/i18n/messages/sv.json';
import ku from '@/i18n/messages/ku.json';
import { MarketProvider, usePreferredCountry } from '@/hooks/useMarket';
import type { MarketRoute } from '@/lib/market';
import { NAMEZ_EU as EU, NAMEZ_MARKETS as MARKETS, NAMEZ_SE as SE } from '@/test/regionFixtures';
import { physicalClasses } from '@/themes/minimal/sections/_shared/testHelpers';

const MESSAGES: Record<string, Record<string, unknown>> = { en, ar, tr, de, fr, sv, ku };
const state = vi.hoisted(() => ({ locale: 'en', items: [] as unknown[], token: null as string | null }));

function lookup(locale: string, path: string): string {
  const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], MESSAGES[locale]);
  return typeof v === 'string' ? v : path;
}

vi.mock('next-intl', () => ({
  useLocale: () => state.locale,
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const raw = lookup(state.locale, ns ? `${ns}.${key}` : key);
    return raw.replace(/\{(\w+)\}/g, (_, p: string) => String(params?.[p] ?? `{${p}}`));
  },
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ items: state.items }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: state.token }) }));

import { RegionPicker } from './RegionPicker';

const assign = vi.fn();

function stubLocation(pathname: string, search = '') {
  vi.stubGlobal('location', {
    ...window.location,
    pathname,
    search,
    hash: '',
    protocol: 'http:',
    href: `http://localhost${pathname}${search}`,
    assign,
  });
}

function clearCookie() {
  document.cookie = 'ms-region=; path=/; max-age=0';
}

function Probe() {
  return <i data-testid="probe">{usePreferredCountry() ?? 'none'}</i>;
}

function renderPicker(opts: { market?: MarketRoute; markets?: MarketRoute[]; preferred?: string | null; variant?: 'header' | 'drawer' | 'strip'; extra?: ReactNode; motion?: 'scroll' } = {}) {
  return render(
    <MarketProvider market={opts.market ?? EU} markets={opts.markets ?? MARKETS} preferredCountry={opts.preferred ?? null}>
      <RegionPicker storeSlug="namez-se" variant={opts.variant ?? 'header'} motion={opts.motion} />
      <Probe />
      {opts.extra}
    </MarketProvider>,
  );
}

const trigger = () => screen.getByTestId('region-trigger');
const open = () => {
  fireEvent.click(trigger());
  return screen.getByRole('dialog');
};
const countryRadios = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLInputElement>('input[name="region-country"]')];
const languageLabels = (dialog: HTMLElement) =>
  [...within(dialog).getByTestId('region-languages').querySelectorAll('label')].map((l) => l.textContent);

beforeEach(() => {
  state.locale = 'de';
  state.items = [];
  state.token = null;
  assign.mockClear();
  clearCookie();
  stubLocation('/de/products/x', '?sort=1');
});
afterEach(clearCookie);

describe('RegionPicker: when it renders', () => {
  it('renders nothing with one market or without the markets app', () => {
    const one = renderPicker({ market: SE, markets: [SE] });
    expect(one.queryByTestId('region-trigger')).toBeNull();
    one.unmount();
    const none = render(
      <MarketProvider market={null} markets={[]}>
        <RegionPicker storeSlug="s" variant="header" />
      </MarketProvider>,
    );
    expect(none.queryByTestId('region-trigger')).toBeNull();
  });
});

describe('RegionPicker: trigger', () => {
  it('shows the stored country, currency and language', () => {
    renderPicker({ preferred: 'BE' });
    const t = trigger();
    expect(t).toHaveTextContent('BE · EUR');
    expect(t).toHaveTextContent('Deutsch');
    expect(t.querySelector('img')?.getAttribute('src')).toBe('https://flagcdn.com/be.svg');
    expect(t).toHaveAttribute('aria-haspopup', 'dialog');
    expect(t).toHaveAttribute('aria-expanded', 'false');
    expect(t.getAttribute('aria-label')).toBe('Land/Region und Sprache: Belgien, EUR, Deutsch');
  });

  it('a globe and only the currency without a stored country in a multi-country market', () => {
    renderPicker();
    expect(trigger().querySelector('img')).toBeNull();
    expect(trigger().querySelector('svg')).not.toBeNull();
    expect(trigger()).toHaveTextContent('EUR');
    expect(trigger()).not.toHaveTextContent('·');
  });

  it('a single-country market shows that country even with another stored country', () => {
    state.locale = 'sv';
    stubLocation('/products/x');
    renderPicker({ market: SE, preferred: 'BE' });
    expect(trigger()).toHaveTextContent('SE · SEK');
  });
});

describe('RegionPicker: dialog accessibility', () => {
  it('is a modal dialog with the title focused; Tab wraps; Esc closes and focus returns', () => {
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = within(dialog).getByRole('heading');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(document.activeElement).toBe(title);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');

    const save = within(dialog).getByRole('button', { name: 'Speichern' });
    const close = within(dialog).getByRole('button', { name: 'Schließen' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('a backdrop click closes without saving', () => {
    renderPicker({ preferred: 'BE' });
    open();
    fireEvent.click(screen.getByTestId('region-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('RegionPicker: motion', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-cx-motion');
    vi.useRealTimers();
  });

  it('the portalled dialog and backdrop carry body-level hooks; on close they fade, inert and no longer modal', () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-cx-motion', '');
    renderPicker({ preferred: 'BE', motion: 'scroll' });
    const dialog = open();
    expect(dialog.getAttribute('data-cx-dialog')).toBe('region');
    expect(dialog.hasAttribute('data-cx-menu')).toBe(false);
    expect(screen.getByTestId('region-backdrop').getAttribute('data-cx-backdrop')).toBe('region');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    const leaving = document.querySelector('[data-cx-dialog="region"]')!;
    expect(leaving.hasAttribute('data-cx-closing')).toBe(true);
    expect(leaving.hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('region-backdrop').hasAttribute('data-cx-closing')).toBe(true);
    // Scroll lock and focus trap end with the close, not after the fade.
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(trigger());
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(document.querySelector('[data-cx-dialog="region"]')).toBeNull();
  });
});

describe('RegionPicker: country list', () => {
  it('lists the real countries, sorted, with currency, plus "other countries" last', () => {
    state.locale = 'en';
    stubLocation('/products/x');
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    const rows = countryRadios(dialog).map((r) => r.closest('label')!.textContent);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toBe('AustriaEUR');
    expect(rows).toContain('SwedenSEK');
    expect(rows[rows.length - 1]).toBe('Other countriesSEK');
    expect(countryRadios(dialog).find((r) => r.checked)?.value).toBe('BE');
  });

  it('search filters by name (diacritics folded) and code; Enter picks a single match; empty state', () => {
    state.locale = 'en';
    stubLocation('/products/x');
    renderPicker();
    const dialog = open();
    const search = within(dialog).getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'bel' } });
    expect(countryRadios(dialog).map((r) => r.value)).toEqual(['BE']);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(countryRadios(dialog)[0]!.checked).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // ISO code and the English name both match.
    fireEvent.change(search, { target: { value: 'se' } });
    expect(countryRadios(dialog).map((r) => r.value)).toEqual(['SE']);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(within(dialog).getByRole('status')).toHaveTextContent('No matching country/region');
  });

  it('search folds case and diacritics on the localised name (de: Österreich)', () => {
    renderPicker();
    const dialog = open();
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'OSTERR' } });
    expect(countryRadios(dialog).map((r) => r.value)).toEqual(['AT']);
  });

  it('choosing Sweden switches the languages to the Swedish set and falls back correctly', () => {
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    expect(languageLabels(dialog)).toEqual(['English', 'Deutsch', 'Français', 'العربية']);
    fireEvent.click(countryRadios(dialog).find((r) => r.value === 'SE')!);
    expect(languageLabels(dialog)).toEqual(['Svenska', 'English', 'العربية']);
    // de is not offered in SE and is the current locale: the default (sv).
    const checked = dialog.querySelector<HTMLInputElement>('input[name="region-language"]:checked');
    expect(checked?.value).toBe('sv');
  });

  it('keeps the current language when the new country offers it', () => {
    state.locale = 'ar';
    stubLocation('/ar/products/x');
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    fireEvent.click(countryRadios(dialog).find((r) => r.value === 'SE')!);
    expect(dialog.querySelector<HTMLInputElement>('input[name="region-language"]:checked')?.value).toBe('ar');
  });

  it('no flags in the language list; country flags are whole and never mirrored', () => {
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    expect(within(dialog).getByTestId('region-languages').querySelector('img')).toBeNull();
    const flags = [...dialog.querySelectorAll('img')];
    expect(flags.length).toBe(11);
    for (const f of flags) {
      expect(f.getAttribute('src')).toMatch(/^https:\/\/flagcdn\.com\/[a-z]{2}\.svg$/);
      expect((f.getAttribute('class') ?? '').split(/\s+/)).toContain('object-contain');
    }
    const MIRROR = /scale-x|^rtl:|-scale-|rotate-y/;
    const tokens = [...document.body.querySelectorAll('*')].flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
    );
    expect(tokens.filter((t) => MIRROR.test(t))).toEqual([]);
    expect(flags.flatMap((f) => (f.getAttribute('class') ?? '').split(/\s+/)).filter((t) => t.startsWith('rounded'))).toEqual([]);
  });
});

describe('RegionPicker: apply', () => {
  it('same market, same language: stores the country, no navigation, trigger updated', () => {
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    fireEvent.click(countryRadios(dialog).find((r) => r.value === 'NL')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(assign).not.toHaveBeenCalled();
    expect(document.cookie).toContain('ms-region=NL');
    expect(screen.getByTestId('probe')).toHaveTextContent('NL');
    expect(trigger()).toHaveTextContent('NL · EUR');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('same market, new language: relative URL with the query kept', () => {
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    fireEvent.click(dialog.querySelector<HTMLInputElement>('input[name="region-language"][value="fr"]')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(assign).toHaveBeenCalledWith('/fr/products/x?sort=1');
    expect(document.cookie).toContain('ms-region=BE');
  });

  it('other market: absolute URL with rg and the guest cart', () => {
    state.items = [{ productId: 'p1', variantId: 'v1', quantity: 2 }];
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    fireEvent.click(countryRadios(dialog).find((r) => r.value === 'SE')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(assign.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://namez.se');
    expect(url.pathname).toBe('/products/x');
    expect(url.searchParams.get('sort')).toBe('1');
    expect(url.searchParams.get('rg')).toBe('SE');
    expect(url.searchParams.get('c')).toBeTruthy();
  });

  it('"Other countries" deletes the stored country and goes to the default market without rg', () => {
    document.cookie = 'ms-region=BE; path=/';
    renderPicker({ preferred: 'BE' });
    const dialog = open();
    fireEvent.click(countryRadios(dialog).find((r) => r.value === '')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(document.cookie).not.toContain('ms-region=BE');
    const url = new URL(assign.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://namez.se');
    expect(url.searchParams.has('rg')).toBe(false);
  });

  it('no country chosen: only the language changes, nothing is stored', () => {
    renderPicker();
    const dialog = open();
    fireEvent.click(dialog.querySelector<HTMLInputElement>('input[name="region-language"][value="en"]')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(assign).toHaveBeenCalledWith('/products/x?sort=1');
    expect(document.cookie).not.toContain('ms-region=');
  });
});

describe('RegionPicker: copy, RTL and i18n', () => {
  it('visitor-facing text never says market or domain (en)', () => {
    state.locale = 'en';
    stubLocation('/products/x');
    renderPicker({ preferred: 'BE', variant: 'drawer' });
    open();
    expect(document.body.textContent).not.toMatch(/market|domain/i);
    const labels = [...document.body.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ');
    expect(labels).not.toMatch(/market|domain/i);
  });

  it('the ar panel is rtl with logical classes only', () => {
    state.locale = 'ar';
    stubLocation('/ar/products/x');
    renderPicker({ preferred: 'BE', variant: 'drawer' });
    const dialog = open();
    expect(dialog.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(physicalClasses(document.body.innerHTML)).toEqual([]);
  });

  it('every region.* key exists in all store locales', () => {
    const keys = Object.keys(en.region).sort();
    for (const [l, m] of Object.entries(MESSAGES)) {
      expect(Object.keys((m as { region: object }).region).sort(), l).toEqual(keys);
      const suggest = (m as { market: { suggest: Record<string, string>; switchCountry?: string } }).market;
      expect(suggest.suggest.title, l).toContain('{country}');
      expect(suggest.suggest.cta, l).toContain('{currency}');
      expect(suggest.switchCountry, l).toBeUndefined();
    }
  });
});

describe('MarketProvider: ?rg= landing', () => {
  it('stores a valid country and strips only rg from the URL', () => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/products/x?rg=BE&x=1');
    renderPicker({ preferred: null });
    expect(screen.getByTestId('probe')).toHaveTextContent('BE');
    expect(window.location.search).toBe('?x=1');
    expect(document.cookie).toContain('ms-region=BE');
  });

  it('ignores an unknown country but still removes the param', () => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/products/x?rg=ZZ');
    renderPicker({ preferred: null });
    expect(screen.getByTestId('probe')).toHaveTextContent('none');
    expect(window.location.search).toBe('');
    expect(document.cookie).not.toContain('ms-region=');
  });

  it('an invalid server cookie value is dropped', async () => {
    renderPicker({ preferred: 'NO' });
    await act(async () => {});
    expect(screen.getByTestId('probe')).toHaveTextContent('none');
  });
});
