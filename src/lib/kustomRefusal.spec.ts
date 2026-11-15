import { describe, expect, it } from 'vitest';
import { kustomRefusalReason } from './kustomRefusal';

describe('kustomRefusalReason (B4)', () => {
  it('maps the per-order limit and invalid personnummer, nothing else', () => {
    expect(kustomRefusalReason({ code: 'CART_MAX_PER_ORDER' })).toBe('max_per_order');
    expect(kustomRefusalReason({ code: 'CUSTOM_FIELD_INVALID_PERSONNUMMER' })).toBe('invalid_participant');
    expect(
      kustomRefusalReason({ code: 'PERSONALIZATION_INVALID', errors: [{ code: 'CUSTOM_FIELD_REQUIRED' }, { code: 'CUSTOM_FIELD_INVALID_PERSONNUMMER' }] }),
    ).toBe('invalid_participant');
    expect(kustomRefusalReason({ code: 'PERSONALIZATION_INVALID', errors: [{ code: 'CUSTOM_FIELD_REQUIRED' }] })).toBeNull();
    expect(kustomRefusalReason({ code: 'ORDER_INSUFFICIENT_STOCK' })).toBeNull();
    expect(kustomRefusalReason(new Error('network'))).toBeNull();
    expect(kustomRefusalReason(null)).toBeNull();
  });
});
