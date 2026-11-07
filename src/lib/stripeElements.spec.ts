import { describe, expect, it } from 'vitest';
import {
  pendingAfterRouteChange,
  buildStripeAppearance,
  confirmErrorOutcome,
  intentStatusOutcome,
  primaryFontFamily,
  readCreateIntent,
  readStripeReturn,
  routeChanged,
  settleUncertainPayment,
  stripeFontSources,
  toStripeLocale,
  toStripeMinorAmount,
} from './stripeElements';

const params = (q: string) => new URLSearchParams(q);

describe('toStripeMinorAmount', () => {
  it('converts two-decimal currencies to cents', () => {
    expect(toStripeMinorAmount(199.99, 'SEK')).toBe(19999);
    expect(toStripeMinorAmount(0.1 + 0.2, 'eur')).toBe(30);
  });
  it('keeps zero-decimal currencies whole', () => {
    expect(toStripeMinorAmount(1500, 'JPY')).toBe(1500);
  });
  it('never returns zero or a negative amount', () => {
    expect(toStripeMinorAmount(0, 'EUR')).toBe(1);
    expect(toStripeMinorAmount(-5, 'EUR')).toBe(1);
    expect(toStripeMinorAmount(Number.NaN, 'EUR')).toBe(1);
  });
});

describe('toStripeLocale', () => {
  it('maps supported locales and falls back to auto', () => {
    expect(toStripeLocale('sv')).toBe('sv');
    expect(toStripeLocale('ar-SA')).toBe('ar');
    expect(toStripeLocale('xx')).toBe('auto');
    expect(toStripeLocale(undefined)).toBe('auto');
  });
});

describe('buildStripeAppearance', () => {
  it('uses valid theme colours, radius and font', () => {
    const a = buildStripeAppearance({
      primary: '#ff0000', background: 'rgb(255, 255, 255)', text: '#111', border: '#ddd',
      radius: '0.5rem', fontFamily: '"Poppins", system-ui, sans-serif',
    });
    expect(a.variables).toMatchObject({
      colorPrimary: '#ff0000', colorBackground: 'rgb(255, 255, 255)', colorText: '#111',
      borderRadius: '8px', fontFamily: '"Poppins", system-ui, sans-serif',
    });
    expect(a.rules?.['.Input']).toEqual({ borderColor: '#ddd' });
  });
  it('drops values Stripe cannot parse and caps the radius', () => {
    const a = buildStripeAppearance({ primary: 'oklch(0.6 0.2 30)', radius: '9999px', text: 'var(--x)', fontFamily: 'Bad<Font>' });
    expect(a.variables?.colorPrimary).toBeUndefined();
    expect(a.variables?.colorText).toBeUndefined();
    expect(a.variables?.fontFamily).toBeUndefined();
    expect(a.variables?.borderRadius).toBe('16px');
    expect(a.rules).toBeUndefined();
  });
});

