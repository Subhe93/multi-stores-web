import { describe, expect, it } from 'vitest';
import {
  dashboardOriginsFrom,
  hostnameOf,
  isPlatformHost,
  platformHostsFrom,
  platformSubdomainOf,
  primaryPlatformDomain,
} from './platformHosts';

// Domain-move overlap: the old and the new apex are both platform hosts.
const LIST = 'shopsdoor.com, www.shopsdoor.com,iwings-digital.com,www.iwings-digital.com';

describe('platformHosts', () => {
  it('hostnameOf: URL or bare host, lower-case, no port', () => {
    expect(hostnameOf('https://App.ShopsDoor.com:8443/x')).toBe('app.shopsdoor.com');
    expect(hostnameOf(' shopsdoor.com ')).toBe('shopsdoor.com');
    expect(hostnameOf('muba.localhost:3000')).toBe('muba.localhost');
    expect(hostnameOf('')).toBeNull();
    expect(hostnameOf(undefined)).toBeNull();
  });

  it('platformHostsFrom: web URL host first (bare + www), then the list, deduplicated', () => {
    expect(platformHostsFrom(LIST, 'https://shopsdoor.com')).toEqual([
      'shopsdoor.com',
      'www.shopsdoor.com',
      'iwings-digital.com',
      'www.iwings-digital.com',
    ]);
    expect(platformHostsFrom(undefined, 'https://www.shopsdoor.com')).toEqual(['www.shopsdoor.com', 'shopsdoor.com']);
    expect(platformHostsFrom('', 'http://localhost:3003')).toEqual(['localhost']);
    expect(platformHostsFrom(undefined, undefined)).toEqual(['localhost']);
    expect(platformHostsFrom('iwings-digital.com', 'nonsense')).toEqual(['iwings-digital.com']);
  });

  it('primaryPlatformDomain: first non-localhost host without www, else localhost', () => {
    expect(primaryPlatformDomain(platformHostsFrom(LIST, 'https://shopsdoor.com'))).toBe('shopsdoor.com');
    expect(primaryPlatformDomain(platformHostsFrom(undefined, 'https://www.shopsdoor.com'))).toBe('shopsdoor.com');
    expect(primaryPlatformDomain(['localhost'])).toBe('localhost');
    expect(primaryPlatformDomain(platformHostsFrom('iwings-digital.com', 'http://localhost:3003'))).toBe('iwings-digital.com');
  });

  it('isPlatformHost / platformSubdomainOf with both domains listed', () => {
    const hosts = platformHostsFrom(LIST, 'https://shopsdoor.com');
    expect(isPlatformHost('shopsdoor.com', hosts)).toBe(true);
    expect(isPlatformHost('www.shopsdoor.com', hosts)).toBe(true);
    expect(isPlatformHost('iwings-digital.com:443', hosts)).toBe(true);
    expect(isPlatformHost('namez.se', hosts)).toBe(false);
    expect(isPlatformHost('muba.shopsdoor.com', hosts)).toBe(false);

    expect(platformSubdomainOf('muba.shopsdoor.com', hosts)).toEqual({ label: 'muba', platformHost: 'shopsdoor.com' });
    expect(platformSubdomainOf('muba.iwings-digital.com', hosts)).toEqual({ label: 'muba', platformHost: 'iwings-digital.com' });
    expect(platformSubdomainOf('muba--eu.shopsdoor.com:3000', hosts)).toEqual({ label: 'muba--eu', platformHost: 'shopsdoor.com' });
    expect(platformSubdomainOf('a.muba.shopsdoor.com', hosts)).toEqual({ label: 'a', platformHost: 'shopsdoor.com' });
    expect(platformSubdomainOf('shopsdoor.com', hosts)).toBeNull();
    expect(platformSubdomainOf('www.iwings-digital.com', hosts)).toBeNull();
    expect(platformSubdomainOf('namez.se', hosts)).toBeNull();
    expect(platformSubdomainOf('notshopsdoor.com', hosts)).toBeNull();
  });

  it('dashboardOriginsFrom: primary first, extra list, origins only, deduplicated', () => {
    expect(dashboardOriginsFrom('https://app.shopsdoor.com/creator', 'https://ms-dash.iwings-digital.com, garbage ,')).toEqual([
      'https://app.shopsdoor.com',
      'https://ms-dash.iwings-digital.com',
    ]);
    expect(dashboardOriginsFrom('http://localhost:3002', 'http://localhost:3002')).toEqual(['http://localhost:3002']);
    expect(dashboardOriginsFrom(undefined, undefined)).toEqual([]);
  });
});
