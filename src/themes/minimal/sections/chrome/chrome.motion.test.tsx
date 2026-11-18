import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Store motion style on the chrome (S4): header, menus, drawers, footer.
// Without the `motion` prop every component renders today's markup; with it
// only data attributes are added (the rules live in creative/css/chrome.css.ts)
// and the two overlays that unmount on close stay for their exit.

const h = vi.hoisted(() => ({ count: 0, items: [] as Array<{ id: string }> }));

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({
    items: h.items,
    itemCount: h.count,
    subtotal: 0,
    total: 0,
    coupon: null,
    discount: 0,
    currency: 'SEK',
    taxLines: [],
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    pricesUpdated: false,
    handoffDropped: 0,
    migrationDropped: 0,
    dismissPricesNotice: vi.fn(),
    hasUnavailableItems: false,
  }),
}));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/components/IfApp', () => ({ IfApp: () => null }));
vi.mock('@/components/layout/BuyerTypeToggle', () => ({ BuyerTypeToggle: () => null }));
vi.mock('@/components/cart/CartItem', () => ({ CartItem: ({ item }: { item: { id: string } }) => <div data-line={item.id} /> }));
vi.mock('@/components/cart/CartSummary', () => ({ CartSummary: () => <div data-stub="summary" /> }));
vi.mock('@/components/cart/UnavailableInMarket', () => ({ RemoveUnavailableHint: () => null }));
vi.mock('@/lib/useApiError', () => ({ useCodedApiError: () => () => '' }));
vi.mock('@/lib/cartAvailability', () => ({ availableLines: (x: unknown) => x }));
vi.mock('@/lib/requiresShipping', () => ({ cartRequiresShipping: () => true }));
// The drawer reads the per-line cap (per-order limit and stock) from here.
vi.mock('@/lib/productQuantity', () => ({ lineMaxQty: () => 9, lineQuantityCap: () => ({ max: 9, stock: null }) }));

import { SectionRenderer } from '../../../SectionRenderer';
import { minimalTheme } from '../../theme';
import type { SectionInstance, SectionRenderProps, StoreContext } from '../../../types';
import { CHROME_CSS } from '../../../creative/css/chrome.css';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { announcementBarSection } from './AnnouncementBar';
import { copyrightBarSection } from './CopyrightBar';
import { footerColumnsSection } from './FooterColumns';
import { headerBarSection } from './HeaderBar';
import { HeaderBarDesktopNav } from './HeaderBarDesktopNav.client';
import { HeaderBarMobileMenu } from './HeaderBarMobileMenu.client';
import { HeaderCartButton } from './HeaderCartButton.client';
import { LocaleSwitcher } from './LocaleSwitcher.client';
import { megaMenuSection } from './MegaMenu';
import { chromeMotionLive } from './chromeMotion.client';

type Motion = SectionRenderProps['motion'];

const CTX: StoreContext = {
  storeName: 'Demo Store',
  logoUrl: '/uploads/stores/logo.png',
  primaryLocale: 'en',
  secondaryLocales: ['ar'],
  pages: [],
};

const base = { locale: 'en', primaryLocale: 'en', storeSlug: 'demo' };
const stripCx = (html: string) => html.replace(/ data-cx-[a-z-]+="[^"]*"/g, '');
const text = (html: string) => html.replace(/<[^>]+>/g, '');

const NAV = [
  { label: 'Shop', url: '/products' },
  { label: 'Gifts', url: '/gifts', children: [{ label: 'For her', url: '/gifts/her' }] },
];

function header(motion: Motion, settings: Record<string, unknown> = {}) {
  const Header = headerBarSection.Component;
  return renderToStaticMarkup(
    <Header
      {...base}
      settings={{ show_locale: false, show_cart: false, ...settings }}
      content={{ items: [{ label: 'Shop', url: '/products' }, { label: 'Story', url: '/story' }] }}
      storeContext={CTX}
      motion={motion}
    />,
  );
}