describe('fonts', () => {
  it('reads the first family', () => {
    expect(primaryFontFamily("'Open Sans', Arial")).toBe('Open Sans');
    expect(primaryFontFamily('')).toBeNull();
  });
  it('builds a Google Fonts source only for web fonts', () => {
    expect(stripeFontSources('"Open Sans", system-ui')).toEqual([
      { cssSrc: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600&display=swap' },
    ]);
    expect(stripeFontSources('system-ui, sans-serif')).toEqual([]);
    expect(stripeFontSources('Arial')).toEqual([]);
    expect(stripeFontSources('Bad<Font>')).toEqual([]);
  });
});

describe('readStripeReturn', () => {
  it('ignores pages without the checkout marker', () => {
    expect(readStripeReturn(params('orderId=1&redirect_status=succeeded'))).toBeNull();
  });
  it('maps redirect statuses', () => {
    expect(readStripeReturn(params('stripe_return=1&redirect_status=succeeded'))).toBe('succeeded');
    expect(readStripeReturn(params('stripe_return=1&redirect_status=failed'))).toBe('failed');
    expect(readStripeReturn(params('stripe_return=1&redirect_status=processing'))).toBe('processing');
    expect(readStripeReturn(params('stripe_return=1&redirect_status=pending'))).toBe('processing');
    expect(readStripeReturn(params('stripe_return=1'))).toBe('processing');
  });
});

describe('readCreateIntent', () => {
  it('returns the client secret on the expected route', () => {
    expect(readCreateIntent({ clientSecret: 'cs_1', route: 'OWN_KEY' }, 'OWN_KEY')).toEqual({ kind: 'confirm', clientSecret: 'cs_1' });
    expect(readCreateIntent({ clientSecret: 'cs_1' }, 'OWN_KEY')).toEqual({ kind: 'confirm', clientSecret: 'cs_1' });
    expect(readCreateIntent({ clientSecret: 'cs_1', route: 'PLATFORM' }, undefined)).toEqual({ kind: 'confirm', clientSecret: 'cs_1' });
  });
  it('sends already paid / processing orders to the confirmation', () => {
    expect(readCreateIntent({ status: 'paid' }, 'OWN_KEY')).toEqual({ kind: 'paid' });
    expect(readCreateIntent({ status: 'processing', route: 'PLATFORM' }, 'OWN_KEY')).toEqual({ kind: 'processing' });
  });
  it('detects a route change', () => {
    expect(readCreateIntent({ clientSecret: 'cs_1', route: 'CONNECT_DIRECT' }, 'OWN_KEY')).toEqual({ kind: 'route_changed' });
    expect(routeChanged('OWN_KEY', 'OWN_KEY')).toBe(false);
    expect(routeChanged(null, 'OWN_KEY')).toBe(false);
  });
  it('flags a response without a secret', () => {
    expect(readCreateIntent({}, 'OWN_KEY')).toEqual({ kind: 'invalid' });
    expect(readCreateIntent(null, null)).toEqual({ kind: 'invalid' });
  });
});

describe('confirmErrorOutcome', () => {
  it('keeps the order for invalid details', () => {
    expect(confirmErrorOutcome({ type: 'validation_error' })).toBe('invalid_details');
  });
  it('drops the order only on a definitive decline', () => {
    expect(confirmErrorOutcome({ type: 'card_error', code: 'card_declined' })).toBe('declined');
    expect(confirmErrorOutcome({
      type: 'invalid_request_error', code: 'payment_intent_unexpected_state',
      payment_intent: { status: 'canceled' },
    })).toBe('declined');
  });
  it('treats an already settled intent as placed', () => {
    expect(confirmErrorOutcome({
      type: 'invalid_request_error', code: 'payment_intent_unexpected_state',
      payment_intent: { status: 'succeeded' },
    })).toBe('paid');
    expect(confirmErrorOutcome({
      type: 'invalid_request_error', code: 'payment_intent_unexpected_state',
      payment_intent: { status: 'processing' },
    })).toBe('processing');
  });
  it('never drops the order on network / unknown errors', () => {
    expect(confirmErrorOutcome({ type: 'api_connection_error' })).toBe('uncertain');
    expect(confirmErrorOutcome({ type: 'api_error' })).toBe('uncertain');
    expect(confirmErrorOutcome({})).toBe('uncertain');
    expect(confirmErrorOutcome({ type: 'invalid_request_error', code: 'payment_intent_unexpected_state' })).toBe('uncertain');
    expect(confirmErrorOutcome({
      type: 'invalid_request_error', code: 'payment_intent_unexpected_state',
      payment_intent: { status: 'requires_payment_method' },
    })).toBe('uncertain');
  });
});

describe('settleUncertainPayment', () => {
  it('trusts the intent read through Stripe.js', () => {
    expect(settleUncertainPayment({ status: 'succeeded' }, null)).toBe('paid');
    expect(settleUncertainPayment({ status: 'processing' }, { payment_status: 'paid' })).toBe('processing');
    expect(settleUncertainPayment({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } }, null)).toBe('failed');
    expect(settleUncertainPayment({ status: 'canceled' }, null)).toBe('failed');
  });
  it('keeps a never-confirmed intent open (the request never reached Stripe)', () => {
    expect(settleUncertainPayment({ status: 'requires_payment_method' }, null)).toBe('open');
    expect(settleUncertainPayment({ status: 'requires_action' }, null)).toBe('open');
  });
  it('falls back to the server reconcile when the intent cannot be read', () => {
    expect(settleUncertainPayment(null, { payment_status: 'paid' })).toBe('paid');
    expect(settleUncertainPayment(null, { payment_status: 'awaiting_payment', intent_status: 'processing' })).toBe('processing');
    expect(settleUncertainPayment(null, { payment_status: 'failed' })).toBe('failed');
  });
  it('stays open (retry on the same order) when nothing is known', () => {
    expect(settleUncertainPayment(null, null)).toBe('open');
    expect(settleUncertainPayment(null, { payment_status: 'awaiting_payment', intent_status: 'requires_confirmation' })).toBe('open');
  });
});

describe('intentStatusOutcome', () => {
  it('maps intent statuses', () => {
    expect(intentStatusOutcome('requires_capture')).toBe('paid');
    expect(intentStatusOutcome('requires_action')).toBe('open');
    expect(intentStatusOutcome(undefined)).toBe('open');
  });
});

describe('pendingAfterRouteChange', () => {
  const pending = { orderId: 'o1', clientSecret: 'pi_secret', signature: 'sig' };

  it('first route change keeps the order and drops its intent', () => {
    expect(pendingAfterRouteChange(pending)).toEqual({ ...pending, clientSecret: null, routeChanges: 1 });
    expect(pendingAfterRouteChange({ ...pending, routeChanges: 0 })).toEqual({ ...pending, clientSecret: null, routeChanges: 1 });
  });

  it('second consecutive route change drops the order (next submit makes a fresh one)', () => {
    const once = pendingAfterRouteChange(pending);
    expect(pendingAfterRouteChange(once)).toBeNull();
    expect(pendingAfterRouteChange({ ...pending, routeChanges: 3 })).toBeNull();
  });

  it('no pending order stays none', () => {
    expect(pendingAfterRouteChange(null)).toBeNull();
    expect(pendingAfterRouteChange(undefined)).toBeNull();
  });
});
