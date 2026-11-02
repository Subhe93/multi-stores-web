import { describe, expect, it } from 'vitest';
import { hasTraderDetails, substituteTraderPlaceholders, traderAddressLines } from './traderDetails';

const td = {
  legal_name: 'Namez AB',
  org_number: '5591234567',
  vat_number: 'SE559123456701',
  address_line1: 'Storgatan 1',
  address_line2: null,
  postal_code: '111 22',
  city: 'Stockholm',
  country: 'se',
  phone: '+46 70 123 45 67',
  support_email: 'hej@namez.se',
};

describe('traderDetails', () => {
  it('detects a usable payload', () => {
    expect(hasTraderDetails(td)).toBe(true);
    expect(hasTraderDetails(null)).toBe(false);
    expect(hasTraderDetails({})).toBe(false);
    expect(hasTraderDetails({ legal_name: '  ' })).toBe(false);
  });

  it('formats the address lines', () => {
    expect(traderAddressLines(td)).toEqual(['Storgatan 1', '111 22 Stockholm', 'SE']);
  });

  it('substitutes only the trader placeholders, escaped', () => {
    const html =
      '<p>{{trader.legal_name}} ({{ trader.org_number }}) — {{trader.address}}, {{trader.email}}, {{trader.phone}}, {{trader.vat_number}} {{other.x}} {{trader.unknown}}</p>';
    expect(substituteTraderPlaceholders(html, { ...td, legal_name: 'A <b>&</b>' })).toBe(
      '<p>A &lt;b&gt;&amp;&lt;/b&gt; (5591234567) — Storgatan 1, 111 22 Stockholm, SE, hej@namez.se, +46 70 123 45 67, SE559123456701 {{other.x}} {{trader.unknown}}</p>',
    );
  });

  it('blanks the placeholders when the store has no trader details', () => {
    expect(substituteTraderPlaceholders('<p>{{trader.legal_name}}</p>', null)).toBe('<p></p>');
    expect(substituteTraderPlaceholders('<p>plain</p>', null)).toBe('<p>plain</p>');
  });
});
