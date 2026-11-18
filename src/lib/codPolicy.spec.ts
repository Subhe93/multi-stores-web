import { describe, expect, it } from 'vitest';
import { storeOffersCod } from './codPolicy';

describe('storeOffersCod', () => {
  it('independent store with the flag on: offered', () => {
    expect(storeOffersCod({ store_type: 'INDEPENDENT', cod_enabled: true })).toBe(true);
  });

  it('independent store with the flag off or missing: not offered', () => {
    expect(storeOffersCod({ store_type: 'INDEPENDENT', cod_enabled: false })).toBe(false);
    expect(storeOffersCod({ store_type: 'INDEPENDENT' })).toBe(false);
  });

  it('marketplace store: never offered, even with a stored true', () => {
    expect(storeOffersCod({ store_type: 'MARKETPLACE', cod_enabled: true })).toBe(false);
    expect(storeOffersCod({ store_type: 'MARKETPLACE', cod_enabled: false })).toBe(false);
  });

  it('unknown store type or no store: not offered', () => {
    expect(storeOffersCod({ cod_enabled: true })).toBe(false);
    expect(storeOffersCod(null)).toBe(false);
    expect(storeOffersCod(undefined)).toBe(false);
  });
});
