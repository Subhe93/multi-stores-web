import { describe, expect, it } from 'vitest';
import {
  formatOrgNumber,
  hasTraderDetails,
  sellerDetailsOf,
  substituteTraderPlaceholders,
  traderAddressLines,
} from './traderDetails';

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

  it('localizes the country when a locale is given', () => {
    expect(traderAddressLines(td, 'en')).toEqual(['Storgatan 1', '111 22 Stockholm', 'Sweden']);
    expect(traderAddressLines(td, 'sv')).toEqual(['Storgatan 1', '111 22 Stockholm', 'Sverige']);
  });

  it('formats Swedish org numbers with the hyphen', () => {
    expect(formatOrgNumber('5599123469', 'SE')).toBe('559912-3469');
    expect(formatOrgNumber('559295-1007', 'SE')).toBe('559295-1007');
    expect(formatOrgNumber(' 559912 3469 ', null)).toBe('559912-3469');
    expect(formatOrgNumber('198001011234', 'se')).toBe('19800101-1234');
    expect(formatOrgNumber('5599123469', 'DE')).toBe('5599123469');
    expect(formatOrgNumber('HRB 12345', 'SE')).toBe('HRB 12345');
    expect(formatOrgNumber(null)).toBe('');
  });

  it('prefers seller_details (platform on MARKETPLACE) over trader_details', () => {
    const platform = { legal_name: 'Namez AB', org_number: '559295-1007', is_platform: true };
    expect(sellerDetailsOf({ seller_details: platform, trader_details: td })).toBe(platform);
    expect(sellerDetailsOf({ trader_details: td })).toBe(td);
    expect(sellerDetailsOf({ seller_details: null, trader_details: null })).toBeNull();
    expect(sellerDetailsOf(null)).toBeNull();
  });
});
