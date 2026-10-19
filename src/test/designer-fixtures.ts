// Shared fixtures of the designer DOM tests: a minimal template spec, a design
// view and a designer client built on the `fetchImpl` / `storage` seams.
import { vi } from 'vitest';
import { createDesignerClient, type DesignerClient, type DesignView } from '@/lib/designer/api';
import type { TemplateSpecV1 } from '@multi-stores/core/designer';

export const SPEC = {
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
      background: { color: '#fff', fit: 'stretch' },
      elements: [
        {
          id: 'photo',
          type: 'image_slot',
          label: { en: 'Photo' },
          placeholder: {},
          shape: 'rect',
          radius: 0,
          border_color: '#000',
          required: false,
          adj_limits: { zoom: [1, 3], rot: [-45, 45] },
          default_adj: { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 },
          x: 100,
          y: 100,
          w: 200,
          h: 100,
          rot: 0,
          z: 1,
          locked: false,
        },
        {
          id: 'name',
          type: 'text',
          label: { en: 'Name' },
          placeholder: {},
          default_text: '',
          font: { family: 'Montserrat', weight: 600, style: 'normal' },
          size: 20,
          color: '#000',
          align: 'center',
          transform: 'none',
          fit: 'shrink',
          inset: 4,
          editable: true,
          required: false,
          max_length: 20,
          direction: 'auto',
          x: 0,
          y: 600,
          w: 500,
          h: 50,
          rot: 0,
          z: 2,
          locked: false,
        },
      ],
    },
  ],
} as unknown as TemplateSpecV1;

export function makeView(over: Partial<DesignView> = {}): DesignView {
  return {
    id: 'd1',
    product_id: 'p1',
    template_version_id: 'v1',
    status: 'DRAFT',
    state: { v: 1, texts: {}, photos: {} },
    state_version: 3,
    photos: {},
    proof_url: null,
    ...over,
  };
}

export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

/**
 * A response-like object (what `readEnvelope` reads). Not a real `Response`:
 * undici reads bodies through setImmediate, which fake timers would freeze.
 */
export function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  } as unknown as Response;
}

export interface RecordedCall {
  method: string;
  url: string;
  body: unknown;
  init: RequestInit;
}

/** A fetch mock routed by `"METHOD /path-suffix"`; every call is recorded. */
export function fetchRouter(routes: Record<string, (call: RecordedCall) => Response | Promise<Response>>) {
  const calls: RecordedCall[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const call: RecordedCall = { method, url, body, init: init ?? {} };
    calls.push(call);
    const key = Object.keys(routes).find((k) => {
      const [m, suffix] = k.split(' ', 2);
      return m === method && url.endsWith(suffix!);
    });
    if (!key) return jsonResponse(404, { code: 'DESIGNER_DESIGN_NOT_FOUND', message: `no route ${method} ${url}` });
    return routes[key]!(call);
  });
  return { impl: impl as unknown as typeof fetch, calls, mock: impl };
}

export function makeClient(fetchImpl: typeof fetch, storage = memoryStorage()): DesignerClient {
  return createDesignerClient({ storeSlug: 'shop', fetchImpl, storage, apiUrl: 'http://api.test/api' });
}
