import { describe, expect, it } from 'vitest';
import { organizationId, storeBrandName } from './storeBrand';

describe('storeBrandName (M161 B3)', () => {
  it('cuts a tagline at a spaced en dash', () => {
    expect(storeBrandName({ name: 'Namez – Personliga presenter & profilprodukter' })).toBe('Namez');
  });

  it('never cuts a plain hyphen', () => {
    expect(storeBrandName({ name: 'Anna-Design' })).toBe('Anna-Design');
    expect(storeBrandName({ name: 'Anna - Design' })).toBe('Anna - Design');
  });

  it('cuts at a spaced pipe or em dash, the first separator wins', () => {
    expect(storeBrandName({ name: 'A | B' })).toBe('A');
    expect(storeBrandName({ name: 'Shop — Tagline | More' })).toBe('Shop');
  });

  it('an explicit seo.brandName wins', () => {
    expect(storeBrandName({ name: 'Namez – Tagline', theme: { seo: { brandName: '  NAMEZ  ' } } })).toBe('NAMEZ');
    expect(storeBrandName({ name: 'Namez – Tagline', theme: { seo: { brandName: ' ' } } })).toBe('Namez');
  });

  it('an empty side keeps the full name', () => {
    expect(storeBrandName({ name: 'Namez – ' })).toBe('Namez –');
    expect(storeBrandName({ name: ' – Tagline' })).toBe('– Tagline');
    expect(storeBrandName({ name: null })).toBe('');
    expect(storeBrandName(undefined)).toBe('');
  });

  it('organizationId is per origin', () => {
    expect(organizationId('https://namez.shop')).toBe('https://namez.shop/#organization');
    expect(organizationId('https://namez.se/')).toBe('https://namez.se/#organization');
  });
});