function footer(motion: Motion) {
  const Footer = footerColumnsSection.Component;
  return renderToStaticMarkup(
    <Footer
      {...base}
      settings={{}}
      content={{
        columns: [
          { heading: 'Shop', links: [{ label: 'All', url: '/products' }, { label: 'New', url: '/products?sort=new' }] },
          { heading: 'About', links: [{ label: 'Story', url: '/story' }] },
        ],
      }}
      chrome
      motion={motion}
    />,
  );
}

function copyright(motion: Motion) {
  const Bar = copyrightBarSection.Component;
  return renderToStaticMarkup(<Bar {...base} settings={{}} content={{ text: 'Demo rights' }} motion={motion} />);
}

function megaMenu(motion: Motion) {
  const Mega = megaMenuSection.Component;
  return renderToStaticMarkup(
    <Mega
      {...base}
      settings={{}}
      content={{ triggers: [{ label: 'Shop', url: '/products', columns: [{ heading: 'Women', links: [{ label: 'Dresses', url: '/d' }] }] }] }}
      motion={motion}
    />,
  );
}

function announcement(motion: Motion) {
  const Bar = announcementBarSection.Component;
  return renderToStaticMarkup(
    <Bar {...base} settings={{ layout: 'rotating' }} content={{ messages: [{ text: 'One' }, { text: 'Two' }] }} motion={motion} />,
  );
}

const RENDERERS: Array<[string, (m: Motion) => string]> = [
  ['header-bar', header],
  ['header-bar (pill)', (m) => header(m, { active_style: 'pill' })],
  ['footer-columns', footer],
  ['copyright-bar', copyright],
  ['mega-menu', megaMenu],
  ['announcement-bar', announcement],
];

describe('chrome sections without the motion prop', () => {
  for (const [name, renderIt] of RENDERERS) {
    it(`${name}: no engine attribute, and motion only adds data attributes`, () => {
      const plain = renderIt(undefined);
      expect(plain).not.toContain('data-cx-');
      const moving = renderIt('scroll');
      // Same elements, classes, styles and text: only data-cx-* differs.
      expect(stripCx(moving)).toBe(plain);
      expect(text(moving)).toBe(text(plain));
      // Chrome is never an intro, but the prop must not break a component.
      expect(text(renderIt('intro'))).toBe(text(plain));
    });
  }
});

