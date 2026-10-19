// ── Designer app: storefront API client (M4.2 §4.1, M4.2-CONTRACTS) ─────────
// Typed calls for the public design routes (`/api/designer/s/:slug/designs`),
// the guest token map and the parser of the product payload's `designer` key.
//
// Guests are identified by the design token returned once by `POST /`. It is
// kept in localStorage per design (`designer_tokens`, `{[designId]: token}`)
// and sent as the `X-Design-Token` header — never in a URL. Logged-in
// customers are identified by their JWT.

import { API_URL, API_ORIGIN } from '@/lib/api';
import type { DesignStateV1, TemplateSpecV1 } from '@multi-stores/core/designer';

// ── Product payload ───────────────────────────────────────────────────────

export interface DesignerFont {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

export interface DesignerSettings {
  max_upload_mb: number;
  min_effective_dpi_warning: number;
}

/** `product.designer` of `GET storefront/:slug/products/:id` (present only when active). */
export interface DesignerPayload {
  template_id: string;
  template_version_id: string;
  /** AssetRefs carry a public `url`; `background.print` is removed. */
  spec_public: TemplateSpecV1;
  fonts: DesignerFont[];
  settings: DesignerSettings;
  /** Paid add-ons (M5.5), enabled only, in display order; prices in the page currency. */
  addons: DesignerAddon[];
}

/** One add-on of the product payload (`designer.addons[]`). */
export interface DesignerAddon {
  key: string;
  type: 'toggle' | 'quantity';
  label: Record<string, string>;
  price: number;
  /** Quantity add-ons only (1..20). */
  max_qty?: number;
}

/** The customer's add-on choice `{key: qty}` (toggles use 1). */
export type AddonSelection = Record<string, number>;

/** Valid add-ons of the payload (malformed entries are dropped). */
export function readDesignerAddons(raw: unknown): DesignerAddon[] {
  if (!Array.isArray(raw)) return [];
  const out: DesignerAddon[] = [];
  for (const a of raw) {
    if (!isObj(a) || typeof a.key !== 'string' || !a.key) continue;
    if (a.type !== 'toggle' && a.type !== 'quantity') continue;
    const price = finite(a.price, -1);
    if (price < 0 || !isObj(a.label)) continue;
    const label: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.label)) if (typeof v === 'string' && v) label[k] = v;
    out.push({
      key: a.key,
      type: a.type,
      label,
      price,
      ...(a.type === 'quantity' ? { max_qty: Math.max(1, Math.min(20, Math.floor(finite(a.max_qty, 1)))) } : {}),
    });
  }
  return out;
}

/** The selection reduced to the payload's add-ons (unknown keys dropped, quantities clamped). */
export function normalizeAddonSelection(addons: DesignerAddon[], raw: unknown): AddonSelection {
  const out: AddonSelection = {};
  if (!isObj(raw)) return out;
  for (const a of addons) {
    const v = raw[a.key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) continue;
    out[a.key] = a.type === 'toggle' ? 1 : Math.min(v, a.max_qty ?? 1);
  }
  return out;
}

/** Per-unit price of the selected add-ons (display only; the server prices the line). */
export function addonsTotal(addons: DesignerAddon[], selection: AddonSelection): number {
  let sum = 0;
  for (const a of addons) sum += a.price * (selection[a.key] ?? 0);
  return Math.round(sum * 100) / 100;
}

