// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveTrackers, setMetaPixelActive } from '@/lib/consent';
import {
  VENDOR_MAX_RETRIES,
  VENDOR_RETRY_DELAY_MS,
  purchaseEventId,
  purchaseFromOrder,
  purchaseTrackedKey,
  readPurchaseSnapshot,
  readTrackingContext,
  rememberPurchaseSnapshot,
  resetPurchaseTrackingForTests,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
  trackingBody,
} from './trackEvents';

type Win = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  ttq?: { page?: () => void; track?: (event: string, params?: Record<string, unknown>) => void };
};
const win = window as Win;

function mountVendors() {
  const fbq = vi.fn();
  const gtag = vi.fn();
  const track = vi.fn();
  win.fbq = fbq;
  win.gtag = gtag;
  win.ttq = { track };
  return { fbq, gtag, track };
}

function clearCookies() {
  for (const name of ['_fbp', '_fbc']) document.cookie = `${name}=; path=/; max-age=0`;
}

const ORDER = 'b3f1c2d4-0000-4000-8000-000000000001';
const purchase = {
  orderId: ORDER,
  value: 368,
  currency: 'sek',
  items: [{ productId: 'p1', quantity: 2, price: 184, name: 'Mug' }],
};

beforeEach(() => {
  vi.useFakeTimers();
  delete win.fbq;
  delete win.gtag;
  delete win.ttq;
  window.localStorage.clear();
  window.sessionStorage.clear();
  clearCookies();
  // Every vendor tag counts as mounted unless a test says otherwise.
  setActiveTrackers({ ga4: true, meta: true, tiktok: true });
  resetPurchaseTrackingForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('trackAddToCart', () => {
  it('does nothing (and does not throw) without vendor tags', () => {
    expect(() => trackAddToCart({ productId: 'p1', name: 'Mug', value: 10, currency: 'SEK', quantity: 1 })).not.toThrow();
  });

  it('sends the event to every vendor present', () => {
    const { fbq, gtag, track } = mountVendors();
    trackAddToCart({ productId: 'p1', name: 'Mug', value: 368, currency: 'sek', quantity: 2 });
    expect(fbq).toHaveBeenCalledWith('track', 'AddToCart', {
      content_ids: ['p1'],
      content_type: 'product',
      contents: [{ id: 'p1', quantity: 2 }],
      content_name: 'Mug',
      value: 368,
      currency: 'SEK',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'add_to_cart', {
      currency: 'SEK',
      value: 368,
      items: [{ item_id: 'p1', item_name: 'Mug', quantity: 2, price: 184 }],
    });
    expect(track).toHaveBeenCalledWith('AddToCart', {
      content_id: 'p1',
      content_type: 'product',
      content_name: 'Mug',
      quantity: 2,
      value: 368,
      currency: 'SEK',
    });
  });

  it('only calls the vendors that exist and survives a throwing one', () => {
    const gtag = vi.fn();
    win.fbq = () => {
      throw new Error('blocked');
    };
    win.gtag = gtag;
    expect(() => trackAddToCart({ productId: 'p1', value: 5, currency: 'EUR', quantity: 1 })).not.toThrow();
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});

describe('trackInitiateCheckout', () => {
  it('sends ids, contents, item count, value and currency', () => {
    const { fbq, gtag, track } = mountVendors();
    trackInitiateCheckout({
      value: 500,
      currency: 'SEK',
      items: [
        { productId: 'p1', quantity: 2, price: 184, name: 'Mug' },
        { productId: 'p2', quantity: 1 },
      ],
    });
    expect(fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', {
      content_ids: ['p1', 'p2'],
      content_type: 'product',
      contents: [{ id: 'p1', quantity: 2, item_price: 184 }, { id: 'p2', quantity: 1 }],
      num_items: 3,
      value: 500,
      currency: 'SEK',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'begin_checkout', {
      currency: 'SEK',
      value: 500,
      items: [
        { item_id: 'p1', item_name: 'Mug', quantity: 2, price: 184 },
        { item_id: 'p2', quantity: 1 },
      ],
    });
    expect(track).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({ value: 500, currency: 'SEK' }));
  });

  it('waits for vendor tags that mount shortly after', () => {
    trackInitiateCheckout({ value: 1, currency: 'SEK', items: [{ productId: 'p1', quantity: 1 }] });
    const { fbq } = mountVendors();
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS);
    expect(fbq).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS * VENDOR_MAX_RETRIES);
    expect(fbq).toHaveBeenCalledTimes(1);
  });
});

describe('trackPurchase', () => {
  it('sends the Purchase with the order event id and sets the guard', () => {
    const { fbq, gtag, track } = mountVendors();
    trackPurchase(purchase);
    expect(purchaseEventId(ORDER)).toBe(`purchase_${ORDER}`);
    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      {
        content_ids: ['p1'],
        content_type: 'product',
        contents: [{ id: 'p1', quantity: 2, item_price: 184 }],
        num_items: 2,
        value: 368,
        currency: 'SEK',
      },
      { eventID: `purchase_${ORDER}` },
    );
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: ORDER,
      currency: 'SEK',
      value: 368,
      items: [{ item_id: 'p1', item_name: 'Mug', quantity: 2, price: 184 }],
    });
    expect(track).toHaveBeenCalledWith('CompletePayment', expect.objectContaining({ value: 368, currency: 'SEK' }));
    expect(window.localStorage.getItem(`ms:purchase-tracked:${ORDER}`)).not.toBeNull();
    expect(purchaseTrackedKey(ORDER)).toBe(`ms:purchase-tracked:${ORDER}`);
  });

  it('fires at most once per order (same page and after a reload)', () => {
    const { fbq } = mountVendors();
    trackPurchase(purchase);
    trackPurchase(purchase);
    // A reload loses the in-memory state; localStorage still guards.
    resetPurchaseTrackingForTests();
    trackPurchase(purchase);
    expect(fbq).toHaveBeenCalledTimes(1);
    // Another order is its own event.
    trackPurchase({ ...purchase, orderId: 'other' });
    expect(fbq).toHaveBeenCalledTimes(2);
  });

  it('retries while the tags are still mounting, and a double call sends one event', () => {
    trackPurchase(purchase);
    trackPurchase(purchase); // React strict effects
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS * 2);
    const { fbq } = mountVendors();
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS);
    expect(fbq).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS * VENDOR_MAX_RETRIES);
    expect(fbq).toHaveBeenCalledTimes(1);
  });

  it('gives up silently without a guard when no vendor ever exists', () => {
    trackPurchase(purchase);
    vi.advanceTimersByTime(VENDOR_RETRY_DELAY_MS * (VENDOR_MAX_RETRIES + 2));
    expect(window.localStorage.getItem(purchaseTrackedKey(ORDER))).toBeNull();
    // Tags that appear on a later visit still get the event.
    const { fbq } = mountVendors();
    trackPurchase(purchase);
    expect(fbq).toHaveBeenCalledTimes(1);
  });

  it('falls back to an in-memory guard when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { fbq } = mountVendors();
    trackPurchase(purchase);
    trackPurchase(purchase);
    expect(fbq).toHaveBeenCalledTimes(1);
  });
});

