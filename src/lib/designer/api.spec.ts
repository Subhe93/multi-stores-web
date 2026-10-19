import { describe, expect, it, vi } from 'vitest';
import {
  absoluteUrl,
  createDesignerClient,
  DESIGN_TOKENS_KEY,
  DesignerApiError,
  designHeaders,
  designerClientOptions,
  forgetDesign,
  getDesignPath,
  getDesignToken,
  getDraftFor,
  readDesignerPayload,
  setDesignPath,
  setDesignToken,
  setDraftFor,
  templateImageUrls,
} from './api';
import type { TemplateSpecV1 } from '@multi-stores/core/designer';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

const SPEC = {
  schema: 'designer.template/1',
  unit: 'mm',
  width: 500,
  height: 700,
  bleed_mm: 0,
  render: { preview_px_per_mm: 2, print_px_per_mm: 6, fit_ref_px_per_mm: 6 },
  fonts: [],
  surfaces: [
    {
      key: 'front',
      background: { color: '#fff', fit: 'stretch', web: { asset_id: 'bg', width: 1000, height: 1400, url: '/api/designer/assets/bg.webp' } },
      elements: [
        { id: 'deco', type: 'image', x: 0, y: 0, w: 10, h: 10, rot: 0, z: 1, locked: true, asset: { asset_id: 'd1', width: 10, height: 10, url: 'https://cdn.example/d1.png' } },
      ],
    },
  ],
} as unknown as TemplateSpecV1;

const PAYLOAD = {
  template_id: 't1',
  template_version_id: 'v1',
  spec_public: SPEC,
  fonts: [{ family: 'Montserrat', weight: 600, style: 'normal', url: '/api/designer/fonts/f1.woff2' }],
  settings: { max_upload_mb: 25, min_effective_dpi_warning: 100 },
};

describe('readDesignerPayload', () => {
  it('accepts the contract shape', () => {
    const p = readDesignerPayload(PAYLOAD);
    expect(p?.template_version_id).toBe('v1');
    expect(p?.fonts).toEqual([{ family: 'Montserrat', weight: 600, style: 'normal', url: '/api/designer/fonts/f1.woff2' }]);
    expect(p?.settings).toEqual({ max_upload_mb: 25, min_effective_dpi_warning: 100 });
  });

  it('returns null for absent or malformed payloads (product behaves as before)', () => {
    expect(readDesignerPayload(undefined)).toBeNull();
    expect(readDesignerPayload(null)).toBeNull();
    expect(readDesignerPayload({ ...PAYLOAD, spec_public: { schema: 'other' } })).toBeNull();
    expect(readDesignerPayload({ ...PAYLOAD, template_version_id: 3 })).toBeNull();
  });

  it('fills missing settings and drops malformed fonts', () => {
    const p = readDesignerPayload({ ...PAYLOAD, settings: undefined, fonts: [{ family: 'X' }, 'bad'] });
    expect(p?.settings).toEqual({ max_upload_mb: 25, min_effective_dpi_warning: 100 });
    expect(p?.fonts).toEqual([]);
  });
});

describe('urls', () => {
  it('makes relative API paths absolute and keeps absolute ones', () => {
    expect(absoluteUrl('/api/designer/files/x')).toMatch(/^https?:\/\/.+\/api\/designer\/files\/x$/);
    expect(absoluteUrl('https://a.se/x.png')).toBe('https://a.se/x.png');
    expect(absoluteUrl(null)).toBe('');
  });

  it('collects the template image URLs by asset id', () => {
    const urls = templateImageUrls(SPEC);
    expect([...urls.keys()]).toEqual(['bg', 'd1']);
    expect(urls.get('d1')).toBe('https://cdn.example/d1.png');
  });
});

