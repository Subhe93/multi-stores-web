import { describe, expect, it } from 'vitest';
import {
  apiErrorCode,
  buildAvailability,
  checkoutMode,
  classicPossible,
  defaultStorePaymentFlags,
  kustomFailureAction,
  kustomOrderFirstAction,
  storeFlagsAfterRefusal,
  storePaymentFlags,
  type PaymentAvailability,
  type PaymentConfig,
  type StorePaymentPayload,
} from './checkoutPayment';

// M157 (design §7.2): the API narrows the store payload flags and the
// payment config to the methods of the request market; the web only ANDs
// them. Each row feeds what the API answers for that matrix row.

const STORE_ID = 'store-1';

function payload(p: Partial<StorePaymentPayload>): StorePaymentPayload {
  return { id: STORE_ID, store_type: 'INDEPENDENT', card_payments_enabled: true, kustom_enabled: true, cod_enabled: false, ...p };
}

function config(p: Partial<PaymentConfig>): PaymentConfig {
  return {
    stripeConfigured: true,
    publishableKey: 'pk_live_x',
    stripeAccount: null,
    route: 'OWN_KEY',
    kustomEnabled: true,
    ...p,
  };
}

// API answer when the market excludes card (§4.1).
const CARD_EXCLUDED: Partial<PaymentConfig> = { stripeConfigured: false, publishableKey: null, stripeAccount: null };

function view(store: StorePaymentPayload, cfg: PaymentConfig | null, opts: { wantsClassic?: boolean; previewMode?: boolean } = {}) {
  const availability = buildAvailability(storePaymentFlags(store), cfg);
  const mode = checkoutMode(availability, { wantsClassic: opts.wantsClassic ?? false, previewMode: opts.previewMode ?? false });
  return {
    mode,
    card: availability.stripe,
    kustom: availability.kustom,
    cod: availability.cod,
    classic: classicPossible(availability),
  };
}

describe('buildAvailability (unchanged formula, moved out of the page)', () => {
  it('regression: today\'s output for a market without the setting', () => {
    const a = buildAvailability(storePaymentFlags(payload({})), config({}));
    expect(a).toEqual<PaymentAvailability>({
      storeId: STORE_ID,
      cod: false,
      stripe: true,
      kustom: true,
      publishableKey: 'pk_live_x',
      stripeAccount: null,
      route: 'OWN_KEY',
      testMode: false,
      ownerPreview: false,
    });
  });

  it('owner preview offers only the test card', () => {
    const a = buildAvailability(
      storePaymentFlags(payload({ preview: true, card_payments_enabled: false, cod_enabled: true })),
      config({ test_mode: true, publishableKey: 'pk_test_x' }),
    );
    expect(a).toMatchObject({ cod: false, stripe: true, kustom: false, testMode: true, ownerPreview: true, publishableKey: 'pk_test_x' });
  });

  it('no config: nothing card / Kustom', () => {
    const a = buildAvailability(storePaymentFlags(payload({})), null);
    expect(a.stripe).toBe(false);
    expect(a.kustom).toBe(false);
  });

  it('a failed store read cannot re-enable what the config excludes', () => {
    const a = buildAvailability(defaultStorePaymentFlags(), config({ ...CARD_EXCLUDED, kustomEnabled: false }));
    expect(a).toMatchObject({ stripe: false, kustom: false, cod: false });
  });

  it('COD needs an INDEPENDENT store with cod_enabled', () => {
    expect(storePaymentFlags(payload({ cod_enabled: true })).cod).toBe(true);
    expect(storePaymentFlags(payload({ cod_enabled: true, store_type: 'MARKETPLACE' })).cod).toBe(false);
    expect(storePaymentFlags(payload({ cod_enabled: undefined })).cod).toBe(false);
  });
});

