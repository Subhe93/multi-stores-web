import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { G } from '@/themes/creative/css/base.css';
import { FLOW_CSS } from '@/themes/creative/css/flow.css';
import StoreCartPage from '@/app/store/[storeSlug]/cart/page';
import StoreLoginPage from '@/app/store/[storeSlug]/auth/login/page';
import StoreForgotPasswordPage from '@/app/store/[storeSlug]/auth/forgot-password/page';
import { OrderReceipt, type OrderReceiptOrder } from '@/components/checkout/OrderReceipt';
import { CartItem } from './CartItem';
import { checkDraw, collapseLine, enter, flowMotionLive, FlowMotionProvider, LEAVE_MS } from './FlowMotion';

// Store motion on the flow pages (cart, checkout confirmation, sign-in):
// without the provider the markup is what it was; with it the page root is a
// fast surface, the title enters once and buttons get the pressed state.
// Totals, prices and form controls never carry a motion attribute.

const h = vi.hoisted(() => ({ cart: {} as Record<string, unknown> }));

vi.mock('next-intl', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${Object.values(params).join(',')})` : key;
  t.has = () => false;
  return { useTranslations: () => t, useLocale: () => 'sv' };
});
vi.mock('next/navigation', () => ({
  useParams: () => ({ storeSlug: 'demo' }),
  usePathname: () => '/cart',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(() => new Promise(() => {})),
  resolveMediaUrl: (u?: string) => u ?? '',
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => h.cart }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: null, login: vi.fn(), loading: false }),
  readStoredAccessToken: () => null,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => ({ key: 'se', countries: ['SE'], currency: 'SEK' }) }));
vi.mock('@/hooks/useStoreTax', () => ({ useStoreTax: () => null }));
vi.mock('@/hooks/useStorePrimaryLocale', () => ({ useStorePrimaryLocale: () => 'sv' }));
vi.mock('@/hooks/useBuyerType', () => ({ useBuyerType: () => ({ isCompany: false, settings: {} }) }));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/hooks/useDisplayPrice', () => ({ useDisplayPrice: () => (amount: number) => ({ amount }) }));
vi.mock('@/components/cart/UnavailableRemovedNotice', () => ({
  UnavailableRemovedNotice: () => null,
  useCartAvailabilityCheck: () => undefined,
}));
vi.mock('@/components/checkout/CouponAutoApplyNotice', () => ({ CouponAutoApplyNotice: () => null }));
vi.mock('@/components/cart/ReverseChargeCartHint', () => ({ ReverseChargeCartHint: () => null }));
vi.mock('@/components/IfApp', () => ({ IfApp: () => null }));
vi.mock('@/components/auth/CustomerCaptcha', () => ({ CustomerCaptcha: () => null }));
vi.mock('@/lib/trackEvents', () => ({ whenPurchaseSettled: () => Promise.resolve() }));

const LINES = [
  { id: 'local_1', productId: 'p1', title: 'Mug', price: 300, quantity: 2 },
  { id: 'local_2', productId: 'p2', title: 'Scarf', price: 450, quantity: 1 },
];

function setCart(over: Record<string, unknown> = {}) {
  h.cart = {
    items: LINES, loading: false, subtotal: 1050, total: 1050, discount: 0, coupon: null, currency: 'SEK',
    pricesUpdated: false, handoffDropped: 0, migrationDropped: 0, migrationDropError: null, dismissPricesNotice: vi.fn(),
    taxLines: [], taxPricingMode: 'INCLUSIVE', taxEstimated: false, totalWithTax: 1050, b2bNet: null, netItems: null,
    itemCount: 3, updateQuantity: vi.fn(async () => {}), removeItem: vi.fn(async () => {}), clearBundle: vi.fn(), clearCart: vi.fn(),
    applyCoupon: vi.fn(), removeCoupon: vi.fn(), hasUnavailableItems: false,
    storeId: 's1', marketKey: 'se', marketPreview: false,
    ...over,
  };
}

const withMotion = (node: ReactNode) => <FlowMotionProvider>{node}</FlowMotionProvider>;
/** The markup with every motion attribute taken out. */
const strip = (html: string) => html.replace(/ data-cx-[a-z-]+="[^"]*"/g, '');

/** A store root with the switch on and the engine gate set, as on a live page. */
function liveRoot(attrs: Record<string, string> = {}) {
  document.documentElement.setAttribute('data-cx-motion', '');
  const root = document.createElement('div');
  root.className = 'store-root';
  root.setAttribute('data-creative', '');
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  localStorage.clear();
  setCart();
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-cx-motion');
  document.querySelectorAll('.store-root').forEach((el) => el.remove());
});

describe('flow motion helpers', () => {
  it('return nothing without the store switch', () => {
    expect(enter(undefined)).toEqual({});
    expect(enter(undefined, 2)).toEqual({});
    expect(checkDraw(undefined)).toEqual({});
  });

  it('enter plays on mount (intro) with a step, whatever the surface mode', () => {
    expect(enter('scroll')).toEqual({ 'data-cx-intro': 'rise' });
    expect(enter('scroll', 2)).toEqual({ 'data-cx-intro': 'rise', 'data-cx-i': '2' });
    expect(checkDraw('scroll')).toEqual({ 'data-cx-flow': 'check' });
  });

  it('flowMotionLive needs the gate, the switch, a profile other than off and no builder', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(flowMotionLive(el)).toBe(false);
    el.remove();

    const root = liveRoot();
    root.appendChild(el);
    expect(flowMotionLive(el)).toBe(true);
    root.setAttribute('data-motion-reveal', 'calm');
    expect(flowMotionLive(el)).toBe(true);
    root.setAttribute('data-motion-reveal', 'off');
    expect(flowMotionLive(el)).toBe(false);
    root.removeAttribute('data-motion-reveal');
    root.setAttribute('data-cx-builder', '');
    expect(flowMotionLive(el)).toBe(false);
    root.removeAttribute('data-cx-builder');
    root.removeAttribute('data-creative');
    expect(flowMotionLive(el)).toBe(false);
    root.setAttribute('data-creative', '');
    document.documentElement.removeAttribute('data-cx-motion');
    expect(flowMotionLive(el)).toBe(false);
  });

  it('collapseLine is null when motion does not run and reversible when it does', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(collapseLine(el)).toBeNull();
    expect(collapseLine(null)).toBeNull();
    el.remove();

    liveRoot().appendChild(el);
    const leave = collapseLine(el);
    expect(leave).not.toBeNull();
    expect(el.hasAttribute('data-cx-leave')).toBe(true);
    expect(el.style.blockSize).not.toBe('');
    leave!.restore();
    expect(el.hasAttribute('data-cx-leave')).toBe(false);
    expect(el.style.blockSize).toBe('');
  });
});

describe('flow stylesheet', () => {
  it('hides, moves or animates only behind the gate', () => {
    const rules = FLOW_CSS.replace(/@keyframes [^{]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
      .replace(/@media print\{.*\}\}$/, '')
      .split('}')
      .filter(Boolean);
    const moving = rules.filter((r) => /animation|transition|opacity:0|block-size:0|scale:/.test(r));
    expect(moving.length).toBeGreaterThan(3);
    for (const rule of moving) expect(rule.startsWith(G)).toBe(true);
  });

  it('carries no physical side and no totals selector', () => {
    expect(FLOW_CSS).not.toMatch(/(?:margin|padding|border|inset)-(?:left|right)|[^-](?:left|right):/);
    expect(FLOW_CSS).not.toMatch(/total|price/);
  });
});

describe('cart page', () => {
  it('without the switch: no motion attribute, same markup', () => {
    const plain = render(<StoreCartPage />);
    const plainHtml = plain.container.innerHTML;
    expect(plainHtml).not.toContain('data-cx-');
    const plainText = plain.container.textContent;
    plain.unmount();

    const { container } = render(withMotion(<StoreCartPage />));
    expect(strip(container.innerHTML)).toBe(plainHtml);
    expect(container.textContent).toBe(plainText);
  });

  it('with the switch: fast surface, title enters once, buttons press, totals untouched', () => {
    const { container } = render(withMotion(<StoreCartPage />));
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('data-cx-section', 'cart');
    expect(root).toHaveAttribute('data-cx-tier', 'fast');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-cx-intro', 'rise');
    expect(screen.getByRole('link', { name: /cart\.checkout/ })).toHaveAttribute('data-cx-hover', 'press');
    // Nothing is armed for scroll and nothing is magnetic on a flow page.
    expect(container.querySelector('[data-cx-reveal],[data-cx-magnetic],[data-cx-behavior]')).toBeNull();
    // Totals and the checkout link carry no entrance.
    for (const id of ['cart-subtotal', 'cart-total', 'cart-total-label']) {
      const el = screen.getByTestId(id);
      expect(el.closest('[data-cx-intro],[data-cx-reveal]')).toBeNull();
    }
    expect(screen.getByRole('link', { name: /cart\.checkout/ }).closest('[data-cx-intro]')).toBeNull();
  });

  it('the empty cart is a surface too', () => {
    setCart({ items: [], itemCount: 0 });
    const { container } = render(withMotion(<StoreCartPage />));
    expect(container.firstElementChild).toHaveAttribute('data-cx-section', 'cart');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-cx-intro', 'rise');
    expect(screen.getByText('cart.emptyDescription')).toHaveAttribute('data-cx-i', '1');
  });

  it('removes a line at once when motion does not run', () => {
    render(withMotion(<StoreCartPage />));
    fireEvent.click(screen.getAllByRole('button', { name: 'cart.remove' })[0]);
    expect((h.cart.removeItem as ReturnType<typeof vi.fn>).mock.calls).toEqual([['local_1']]);
    expect(document.querySelector('[data-cx-leave]')).toBeNull();
  });

  it('closes the line first, then removes it, when motion runs', async () => {
    vi.useFakeTimers();
    render(withMotion(<StoreCartPage />), { container: liveRoot() });
    const removeItem = h.cart.removeItem as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getAllByRole('button', { name: 'cart.remove' })[1]);
    expect(document.querySelectorAll('[data-cx-leave]')).toHaveLength(1);
    expect(removeItem).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEAVE_MS);
    });
    expect(removeItem.mock.calls).toEqual([['local_2']]);
  });

  it('opens the line again when the removal fails', async () => {
    vi.useFakeTimers();
    const removeItem = vi.fn(() => Promise.reject(new Error('offline')));
    setCart({ removeItem });
    render(withMotion(<StoreCartPage />), { container: liveRoot() });
    fireEvent.click(screen.getAllByRole('button', { name: 'cart.remove' })[0]);
    expect(document.querySelectorAll('[data-cx-leave]')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEAVE_MS);
    });
    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-cx-leave]')).toBeNull();
  });

  it('a changed quantity fades its number in only when motion runs', async () => {
    const first = render(withMotion(<StoreCartPage />));
    fireEvent.click(screen.getAllByRole('button', { name: 'common.increaseQuantity' })[0]);
    await act(async () => {});
    expect(document.querySelector('[data-cx-swap]')).toBeNull();
    first.unmount();

    render(withMotion(<StoreCartPage />), { container: liveRoot() });
    expect(document.querySelector('[data-cx-swap]')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'common.increaseQuantity' })[0]);
    await act(async () => {});
    expect(h.cart.updateQuantity).toHaveBeenLastCalledWith('local_1', 3);
    const swapped = document.querySelectorAll('[data-cx-swap]');
    expect(swapped).toHaveLength(1);
    expect(swapped[0].textContent).toBe('2');
  });
});

describe('cart line (drawer)', () => {
  const item = { id: 'l1', productId: 'p1', title: 'Mug', price: 300, quantity: 1, currency: 'SEK' };

  it('renders no motion attribute and removes at once without motion', () => {
    const onRemove = vi.fn();
    const { container } = render(<CartItem item={item} onUpdateQuantity={vi.fn()} onRemove={onRemove} />);
    expect(container.innerHTML).not.toContain('data-cx-');
    fireEvent.click(screen.getByRole('button', { name: 'cart.remove' }));
    expect(onRemove).toHaveBeenCalledWith('l1');
  });

  it('closes first when motion runs', async () => {
    vi.useFakeTimers();
    const onRemove = vi.fn();
    render(<CartItem item={item} onUpdateQuantity={vi.fn()} onRemove={onRemove} />, { container: liveRoot() });
    fireEvent.click(screen.getByRole('button', { name: 'cart.remove' }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-cx-leave]')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEAVE_MS);
    });
    expect(onRemove).toHaveBeenCalledWith('l1');
  });
});

describe('sign-in pages', () => {
  it.each([
    ['login', StoreLoginPage],
    ['forgot password', StoreForgotPasswordPage],
  ])('%s: same markup without the switch, title and lead enter with it', (_name, Page) => {
    const plain = render(<Page />);
    const plainHtml = plain.container.innerHTML;
    expect(plainHtml).not.toContain('data-cx-');
    plain.unmount();

    const { container } = render(withMotion(<Page />));
    expect(strip(container.innerHTML)).toBe(plainHtml);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveAttribute('data-cx-intro', 'rise');
    expect(title.nextElementSibling).toHaveAttribute('data-cx-i', '1');
    expect(container.querySelector('button[type="submit"]')).toHaveAttribute('data-cx-hover', 'press');
    // Form controls are usable at once: no entrance on the form or its fields.
    for (const field of Array.from(container.querySelectorAll('input, form'))) {
      expect(field.closest('[data-cx-intro],[data-cx-reveal]')).toBeNull();
    }
  });
});

describe('order receipt', () => {
  const ORDER: OrderReceiptOrder = {
    id: 'o1',
    order_number: 'ORD-1',
    subtotal: 100,
    shipping_cost: 0,
    discount_amount: 0,
    total: 100,
    currency: 'SEK',
    items: [{ id: 'i1', quantity: 2, unit_price: 50, product: { translations: [{ locale: 'sv', title: 'Riskettan' }] } }],
  };
  const receipt = (motion?: 'scroll') => (
    <CheckoutSettingsProvider value={null}>
      <OrderReceipt order={ORDER} orderId="o1" motion={motion} />
    </CheckoutSettingsProvider>
  );

  it('is static without the prop and rises once with it', () => {
    const plain = render(receipt());
    const plainHtml = plain.container.innerHTML;
    expect(plainHtml).not.toContain('data-cx-');
    const plainText = plain.container.textContent;
    plain.unmount();

    const { container } = render(receipt('scroll'));
    expect(strip(container.innerHTML)).toBe(plainHtml);
    expect(container.textContent).toBe(plainText);
    const summary = screen.getByText('checkout.orderSummary').parentElement as HTMLElement;
    expect(summary).toHaveAttribute('data-cx-intro', 'rise');
    expect(summary).toHaveAttribute('data-cx-i', '3');
    expect(screen.getByRole('link', { name: /checkout\.viewOrder/ })).toHaveAttribute('data-cx-hover', 'press');
    // The actions are never delayed.
    expect(screen.getByRole('link', { name: /checkout\.viewOrder/ }).closest('[data-cx-intro]')).toBeNull();
  });
});