describe('token / path / draft maps', () => {
  it('stores tokens per design and forgets everything of a design', () => {
    const s = memoryStorage();
    setDesignToken('d1', 'tok1', s);
    setDesignToken('d2', 'tok2', s);
    setDesignPath('d1', '/products/sign', s);
    setDraftFor('p1', 'd1', s);
    expect(getDesignToken('d1', s)).toBe('tok1');
    expect(getDesignPath('d1', s)).toBe('/products/sign');
    expect(getDraftFor('p1', s)).toBe('d1');
    forgetDesign('d1', s);
    expect(getDesignToken('d1', s)).toBeNull();
    expect(getDesignPath('d1', s)).toBeNull();
    expect(getDraftFor('p1', s)).toBeNull();
    expect(getDesignToken('d2', s)).toBe('tok2');
  });

  it('survives corrupt storage and caps the map size', () => {
    const s = memoryStorage();
    s.setItem(DESIGN_TOKENS_KEY, '{not json');
    expect(getDesignToken('x', s)).toBeNull();
    for (let i = 0; i < 120; i++) setDesignToken(`d${i}`, `t${i}`, s);
    const map = JSON.parse(s.data.get(DESIGN_TOKENS_KEY)!);
    expect(Object.keys(map)).toHaveLength(100);
    expect(map.d0).toBeUndefined();
    expect(map.d119).toBe('t119');
  });

  it('builds headers from the JWT and the stored guest token', () => {
    const s = memoryStorage();
    setDesignToken('d1', 'tok', s);
    expect(designHeaders('d1', null, s)).toEqual({ 'X-Design-Token': 'tok' });
    expect(designHeaders('d1', 'jwt', s)).toEqual({ Authorization: 'Bearer jwt', 'X-Design-Token': 'tok' });
    expect(designHeaders(null, null, s)).toEqual({});
  });
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createDesignerClient', () => {
  const view = { id: 'd1', product_id: 'p1', template_version_id: 'v1', status: 'DRAFT', state: { v: 1, texts: {}, photos: {} }, state_version: 1, photos: {}, proof_url: null };

  it('create stores the one-time token and never sends a token header', async () => {
    const s = memoryStorage();
    const fetchImpl = vi.fn(async () => jsonResponse(201, { success: true, data: { ...view, token: 'secret' } }));
    const c = createDesignerClient({ storeSlug: 'namez', storage: s, fetchImpl, apiUrl: 'https://api.x/api' });
    const res = await c.create({ product_id: 'p1', template_version_id: 'v1' });
    expect(res).not.toHaveProperty('token');
    expect(getDesignToken('d1', s)).toBe('secret');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.x/api/designer/s/namez/designs');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Design-Token']).toBeUndefined();
    // The token is never part of a URL.
    expect(url).not.toContain('secret');
  });

  it('get / update / proof send the guest token header and the version', async () => {
    const s = memoryStorage();
    setDesignToken('d1', 'secret', s);
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: view }));
    const c = createDesignerClient({ storeSlug: 'namez', storage: s, fetchImpl, apiUrl: 'https://api.x/api' });
    await c.get('d1');
    await c.update('d1', { v: 1, texts: { name: 'Anna' }, photos: {} }, 4);
    await c.proof('d1');
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([u, i]) => `${i.method} ${u}`)).toEqual([
      'GET https://api.x/api/designer/s/namez/designs/d1',
      'PATCH https://api.x/api/designer/s/namez/designs/d1',
      'POST https://api.x/api/designer/s/namez/designs/d1/proof',
    ]);
    for (const [u, i] of calls) {
      expect((i.headers as Record<string, string>)['X-Design-Token']).toBe('secret');
      expect(u).not.toContain('secret');
    }
    expect(JSON.parse(calls[1]![1].body as string)).toEqual({ state: { v: 1, texts: { name: 'Anna' }, photos: {} }, state_version: 4 });
    expect(calls[1]![1].keepalive).toBeUndefined();
  });

  it('update can ask for a keepalive request (save on tab hide, D29)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: view }));
    const c = createDesignerClient({ storeSlug: 'namez', storage: memoryStorage(), fetchImpl, apiUrl: 'https://api.x/api' });
    await c.update('d1', { v: 1, texts: {}, photos: {} }, 4, { keepalive: true });
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe('PATCH');
  });

  it('throws coded errors with details (STALE, STATE_INVALID, 503)', async () => {
    const s = memoryStorage();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(409, { code: 'DESIGNER_DESIGN_STALE', message: 'stale' }))
      .mockResolvedValueOnce(
        jsonResponse(400, { code: 'DESIGNER_STATE_INVALID', message: 'bad', details: [{ element_id: 'name', rule: 'max_length' }, { bad: 1 }] }),
      )
      .mockResolvedValueOnce(jsonResponse(503, { code: 'DESIGNER_RENDER_UNAVAILABLE', message: 'busy' }));
    const c = createDesignerClient({ storeSlug: 's', storage: s, fetchImpl, apiUrl: 'https://api.x/api' });
    const e1 = await c.update('d1', { v: 1, texts: {}, photos: {} }, 1).catch((e) => e);
    expect(e1).toBeInstanceOf(DesignerApiError);
    expect(e1.status).toBe(409);
    expect(e1.code).toBe('DESIGNER_DESIGN_STALE');
    const e2 = await c.update('d1', { v: 1, texts: {}, photos: {} }, 1).catch((e) => e);
    expect(e2.details).toEqual([{ element_id: 'name', rule: 'max_length' }]);
    const e3 = await c.proof('d1').catch((e) => e);
    expect(e3.status).toBe(503);
    expect(e3.code).toBe('DESIGNER_RENDER_UNAVAILABLE');
  });
});

describe('designerClientOptions (claimed designs answer to the JWT only)', () => {
  it('creates no client while the customer session is still restoring', () => {
    expect(designerClientOptions('shop', { token: null, loading: true })).toBeNull();
    expect(designerClientOptions('shop', { token: 'stale-jwt', loading: true })).toBeNull();
  });

  it('creates no client without a store slug', () => {
    expect(designerClientOptions('', { token: 'jwt', loading: false })).toBeNull();
    expect(designerClientOptions(null, { token: null, loading: false })).toBeNull();
  });

  it('carries the JWT once the session is known, so requests send Authorization', async () => {
    const o = designerClientOptions('shop', { token: 'jwt-1', loading: false });
    expect(o).toEqual({ storeSlug: 'shop', authToken: 'jwt-1' });
    const storage = memoryStorage();
    setDesignToken('d1', 'guest-tok', storage);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 'd1' } }), { status: 200 }));
    await createDesignerClient({ ...o!, storage, fetchImpl: fetchImpl as unknown as typeof fetch, apiUrl: 'http://x/api' }).get('d1');
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
  });

  it('a signed-out session yields a guest client (token only)', () => {
    expect(designerClientOptions('shop', { token: null, loading: false })).toEqual({ storeSlug: 'shop', authToken: null });
  });
});