describe('matrix §7.2', () => {
  it('row 1: unset, Stripe + Kustom ready → Kustom-first with a classic way', () => {
    expect(view(payload({}), config({}))).toEqual({ mode: 'kustom', card: true, kustom: true, cod: false, classic: true });
  });

  it('row 2: unset, Stripe not ready → Kustom only', () => {
    expect(view(payload({}), config({ ...CARD_EXCLUDED }))).toEqual({ mode: 'kustom', card: false, kustom: true, cod: false, classic: false });
  });

  it('row 3: unset, Kustom not ready → card form', () => {
    expect(view(payload({ kustom_enabled: false }), config({ kustomEnabled: false }))).toEqual({
      mode: 'classic', card: true, kustom: false, cod: false, classic: true,
    });
  });

  it('row 4: [card] → card form only, no COD, no Kustom', () => {
    // The API answers kustom_enabled / cod_enabled false for this market.
    expect(view(payload({ kustom_enabled: false, cod_enabled: false }), config({ kustomEnabled: false }))).toEqual({
      mode: 'classic', card: true, kustom: false, cod: false, classic: true,
    });
  });

  it('row 5: [kustom] → Kustom only; ?method=classic is ignored', () => {
    const store = payload({ card_payments_enabled: false });
    const cfg = config({ ...CARD_EXCLUDED });
    expect(view(store, cfg)).toEqual({ mode: 'kustom', card: false, kustom: true, cod: false, classic: false });
    expect(view(store, cfg, { wantsClassic: true }).mode).toBe('kustom');
  });

  it('row 6: [kustom, cod] → Kustom-first; classic form has COD only', () => {
    const store = payload({ card_payments_enabled: false, cod_enabled: true });
    const cfg = config({ ...CARD_EXCLUDED });
    expect(view(store, cfg)).toEqual({ mode: 'kustom', card: false, kustom: true, cod: true, classic: true });
    expect(view(store, cfg, { wantsClassic: true })).toEqual({ mode: 'classic', card: false, kustom: true, cod: true, classic: true });
  });

  it('row 7: [card, cod] → classic with card + COD, no Kustom', () => {
    expect(view(payload({ kustom_enabled: false, cod_enabled: true }), config({ kustomEnabled: false }))).toEqual({
      mode: 'classic', card: true, kustom: false, cod: true, classic: true,
    });
  });

  it('row 8: [card] without Stripe → nothing payable', () => {
    expect(view(payload({ card_payments_enabled: false, kustom_enabled: false }), config({ ...CARD_EXCLUDED, kustomEnabled: false }))).toEqual({
      mode: 'classic', card: false, kustom: false, cod: false, classic: false,
    });
  });

  it('row 10: [cod] → COD only', () => {
    expect(view(
      payload({ card_payments_enabled: false, kustom_enabled: false, cod_enabled: true }),
      config({ ...CARD_EXCLUDED, kustomEnabled: false }),
    )).toEqual({ mode: 'classic', card: false, kustom: false, cod: true, classic: true });
  });

  it('row 11: owner preview with [kustom] (card excluded) → nothing payable', () => {
    expect(view(payload({ preview: true, card_payments_enabled: false }), config({ ...CARD_EXCLUDED, test_mode: undefined }))).toEqual({
      mode: 'classic', card: false, kustom: false, cod: false, classic: false,
    });
  });

  it('Namez eu ([card], OWN_KEY live) → Stripe Payment Element only', () => {
    // Kustom creator ready and EUR in the static list, but the market excludes it.
    const v = view(payload({ kustom_enabled: false }), config({ kustomEnabled: false, route: 'OWN_KEY' }));
    expect(v).toEqual({ mode: 'classic', card: true, kustom: false, cod: false, classic: true });
  });

  it('Namez SE ([kustom]) → Kustom only, no classic way even with ?method=classic', () => {
    const store = payload({ card_payments_enabled: false });
    const cfg = config({ ...CARD_EXCLUDED });
    expect(view(store, cfg)).toEqual({ mode: 'kustom', card: false, kustom: true, cod: false, classic: false });
    expect(view(store, cfg, { wantsClassic: true }).mode).toBe('kustom');
  });

  it('market preview never goes Kustom-first', () => {
    expect(view(payload({}), config({}), { previewMode: true }).mode).toBe('classic');
  });

  it('?method=classic is honoured when the classic form can take a payment', () => {
    expect(view(payload({}), config({}), { wantsClassic: true }).mode).toBe('classic');
  });
});

