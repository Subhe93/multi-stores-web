import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { StoreAppsProvider } from '@/hooks/useStoreApps';

// Account order page (M171): "Write a review" / "Edit your review" per
// reviewable product. Without the app the page asks nothing and renders no
// extra markup.

const { orderItems, apiMock } = vi.hoisted(() => ({ orderItems: vi.fn(), apiMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ storeSlug: 'demo', id: 'o1' }),
  usePathname: () => '/account/orders/o1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { has: () => true },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: 'session' }) }));
vi.mock('@/lib/api', () => ({
  api: (...a: unknown[]) => apiMock(...a),
  resolveMediaUrl: (u?: string | null) => u ?? '',
}));
vi.mock('@/lib/reviewsApi', () => ({ reviewsApi: { orderItems: (...a: unknown[]) => orderItems(...a) } }));
vi.mock('@/components/account/OrderInvoices', () => ({ OrderInvoices: () => null }));
vi.mock('@/components/StoreImage', () => ({ StoreImage: () => null }));

import StoreOrderDetailPage from './page';

const line = (id: string, productId: string, title: string, custom = false) => ({
  id,
  quantity: 1,
  unit_price: 100,
  total_price: 100,
  ...(custom
    ? { custom_product: { id: productId, translations: [{ locale: 'sv', title }] }, product: { id: 'base', translations: [], images: [] } }
    : { product: { id: productId, translations: [{ locale: 'sv', title }], images: [] } }),
});

const ORDER = {
  id: 'o1',
  order_number: '1001',
  status: 'DELIVERED',
  subtotal: 300,
  shipping_cost: 0,
  discount_amount: 0,
  total: 300,
  currency: 'SEK',
  created_at: '2026-11-01T10:00:00.000Z',
  items: [
    line('i1', 'p1', 'Halsband'),
    line('i2', 'p1', 'Halsband'),
    line('i3', 'p2', 'Armband'),
    line('i4', 'cp1', 'Egen design', true),
    line('i5', 'p9', 'Borttagen'),
  ],
};

function renderPage(apps: Record<string, { enabled: true }>) {
  const wrap = (node: ReactNode) => <StoreAppsProvider value={apps}>{node}</StoreAppsProvider>;
  return render(wrap(<StoreOrderDetailPage />));
}

const links = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-order-review-link] a')].map((a) => [a.textContent, a.getAttribute('href')]);

beforeEach(() => {
  orderItems.mockReset();
  apiMock.mockReset();
  apiMock.mockResolvedValue(ORDER);
});

describe('account order page: review links', () => {
  it('app off: no request, no link', async () => {
    const { container } = renderPage({});
    await screen.findAllByText('Halsband');
    expect(orderItems).not.toHaveBeenCalled();
    expect(container.querySelector('[data-order-review-link]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/review/i);
  });

  it('app on: one link per reviewable product, with the status of an existing review', async () => {
    orderItems.mockResolvedValue({
      eligible: true,
      items: [
        { order_item_id: 'i1', product_id: 'p1', review_status: null },
        { order_item_id: 'i3', product_id: 'p2', review_status: 'PENDING' },
        { order_item_id: 'i4', product_id: 'cp1', review_status: 'APPROVED' },
      ],
    });
    const { container } = renderPage({ reviews: { enabled: true } });
    await waitFor(() => expect(links(container)).toHaveLength(3));
    expect(orderItems).toHaveBeenCalledWith('demo', 'o1', 'session');
    expect(links(container)).toEqual([
      // Two lines of the same product: one link, on the first.
      ['account.writeReview', '/reviews/write?product=p1'],
      ['account.editReview', '/reviews/write?product=p2'],
      // A custom product is reviewed as itself, not as its base product.
      ['account.editReview', '/reviews/write?product=cp1'],
    ]);
    expect(screen.getByText('reviews.status.PENDING')).toBeTruthy();
    expect(screen.getByText('reviews.status.APPROVED')).toBeTruthy();
  });

  it('an order that is not eligible (unpaid, cancelled, refunded) shows no link', async () => {
    orderItems.mockResolvedValue({ eligible: false, items: [{ order_item_id: 'i1', product_id: 'p1', review_status: null }] });
    const { container } = renderPage({ reviews: { enabled: true } });
    await screen.findAllByText('Halsband');
    await waitFor(() => expect(orderItems).toHaveBeenCalledTimes(1));
    expect(container.querySelector('[data-order-review-link]')).toBeNull();
  });

  it('a failed read leaves the order page as it is', async () => {
    orderItems.mockRejectedValue(new Error('500'));
    const { container } = renderPage({ reviews: { enabled: true } });
    await screen.findAllByText('Halsband');
    await waitFor(() => expect(orderItems).toHaveBeenCalledTimes(1));
    expect(container.querySelector('[data-order-review-link]')).toBeNull();
    expect(screen.getByText('Armband')).toBeTruthy();
  });
});
