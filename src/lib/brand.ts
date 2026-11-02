// Single source of truth for the ShopsDoor brand on the marketing site.
// Raw hex values live here for places CSS variables cannot reach (OG images,
// JSON-LD, canvas). Everything rendered in React should use the `--sd-*`
// tokens declared in globals.css instead.

export const BRAND_NAME = 'ShopsDoor';
export const BRAND_TAGLINE = 'Many stores. One door.';

export const HEX = {
  navy: '#142D36',
  teal: '#15B8A6',
  ivory: '#F7F4EC',
  amber: '#F4B544',
  // Derived tints used by the marketing surfaces only.
  navyDeep: '#0E2129',
  tealDeep: '#0F9484',
  ink: '#1B2A31',
  muted: '#5B6B72',
  line: '#E6E0D3',
} as const;

export const SITE_URL = (process.env.NEXT_PUBLIC_WEB_URL || 'https://shopsdoor.com').replace(/\/$/, '');

// Legal entity that operates the platform. Values that are not public yet
// (organisation number, registered address) come from env so production can
// be filled without a code change; the UI hides a row when its value is empty.
export const COMPANY = {
  legalName: 'Namez AB',
  country: 'Sweden',
  countryCode: 'SE',
  orgNumber: process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER || '',
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
  vatNumber: process.env.NEXT_PUBLIC_COMPANY_VAT || '',
} as const;

// The dashboard is where store owners and partners sign in (separate origin).
export const DASHBOARD_URL = (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002').replace(/\/$/, '');
export const DASHBOARD_LOGIN_URL = `${DASHBOARD_URL}/auth/login`;

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@shopsdoor.com';

// In-page anchors of the landing page, in display order. Labels come from the
// `home.nav` dictionary keys with the same ids.
export const NAV = [
  { id: 'features', href: '#features' },
  { id: 'sell', href: '#sell' },
  { id: 'how', href: '#how-it-works' },
  { id: 'pricing', href: '#pricing' },
  { id: 'contact', href: '#contact' },
] as const;

export const CONTENT_DATE = '2026-11-02';