export const DEFAULT_DESIGNER_SETTINGS: DesignerSettings = {
  max_upload_mb: 25,
  min_effective_dpi_warning: 100,
};

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function finite(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/**
 * Reads the payload's `designer` key. Anything malformed yields null, so the
 * product page falls back to its normal behaviour instead of a broken editor.
 */
export function readDesignerPayload(raw: unknown): DesignerPayload | null {
  if (!isObj(raw)) return null;
  const spec = raw.spec_public;
  if (
    typeof raw.template_id !== 'string' ||
    typeof raw.template_version_id !== 'string' ||
    !isObj(spec) ||
    spec.schema !== 'designer.template/1' ||
    !Array.isArray(spec.surfaces) ||
    !(finite(spec.width, 0) > 0) ||
    !(finite(spec.height, 0) > 0)
  ) {
    return null;
  }
  const fonts: DesignerFont[] = [];
  if (Array.isArray(raw.fonts)) {
    for (const f of raw.fonts) {
      if (!isObj(f) || typeof f.family !== 'string' || typeof f.url !== 'string') continue;
      fonts.push({
        family: f.family,
        weight: finite(f.weight, 400),
        style: f.style === 'italic' ? 'italic' : 'normal',
        url: f.url,
      });
    }
  }
  const s = isObj(raw.settings) ? raw.settings : {};
  return {
    template_id: raw.template_id,
    template_version_id: raw.template_version_id,
    spec_public: spec as unknown as TemplateSpecV1,
    fonts,
    settings: {
      max_upload_mb: finite(s.max_upload_mb, DEFAULT_DESIGNER_SETTINGS.max_upload_mb),
      min_effective_dpi_warning: finite(
        s.min_effective_dpi_warning,
        DEFAULT_DESIGNER_SETTINGS.min_effective_dpi_warning,
      ),
    },
    addons: readDesignerAddons(raw.addons),
  };
}

/** Public URLs of the template images (background web + decorations), keyed by asset id. */
export function templateImageUrls(spec: TemplateSpecV1): Map<string, string> {
  const out = new Map<string, string>();
  for (const sf of spec.surfaces || []) {
    const web = sf.background?.web as ({ asset_id: string; url?: unknown } | undefined);
    if (web && typeof web.url === 'string' && web.url) out.set(web.asset_id, absoluteUrl(web.url));
    for (const el of sf.elements || []) {
      if (el.type !== 'image') continue;
      const a = el.asset as { asset_id: string; url?: unknown } | undefined;
      if (a && typeof a.url === 'string' && a.url) out.set(a.asset_id, absoluteUrl(a.url));
    }
  }
  return out;
}

// ── Design view ───────────────────────────────────────────────────────────

export interface DesignPhotoView {
  asset_id: string;
  width: number;
  height: number;
  preview_url: string | null;
  effective_dpi: number;
  low_res: boolean;
}

export type DesignStatus = 'DRAFT' | 'IN_CART' | 'ORDERED';

export interface DesignView {
  id: string;
  product_id: string;
  template_version_id: string;
  status: DesignStatus;
  state: DesignStateV1;
  state_version: number;
  photos: Record<string, DesignPhotoView>;
  proof_url: string | null;
  /** Product page slug, so links back to the editor work in any browser. */
  product_slug?: string | null;
  /** M5.5 add-on selection; absent when none was chosen. */
  addons?: AddonSelection;
  created_at?: string;
  updated_at?: string;
}

export interface UploadPhotoResult {
  asset_id: string;
  width: number;
  height: number;
  preview_url: string | null;
  effective_dpi_default: number;
  low_res: boolean;
  design: DesignView;
}

export interface ProofResult {
  proof_url: string;
  reused: boolean;
}

/** URLs from the API are relative (`/api/designer/files/…`): make them absolute. */
export function absoluteUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ── Errors ────────────────────────────────────────────────────────────────

export interface DesignerErrorDetail {
  element_id: string;
  rule: string;
}

/**
 * Error of a design route; `code` is the API code (`DESIGNER_*`,
 * `STORE_APP_NOT_ENABLED`…). A network failure / abort of an upload has
 * `status` 0 and no code (the editor shows `designer.uploadFailed`).
 */
export class DesignerApiError extends Error {
  status: number;
  code?: string;
  details?: DesignerErrorDetail[];
  params?: Record<string, unknown>;
  constructor(status: number, body: unknown) {
    const b = isObj(body) ? body : {};
    super(typeof b.message === 'string' ? b.message : `Designer request failed (${status})`);
    this.name = 'DesignerApiError';
    this.status = status;
    if (typeof b.code === 'string') this.code = b.code;
    if (Array.isArray(b.details)) {
      this.details = b.details.filter(
        (d): d is DesignerErrorDetail =>
          isObj(d) && typeof d.element_id === 'string' && typeof d.rule === 'string',
      );
    }
    if (isObj(b.params)) this.params = b.params;
  }
}

/**
 * Error of a failed upload response. A 413 answered by a proxy (no JSON body)
 * still means the file is too large, so it gets the API's code.
 */
export function uploadError(status: number, body: unknown): DesignerApiError {
  const coded = isObj(body) && typeof body.code === 'string';
  if (status === 413 && !coded) return new DesignerApiError(413, { code: 'DESIGNER_UPLOAD_TOO_LARGE' });
  return new DesignerApiError(status, body);
}

/** True for an upload that never reached the API (network failure / abort). */
export function isUploadNetworkError(err: unknown): boolean {
  return err instanceof DesignerApiError && err.status === 0 && !err.code;
}

export function designerErrorCode(err: unknown): string | undefined {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : undefined;
}

// ── Token / path maps (localStorage) ──────────────────────────────────────

export const DESIGN_TOKENS_KEY = 'designer_tokens';
/** designId → product page path, so a cart line can link back to the editor. */
export const DESIGN_PATHS_KEY = 'designer_paths';
/** productId → unfinished draft id, so reopening the editor resumes it. */
export const DESIGN_DRAFTS_KEY = 'designer_drafts';
/** Upper bound of entries per map (oldest are dropped first). */
const MAP_MAX = 100;

type KV = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KV | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readMap(key: string, storage: KV | null): Record<string, string> {
  if (!storage) return {};
  try {
    const raw = JSON.parse(storage.getItem(key) || '{}');
    if (!isObj(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, string>, storage: KV | null): void {
  if (!storage) return;
  const entries = Object.entries(map);
  const kept = entries.length > MAP_MAX ? entries.slice(entries.length - MAP_MAX) : entries;
  try {
    storage.setItem(key, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Quota / private mode: the editor still works for this session.
  }
}

function setEntry(key: string, id: string, value: string | null, storage: KV | null): void {
  const map = readMap(key, storage);
  delete map[id]; // re-insert so the newest entry is last (eviction order)
  if (value !== null) map[id] = value;
  writeMap(key, map, storage);
}

export function getDesignToken(designId: string, storage: KV | null = defaultStorage()): string | null {
  return readMap(DESIGN_TOKENS_KEY, storage)[designId] ?? null;
}

export function setDesignToken(designId: string, token: string, storage: KV | null = defaultStorage()): void {
  setEntry(DESIGN_TOKENS_KEY, designId, token, storage);
}

export function getDesignPath(designId: string, storage: KV | null = defaultStorage()): string | null {
  return readMap(DESIGN_PATHS_KEY, storage)[designId] ?? null;
}

export function setDesignPath(designId: string, path: string, storage: KV | null = defaultStorage()): void {
  setEntry(DESIGN_PATHS_KEY, designId, path, storage);
}

export function getDraftFor(productId: string, storage: KV | null = defaultStorage()): string | null {
  return readMap(DESIGN_DRAFTS_KEY, storage)[productId] ?? null;
}

export function setDraftFor(productId: string, designId: string | null, storage: KV | null = defaultStorage()): void {
  setEntry(DESIGN_DRAFTS_KEY, productId, designId, storage);
}

/** Forgets everything stored for a design (token, path and any draft pointer to it). */
export function forgetDesign(designId: string, storage: KV | null = defaultStorage()): void {
  setEntry(DESIGN_TOKENS_KEY, designId, null, storage);
  setEntry(DESIGN_PATHS_KEY, designId, null, storage);
  const drafts = readMap(DESIGN_DRAFTS_KEY, storage);
  let changed = false;
  for (const [pid, did] of Object.entries(drafts)) {
    if (did === designId) {
      delete drafts[pid];
      changed = true;
    }
  }
  if (changed) writeMap(DESIGN_DRAFTS_KEY, drafts, storage);
}

// ── Client ────────────────────────────────────────────────────────────────

export interface DesignerClientOptions {
  storeSlug: string;
  /** Customer JWT (logged in); guests use the stored design token. */
  authToken?: string | null;
  fetchImpl?: typeof fetch;
  storage?: KV | null;
  /** Override of the API base (tests). */
  apiUrl?: string;
}

/**
 * Options for a design client, or null while it must not be created yet:
 * without a store slug, or while the customer session is still being restored
 * (`auth.loading`). Once a design has a `customer_id` the guest token no
 * longer grants access (API `designer-access.ts`, JWT only), so a request
 * sent before the JWT is known (or with an expired one about to be refreshed)
 * would 404 and make the editor forget a design the customer still owns.
 */
export function designerClientOptions(
  storeSlug: string | null | undefined,
  auth: { token: string | null; loading: boolean },
): DesignerClientOptions | null {
  if (!storeSlug || auth.loading) return null;
  return { storeSlug, authToken: auth.token };
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

export function designsPath(storeSlug: string): string {
  return `/designer/s/${encodeURIComponent(storeSlug)}/designs`;
}

/** Headers of a design request: JWT and/or the guest token of that design. */
export function designHeaders(
  designId: string | null,
  authToken: string | null | undefined,
  storage: KV | null,
): Record<string, string> {
  const h: Record<string, string> = {};
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  const token = designId ? getDesignToken(designId, storage) : null;
  if (token) h['X-Design-Token'] = token;
  return h;
}

async function readEnvelope<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw new DesignerApiError(res.status, body);
  return (isObj(body) && 'data' in body ? body.data : body) as T;
}

export function createDesignerClient(opts: DesignerClientOptions) {
  const base = `${opts.apiUrl ?? API_URL}${designsPath(opts.storeSlug)}`;
  const doFetch = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;

  async function json<T>(
    method: string,
    path: string,
    designId: string | null,
    body?: unknown,
    init?: Pick<RequestInit, 'keepalive'>,
  ): Promise<T> {
    const headers: Record<string, string> = designHeaders(designId, opts.authToken, storage);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(init?.keepalive ? { keepalive: true } : {}),
    });
    return readEnvelope<T>(res);
  }

  return {
    /** Creates a draft; the returned token is stored (it is never returned again). */
    async create(input: {
      product_id: string;
      template_version_id: string;
      state?: DesignStateV1;
      addons?: AddonSelection;
    }): Promise<DesignView> {
      const res = await json<DesignView & { token?: string }>('POST', '', null, input);
      const { token, ...view } = res;
      if (typeof token === 'string' && token) setDesignToken(view.id, token, storage);
      return view;
    },

    /**
     * Copies a design (any status, including ORDERED) into a new DRAFT with
     * the same photos; the new token is stored like `create`'s.
     */
    async duplicate(id: string): Promise<DesignView> {
      const res = await json<DesignView & { token?: string }>('POST', `/${encodeURIComponent(id)}/duplicate`, id);
      const { token, ...view } = res;
      if (typeof token === 'string' && token) setDesignToken(view.id, token, storage);
      return view;
    },

    get(id: string): Promise<DesignView> {
      return json<DesignView>('GET', `/${encodeURIComponent(id)}`, id);
    },

    /**
     * 409 DESIGNER_DESIGN_STALE when `state_version` is not the current one.
     * `keepalive` lets the request outlive the page (save on tab hide / unload).
     */
    update(
      id: string,
      state: DesignStateV1,
      stateVersion: number,
      init?: { keepalive?: boolean; addons?: AddonSelection },
    ): Promise<DesignView> {
      const { addons, ...rest } = init ?? {};
      return json<DesignView>(
        'PATCH',
        `/${encodeURIComponent(id)}`,
        id,
        // `addons` only when the selection changed (absent = kept).
        { state, state_version: stateVersion, ...(addons ? { addons } : {}) },
        init ? rest : undefined,
      );
    },

    deletePhoto(id: string, assetId: string): Promise<DesignView> {
      return json<DesignView>(
        'DELETE',
        `/${encodeURIComponent(id)}/photos/${encodeURIComponent(assetId)}`,
        id,
      );
    },

    /** 503 DESIGNER_RENDER_UNAVAILABLE when the render engine is off or busy. */
    proof(id: string): Promise<ProofResult> {
      return json<ProofResult>('POST', `/${encodeURIComponent(id)}/proof`, id);
    },

    /**
     * Uploads the ORIGINAL file for an image slot (multipart `file` +
     * `element_id`). XHR so the caller gets upload progress.
     */
    uploadPhoto(
      id: string,
      elementId: string,
      file: Blob,
      onProgress?: (p: UploadProgress) => void,
      signal?: AbortSignal,
    ): Promise<UploadPhotoResult> {
      const url = `${base}/${encodeURIComponent(id)}/photos`;
      const headers = designHeaders(id, opts.authToken, storage);
      return new Promise<UploadPhotoResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => {
          if (onProgress && e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total });
        };
        xhr.onload = () => {
          let body: unknown = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            body = null;
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve((isObj(body) && 'data' in body ? body.data : body) as UploadPhotoResult);
          } else {
            reject(uploadError(xhr.status, body));
          }
        };
        xhr.onerror = () => reject(new DesignerApiError(0, null));
        xhr.onabort = () => reject(new DesignerApiError(0, null));
        if (signal) {
          if (signal.aborted) {
            reject(new DesignerApiError(0, null));
            return;
          }
          signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        const form = new FormData();
        form.append('element_id', elementId);
        form.append('file', file);
        xhr.send(form);
      });
    },
  };
}

export type DesignerClient = ReturnType<typeof createDesignerClient>;