describe('purchaseFromOrder', () => {
  it('maps the order total, currency and lines', () => {
    expect(
      purchaseFromOrder({
        id: ORDER,
        total: '368.00',
        currency: 'SEK',
        items: [
          { id: 'i1', product_id: 'p1', quantity: 2, unit_price: '184.00' },
          { id: 'i2', product_id: null, custom_product_id: 'c1', quantity: 1, unit_price: 0 },
        ],
      }),
    ).toEqual({
      orderId: ORDER,
      value: 368,
      currency: 'SEK',
      items: [
        { productId: 'p1', quantity: 2, price: 184 },
        { productId: 'c1', quantity: 1, price: 0 },
      ],
    });
  });
});

describe('purchase snapshot', () => {
  it('round-trips per session and rejects junk', () => {
    expect(readPurchaseSnapshot('s1')).toBeNull();
    rememberPurchaseSnapshot('s1', { value: 368, currency: 'SEK', items: [{ productId: 'p1', quantity: 2 }] });
    expect(readPurchaseSnapshot('s1')).toEqual({ value: 368, currency: 'SEK', items: [{ productId: 'p1', quantity: 2 }] });
    expect(readPurchaseSnapshot('s2')).toBeNull();
    window.sessionStorage.setItem('ms:purchase-snapshot:s3', '{"value":"x"}');
    expect(readPurchaseSnapshot('s3')).toBeNull();
    expect(readPurchaseSnapshot(null)).toBeNull();
  });
});

describe('tracking context', () => {
  it('is omitted while the Meta pixel is not active', () => {
    setMetaPixelActive(false);
    document.cookie = '_fbp=fb.1.1700000000000.123; path=/';
    expect(readTrackingContext()).toBeUndefined();
    expect(trackingBody()).toEqual({});
    expect('tracking' in trackingBody()).toBe(false);
  });

  it('carries the Meta cookies and the page URL without its query string', () => {
    setMetaPixelActive(true);
    document.cookie = '_fbp=fb.1.1700000000000.123; path=/';
    document.cookie = '_fbc=fb.1.1700000000000.AbCd; path=/';
    window.history.replaceState(null, '', '/checkout?method=classic&fbclid=AbCd');
    expect(trackingBody()).toEqual({
      tracking: {
        fbp: 'fb.1.1700000000000.123',
        fbc: 'fb.1.1700000000000.AbCd',
        source_url: `${window.location.origin}/checkout`,
      },
    });
  });

  it('drops a malformed or oversized cookie instead of sending it', () => {
    setMetaPixelActive(true);
    window.history.replaceState(null, '', '/checkout');
    document.cookie = '_fbp=not-a-meta-id; path=/';
    document.cookie = `_fbc=fb.1.1700000000000.${'x'.repeat(600)}; path=/`;
    expect(readTrackingContext()).toEqual({ source_url: `${window.location.origin}/checkout` });
  });

  it('leaves out the cookies that are not set', () => {
    setMetaPixelActive(true);
    window.history.replaceState(null, '', '/checkout');
    expect(readTrackingContext()).toEqual({ source_url: `${window.location.origin}/checkout` });
  });
});

describe('trackers that are not mounted for this store', () => {
  // The vendor globals outlive TrackingScripts (consent withdrawn, or a client
  // navigation to another store): they must not receive events then.
  it('sends nothing after the tags were unmounted, although the globals remain', () => {
    const { fbq, gtag, track } = mountVendors();
    setActiveTrackers(null);
    trackAddToCart({ productId: 'p1', name: 'Mug', value: 10, currency: 'SEK', quantity: 1 });
    trackInitiateCheckout({ value: 10, currency: 'SEK', items: [{ productId: 'p1', quantity: 1 }] });
    trackPurchase(purchase);
    vi.advanceTimersByTime(VENDOR_MAX_RETRIES * VENDOR_RETRY_DELAY_MS + 1000);
    expect(fbq).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    // No guard either: a later visit with consent may still report the order.
    expect(window.localStorage.getItem(purchaseTrackedKey(ORDER))).toBeNull();
  });

  it('only the mounted vendor receives the event', () => {
    const { fbq, gtag, track } = mountVendors();
    setActiveTrackers({ meta: true });
    trackAddToCart({ productId: 'p1', name: 'Mug', value: 10, currency: 'SEK', quantity: 1 });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(gtag).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
