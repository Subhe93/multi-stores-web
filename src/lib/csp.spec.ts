import { describe, expect, it } from 'vitest';
import {
  cspContextFrom,
  cspHeaderName,
  cspHeaders,
  cspOrigin,
  cspOriginList,
  exactHostPattern,
  marketingCspDirectives,
  serializeCsp,
  storefrontCspDirectives,
} from './csp';

const prod = cspContextFrom({
  NEXT_PUBLIC_API_URL: 'https://api.shopsdoor.com/api',
  CSP_EXTRA_ORIGINS: 'https://media.example.com, junk, https://media.example.com/',
  NODE_ENV: 'production',
});

describe('cspOrigin / cspOriginList', () => {
  it('keeps scheme + host + port, drops paths and junk', () => {
    expect(cspOrigin('https://API.shopsdoor.com/api?x=1')).toBe('https://api.shopsdoor.com');
    expect(cspOrigin('http://localhost:3001/api')).toBe('http://localhost:3001');
    expect(cspOrigin('https://*.example.com')).toBe('https://*.example.com');
    expect(cspOrigin('api.shopsdoor.com')).toBeNull();
    expect(cspOrigin("https://a.com; script-src 'unsafe-eval'")).toBeNull();
    expect(cspOrigin('')).toBeNull();
  });
  it('parses and dedupes a comma list', () => {
    expect(cspOriginList('https://a.com, https://a.com/x ,bad,https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});

describe('cspContextFrom', () => {
  it('derives API origin, extras and the report URI from env', () => {
    expect(prod.apiOrigins).toEqual(['https://api.shopsdoor.com']);
    expect(prod.extraOrigins).toEqual(['https://media.example.com']);
    expect(prod.reportUri).toBe('https://api.shopsdoor.com/api/csp-report');
    expect(prod.dev).toBe(false);
    expect(prod.enforce).toBe(false);
  });
  it('CSP_REPORT_URI overrides; no API URL means no reporting', () => {
    expect(cspContextFrom({ NEXT_PUBLIC_API_URL: 'https://a.com/api/', CSP_REPORT_URI: 'https://r.example/x' }).reportUri).toBe(
      'https://r.example/x',
    );
    expect(cspContextFrom({}).reportUri).toBeNull();
    expect(cspContextFrom({ NEXT_PUBLIC_API_URL: 'https://a.com/api/' }).reportUri).toBe('https://a.com/api/csp-report');
  });
  it('CSP_ENFORCE flips the header name', () => {
    expect(cspHeaderName(prod)).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName(cspContextFrom({ CSP_ENFORCE: '1' }))).toBe('Content-Security-Policy');
    expect(cspHeaderName(cspContextFrom({ CSP_ENFORCE: 'true' }))).toBe('Content-Security-Policy');
    expect(cspHeaderName(cspContextFrom({ CSP_ENFORCE: '0' }))).toBe('Content-Security-Policy-Report-Only');
  });
});

describe('storefront policy', () => {
  const csp = storefrontCspDirectives(prod);
  it('locks down objects, base, ancestors; keeps owner scripts allowed', () => {
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(expect.arrayContaining(["'unsafe-inline'", 'https:']));
  });
  it('connect-src is an allowlist with both API hosts and the checkout providers', () => {
    expect(csp['connect-src']).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://api.shopsdoor.com',
        'https://media.example.com',
        'https://*.stripe.com',
        'https://*.kustom.co',
        'https://challenges.cloudflare.com',
      ]),
    );
    expect(csp['connect-src']).not.toContain('https:');
    expect(csp['connect-src']).not.toContain('ws:');
  });
  it('allows Microsoft Clarity uploads (connect-src) and its tag script (script-src https:)', () => {
    expect(csp['connect-src']).toEqual(expect.arrayContaining(['https://*.clarity.ms', 'https://c.bing.com']));
    expect(csp['script-src']).toContain('https:');
  });
  it('builder preview is framable by the dashboard origins', () => {
    const preview = storefrontCspDirectives(prod, { frameAncestors: ['https://app.shopsdoor.com'] });
    expect(preview['frame-ancestors']).toEqual(["'self'", 'https://app.shopsdoor.com']);
  });
  it('reports to the API via report-uri and report-to', () => {
    expect(csp['report-uri']).toEqual(['https://api.shopsdoor.com/api/csp-report']);
    expect(csp['report-to']).toEqual(['csp-endpoint']);
  });
});

describe('marketing policy', () => {
  const csp = marketingCspDirectives(prod);
  it('allows only Turnstile as a third-party script and no eval in prod', () => {
    expect(csp['script-src']).toEqual(["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com']);
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    expect(csp['font-src']).toContain('https://fonts.gstatic.com');
    expect(csp['form-action']).toEqual(["'self'"]);
  });
  it('dev adds eval and HMR websockets', () => {
    const dev = marketingCspDirectives(cspContextFrom({ NEXT_PUBLIC_API_URL: 'http://localhost:3001/api' }));
    expect(dev['script-src']).toContain("'unsafe-eval'");
    expect(dev['connect-src']).toEqual(expect.arrayContaining(['http://localhost:3001', 'ws:']));
  });
});

describe('serialization', () => {
  it('joins directives and dedupes sources', () => {
    expect(serializeCsp({ 'default-src': ["'self'", "'self'"], 'upgrade-insecure-requests': [] })).toBe(
      "default-src 'self'; upgrade-insecure-requests",
    );
  });
  it('cspHeaders adds Reporting-Endpoints', () => {
    const headers = cspHeaders(prod, marketingCspDirectives(prod));
    expect(headers[0].key).toBe('Content-Security-Policy-Report-Only');
    expect(headers[0].value).toContain("object-src 'none'");
    expect(headers[1]).toEqual({
      key: 'Reporting-Endpoints',
      value: 'csp-endpoint="https://api.shopsdoor.com/api/csp-report"',
    });
    expect(cspHeaders(cspContextFrom({}), {}).length).toBe(1);
  });
  it('exactHostPattern escapes dots and anchors via Next', () => {
    const re = new RegExp(`^${exactHostPattern(['shopsdoor.com', 'www.shopsdoor.com'])}$`);
    expect(re.test('shopsdoor.com')).toBe(true);
    expect(re.test('www.shopsdoor.com')).toBe(true);
    expect(re.test('namez.shopsdoor.com')).toBe(false);
    expect(re.test('shopsdoorxcom')).toBe(false);
  });
});