describe('chrome sections with the motion prop', () => {
  it('header-bar: the bar is a surface and is never armed itself; plain links get the underline', () => {
    const html = header('scroll');
    const headerTag = html.match(/<header[^>]*>/)![0];
    expect(headerTag).toContain('data-cx-section="header"');
    expect(headerTag).not.toMatch(/data-cx-(reveal|intro|tier)/);
    expect(html).not.toMatch(/data-cx-(reveal|intro)=/);
    expect(html.match(/data-cx-hover="underline"/g)?.length).toBe(2);
    expect(html.match(/data-cx-nav=""/g)?.length).toBe(2);
  });

  it('header-bar: the pill look keeps its filled hover (no underline)', () => {
    expect(header('scroll', { active_style: 'pill' })).not.toContain('data-cx-hover');
  });

  it('header-bar: a CSS dropdown panel is marked, its trigger is not underlined', () => {
    const Header = headerBarSection.Component;
    const ctx: StoreContext = {
      ...CTX,
      menus: [
        {
          key: 'main',
          items: [
            { id: 'a', label: 'Shop', url: '/products', parent_id: null },
            { id: 'b', label: 'Gifts', url: '/gifts', parent_id: null },
            { id: 'c', label: 'For her', url: '/gifts/her', parent_id: 'b' },
          ],
        },
      ] as never,
    };
    const html = renderToStaticMarkup(
      <Header {...base} settings={{ show_locale: false, show_cart: false, menu_key: 'main' }} content={{}} storeContext={ctx} motion="scroll" />,
    );
    expect(html).toContain('For her');
    expect(html.match(/data-cx-menu="drop"/g)?.length).toBe(1);
    expect(html.match(/data-cx-hover="underline"/g)?.length).toBe(1);
  });

  it('footer-columns: a surface, the columns cascade, the links sweep an underline', () => {
    const html = footer('scroll');
    expect(html).toMatch(/^<div[^>]*data-cx-section="footer"/);
    expect(html.match(/data-cx-reveal="stagger"/g)?.length).toBe(1);
    expect(html.match(/data-cx-item=""/g)?.length).toBe(2);
    expect(html.match(/data-cx-hover="underline"/g)?.length).toBe(3);
  });

  it('copyright-bar: the line fades', () => {
    const html = copyright('scroll');
    expect(html).toMatch(/^<div[^>]*data-cx-section="footer"/);
    expect(html).toContain('<p class="text-xs" data-cx-reveal="fade">Demo rights</p>');
  });

  it('mega-menu and announcement-bar: the panel and the rotating cells are marked', () => {
    expect(megaMenu('scroll').match(/data-cx-menu="hover"/g)?.length).toBe(1);
    expect(announcement('scroll').match(/data-cx-swap=""/g)?.length).toBe(2);
  });

  it('the mega header nav marks its panels and their open state', () => {
    const { container, rerender } = render(
      <HeaderBarDesktopNav items={NAV} bg="#fff" borderColor="#eee" accent="#000" />,
    );
    expect(container.innerHTML).not.toContain('data-cx-');
    rerender(<HeaderBarDesktopNav items={NAV} bg="#fff" borderColor="#eee" accent="#000" motion="scroll" />);
    expect(container.querySelectorAll('[data-cx-nav][data-cx-hover="underline"]').length).toBe(1);
    const panel = container.querySelector('[data-cx-menu="drop"]')!;
    expect(panel.hasAttribute('data-cx-open')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Gifts' }));
    expect(panel.hasAttribute('data-cx-open')).toBe(true);
    expect(screen.getByRole('button', { name: 'Gifts' }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the section override through SectionRenderer', () => {
  const section = (settings: Record<string, unknown>): SectionInstance => ({
    id: 'f1',
    section_key: 'footer-columns',
    settings,
    sort_order: 1,
    translations: [{ locale: 'en', content: { columns: [{ heading: 'Shop', links: [{ label: 'All', url: '/products' }] }] } }],
  });
  const renderFooter = (settings: Record<string, unknown>, motion: boolean) =>
    renderToStaticMarkup(
      <SectionRenderer theme={minimalTheme} sections={[section(settings)]} locale="en" primaryLocale="en" storeSlug="demo" storeContext={CTX} motion={motion} chrome />,
    );

  it('the store switch reaches the footer; _style.motion = none switches it off', () => {
    const off = renderFooter({}, false);
    expect(off).not.toContain('data-cx-');
    expect(renderFooter({}, true)).toContain('data-cx-reveal="stagger"');
    const none = renderFooter({ _style: { motion: 'none' } }, true);
    expect(none).not.toContain('data-cx-');
    expect(text(none)).toBe(text(off));
  });
});

// ── Overlays ────────────────────────────────────────────────────────────

const openGate = () => document.documentElement.setAttribute('data-cx-motion', '');

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  h.count = 0;
  h.items = [];
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-cx-motion');
  document.body.style.overflow = '';
});

const MENU_ITEMS = [
  { label: 'Shop', url: '/products', children: [{ label: 'New', url: '/products?sort=newest' }] },
  { label: 'About', url: '/about' },
  { label: 'Story', url: '/story' },
];

function renderMenu(motion: Motion, rootAttrs: Record<string, string> = {}) {
  return render(
    <div className="store-root" {...rootAttrs}>
      <HeaderBarMobileMenu items={MENU_ITEMS} fg="#000" bg="#fff" ariaLabel="Open menu" motion={motion} />
    </div>,
  );
}

describe('mobile menu drawer', () => {
  it('the gate helper follows the document', () => {
    render(<div className="store-root" />);
    expect(chromeMotionLive()).toBe(false);
    openGate();
    expect(chromeMotionLive()).toBe(true);
  });

  it('the gate helper is shut for a store with motion off and in the builder', () => {
    openGate();
    const { unmount } = render(<div className="store-root" data-motion-reveal="off" />);
    expect(chromeMotionLive()).toBe(false);
    unmount();
    render(<div className="store-root" data-cx-builder="" />);
    expect(chromeMotionLive()).toBe(false);
  });

  it('without motion: no attribute, closes at once', () => {
    openGate();
    const { container } = renderMenu(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(container.innerHTML).not.toContain('data-cx-');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with motion: panel, backdrop and rows are marked; focus moves in at once', () => {
    openGate();
    renderMenu('scroll');
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'nav.menu' });
    expect(dialog.getAttribute('data-cx-drawer')).toBe('start');
    expect(dialog.getAttribute('data-cx-tier')).toBe('fast');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-cx-backdrop]')).not.toBeNull();
    const rows = Array.from(dialog.querySelectorAll('[data-cx-intro="rise"]'));
    expect(rows.map((r) => r.getAttribute('data-cx-i'))).toEqual([null, '1', '2']);
    expect(rows.every((r) => r.getAttribute('data-cx-d') === '1')).toBe(true);
    expect(dialog.textContent).toContain('ShopAboutStory');
  });

  it('with motion: Escape frees the page at once and the drawer plays out for 0.35 s, inert', () => {
    vi.useFakeTimers();
    openGate();
    renderMenu('scroll');
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    // Focus, scroll lock and aria-expanded do not wait for the animation.
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const leaving = document.querySelector('[data-cx-drawer]')!;
    expect(leaving.hasAttribute('data-cx-closing')).toBe(true);
    expect(leaving.hasAttribute('inert')).toBe(true);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('[data-cx-backdrop]')!.hasAttribute('inert')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(document.querySelector('[data-cx-drawer]')).toBeNull();
    expect(document.querySelector('[data-cx-backdrop]')).toBeNull();
  });

  it('with motion but the gate shut (reduced motion, motion off): closes at once', () => {
    renderMenu('scroll');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-cx-drawer]')).toBeNull();

    openGate();
    renderMenu('scroll', { 'data-motion-reveal': 'off' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open menu' })[1]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-cx-drawer]')).toBeNull();
  });

  it('reopening during the exit keeps one drawer and clears the closing state', () => {
    vi.useFakeTimers();
    openGate();
    renderMenu('scroll');
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(trigger);
    const drawers = document.querySelectorAll('[data-cx-drawer]');
    expect(drawers.length).toBe(1);
    expect(drawers[0].hasAttribute('data-cx-closing')).toBe(false);
    expect(drawers[0].hasAttribute('inert')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('language list', () => {
  const props = { current: 'en', primary: 'en', others: ['ar'], accent: '#000', bg: '#fff', fg: '#000', borderColor: '#eee' };

  it('without motion: unchanged, closes at once', () => {
    openGate();
    const { container } = render(<div className="store-root"><LocaleSwitcher {...props} /></div>);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(container.innerHTML).not.toContain('data-cx-');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('with motion: the list is marked and stays 0.2 s for its exit', () => {
    vi.useFakeTimers();
    openGate();
    render(<div className="store-root"><LocaleSwitcher {...props} motion="scroll" /></div>);
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu').getAttribute('data-cx-menu')).toBe('list');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const leaving = document.querySelector('[data-cx-menu="list"]')!;
    expect(leaving.hasAttribute('data-cx-closing')).toBe(true);
    expect(leaving.hasAttribute('inert')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(document.querySelector('[data-cx-menu="list"]')).toBeNull();
  });
});

describe('cart drawer', () => {
  it('without motion: no engine attribute', () => {
    h.items = [{ id: 'l1' }];
    render(<CartDrawer isOpen onClose={() => {}} />);
    expect(document.body.innerHTML).not.toContain('data-cx-');
  });

  it('with motion: panel, backdrop and the lines container are marked; the open state is an attribute', () => {
    h.items = [{ id: 'l1' }, { id: 'l2' }];
    const { rerender } = render(<CartDrawer isOpen onClose={() => {}} motion="scroll" />);
    const panel = document.querySelector('[data-cx-drawer="cart"]')!;
    const backdrop = document.querySelector('[data-cx-backdrop="cart"]')!;
    expect(panel.hasAttribute('data-cx-open')).toBe(true);
    expect(backdrop.hasAttribute('data-cx-open')).toBe(true);
    expect(panel.querySelector('[data-cx-rows]')!.children.length).toBe(2);
    // Totals and the checkout link carry nothing: they are there with the panel.
    const summary = panel.querySelector('[data-stub="summary"]')!;
    expect(summary.closest('[data-cx-rows]')).toBeNull();
    expect(panel.querySelector('a[href="/checkout"]')!.closest('[data-cx-rows]')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<CartDrawer isOpen={false} onClose={() => {}} motion="scroll" />);
    expect(panel.hasAttribute('data-cx-open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});

describe('cart badge pulse', () => {
  const animate = vi.fn();
  beforeEach(() => {
    animate.mockClear();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  });
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });

  const button = (motion: Motion) => (
    <div className="store-root">
      <HeaderCartButton mode="page" href="/cart" ariaLabel="Cart" accent="#000" motion={motion} />
    </div>
  );

  it('pulses once per change of the count, only with motion and the gate open', () => {
    openGate();
    h.count = 1;
    const { rerender } = render(button('scroll'));
    expect(animate).not.toHaveBeenCalled();
    h.count = 2;
    rerender(button('scroll'));
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 450 });
    // A re-render with the same count does nothing.
    rerender(button('scroll'));
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('does not pulse when the stored cart arrives right after load, without motion or with the gate shut', () => {
    openGate();
    h.count = 0;
    const first = render(button('scroll'));
    h.count = 3;
    first.rerender(button('scroll'));
    expect(animate).not.toHaveBeenCalled();
    first.unmount();

    h.count = 1;
    const second = render(button(undefined));
    h.count = 2;
    second.rerender(button(undefined));
    expect(animate).not.toHaveBeenCalled();
    second.unmount();

    document.documentElement.removeAttribute('data-cx-motion');
    h.count = 1;
    const third = render(button('scroll'));
    h.count = 2;
    third.rerender(button('scroll'));
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('chrome stylesheet', () => {
  it('every rule outside the keyframes starts with the motion gate', () => {
    const withoutKeyframes = CHROME_CSS.replace(/@keyframes [a-z-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
    const selectors = Array.from(withoutKeyframes.matchAll(/([^{}]+)\{[^{}]*\}/g))
      .map((m) => m[1].replace(/^@(media|starting-style)[^{]*\{/, '').trim())
      .filter((s) => s && !s.startsWith('@'));
    expect(selectors.length).toBeGreaterThan(20);
    for (const group of selectors) {
      for (const selector of group.split(/,(?![^()]*\))/)) {
        expect(selector.trim().startsWith('html[data-cx-motion]'), selector).toBe(true);
      }
    }
  });

  it('carries the contract numbers', () => {
    expect(CHROME_CSS).toContain('cx-drawer-in .6s');
    expect(CHROME_CSS).toContain('cx-menu-in .35s');
    expect(CHROME_CSS).toContain('[data-cx-swap]{transition:opacity .45s ease}');
    // Nothing loops and nothing is keyed on the physical side.
    expect(CHROME_CSS).not.toContain('infinite');
    expect(CHROME_CSS).not.toMatch(/\b(left|right)\b/);
  });
});