describe('M157 error handling helpers', () => {
  it('apiErrorCode reads a string code only', () => {
    expect(apiErrorCode({ code: 'X' })).toBe('X');
    expect(apiErrorCode({ code: 3 })).toBeNull();
    expect(apiErrorCode(null)).toBeNull();
    expect(apiErrorCode(new Error('x'))).toBeNull();
  });

  it('kustomFailureAction', () => {
    const both = { classicAvailable: true, cardAvailable: true };
    const codOnly = { classicAvailable: true, cardAvailable: false };
    const none = { classicAvailable: false, cardAvailable: false };
    expect(kustomFailureAction('MARKET_PAYMENT_METHOD_NOT_ALLOWED', both)).toEqual({ kind: 'classic' });
    expect(kustomFailureAction('MARKET_PAYMENT_METHOD_NOT_ALLOWED', none)).toEqual({ kind: 'methodNotAllowed' });
    expect(kustomFailureAction('KUSTOM_CURRENCY_NOT_ENABLED', both)).toEqual({ kind: 'currency', payByCard: true, otherWay: false });
    expect(kustomFailureAction('KUSTOM_CURRENCY_NOT_ENABLED', codOnly)).toEqual({ kind: 'currency', payByCard: false, otherWay: true });
    expect(kustomFailureAction('KUSTOM_CURRENCY_NOT_ENABLED', none)).toEqual({ kind: 'currency', payByCard: false, otherWay: false });
    expect(kustomFailureAction('CART_EMPTY', both)).toEqual({ kind: 'default' });
    expect(kustomFailureAction(null, both)).toEqual({ kind: 'default' });
  });

  it('kustomOrderFirstAction', () => {
    expect(kustomOrderFirstAction('MARKET_PAYMENT_METHOD_NOT_ALLOWED')).toBe('checkout');
    expect(kustomOrderFirstAction('ORDER_KUSTOM_UNAVAILABLE')).toBe('checkout');
    expect(kustomOrderFirstAction('KUSTOM_CURRENCY_NOT_ENABLED')).toBe('currency');
    expect(kustomOrderFirstAction('ORDER_NOT_FOUND')).toBe('default');
    expect(kustomOrderFirstAction(null)).toBe('default');
  });
});

describe('storeFlagsAfterRefusal (classic form, MARKET_PAYMENT_METHOD_NOT_ALLOWED)', () => {
  const codAndCard = storePaymentFlags(payload({ cod_enabled: true, kustom_enabled: false }));

  it('hides a refused COD even when the store read failed (COD comes only from the store payload)', () => {
    const flags = storeFlagsAfterRefusal(codAndCard, null, 'cod');
    const availability = buildAvailability(flags, config({ kustomEnabled: false }));
    expect(availability.cod).toBe(false);
    expect(availability.stripe).toBe(true);
    expect(classicPossible(availability)).toBe(true);
  });

  it('hides a refused COD even when a stale store read still offers it', () => {
    const stale = storePaymentFlags(payload({ cod_enabled: true }));
    expect(storeFlagsAfterRefusal(codAndCard, stale, 'cod').cod).toBe(false);
  });

  it('uses the fresh store read for the other methods', () => {
    const fresh = storePaymentFlags(payload({ cod_enabled: true, card_payments_enabled: false }));
    const flags = storeFlagsAfterRefusal(codAndCard, fresh, 'cod');
    expect(flags).toMatchObject({ cod: false, card: false, storeId: STORE_ID });
  });

  it('hides a refused card even when the config still says Stripe is configured', () => {
    const flags = storeFlagsAfterRefusal(codAndCard, null, 'card');
    const availability = buildAvailability(flags, config({}));
    expect(availability.stripe).toBe(false);
    expect(availability.cod).toBe(true);
  });

  it('does not mutate the cached flags', () => {
    const prev = { ...codAndCard };
    storeFlagsAfterRefusal(prev, null, 'cod');
    expect(prev.cod).toBe(true);
  });
});
