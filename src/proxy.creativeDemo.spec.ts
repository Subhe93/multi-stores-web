import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

// The creative engine demo page (/dev/creative-demo) is not a store route:
// while its gate is open the proxy lets it through like /builder-preview,
// before any store lookup.

function req(host: string, path: string): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

describe('proxy: creative demo route', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('passes through without a store lookup while the gate is open, on any host', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    for (const host of ['localhost:3100', 'some-store.localhost:3100', 'shop.example.com']) {
      const res = await proxy(req(host, '/dev/creative-demo?view=product&locale=ar'));
      expect(res.headers.get('x-middleware-next'), host).toBe('1');
      expect(res.headers.get('x-middleware-rewrite'), host).toBeNull();
      expect(res.headers.get('location'), host).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
