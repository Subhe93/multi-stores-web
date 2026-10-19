import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, lazy, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DRAFTS_KEY, type DesignerPayload } from '@/lib/designer/api';
import type { TemplateSpecV1 } from '@multi-stores/core/designer';
import { StoreAppsProvider } from '@/hooks/useStoreApps';
import { fetchRouter, jsonResponse, makeView, SPEC, type RecordedCall } from '@/test/designer-fixtures';

// Per-test API routes and the cart spies, shared with the mocks below.
const h = vi.hoisted(() => ({
  routes: {} as Record<string, (call: { body: unknown; url: string }) => Response>,
  calls: [] as { method: string; url: string; body: unknown }[],
  refreshDesignLine: vi.fn(async () => undefined),
  replaceDesignLine: vi.fn(async () => undefined),
  push: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => false;
    return t;
  },
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ storeSlug: 'shop' }),
  usePathname: () => '/products/sign',
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn() }),
}));
// next/dynamic → React.lazy, so the inline chunk loads in the test.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> } | ComponentType<Record<string, unknown>>>) => {
    const Lazy = lazy(() =>
      loader().then((m) => ('default' in (m as object) ? (m as { default: ComponentType<Record<string, unknown>> }) : { default: m as ComponentType<Record<string, unknown>> })),
    );
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      );
    };
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: null, loading: false }) }));
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ items: [], refreshDesignLine: h.refreshDesignLine, replaceDesignLine: h.replaceDesignLine }),
}));
vi.mock('@/lib/designer/api', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/designer/api')>();
  return {
    ...orig,
    createDesignerClient: (o: Parameters<typeof orig.createDesignerClient>[0]) => {
      const router = fetchRouter(
        new Proxy({} as Record<string, (call: RecordedCall) => Response>, {
          ownKeys: () => Reflect.ownKeys(h.routes),
          getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
          get: (_t, key: string) => h.routes[key],
        }),
      );
      const impl: typeof fetch = async (input, init) => {
        const res = await router.impl(input, init);
        h.calls.push({ method: init?.method ?? 'GET', url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
        return res;
      };
      return orig.createDesignerClient({ ...o, fetchImpl: impl, apiUrl: 'http://api.test/api' });
    },
  };
});

import { DesignerCanvasSlot, DesignerFormSlot, DesignerSessionProvider, useDesignerAddonsTotal } from './DesignerSession';
import type { DesignedLine } from './DesignerInline';

const payload: DesignerPayload = {
  template_id: 't1',
  template_version_id: 'v1',
  spec_public: SPEC,
  fonts: [],
  settings: { max_upload_mb: 25, min_effective_dpi_warning: 100 },
  addons: [],
  back_templates: [],
};

// ── M5.6 double-sided fixtures ──────────────────────────────────────────────
const DOUBLE_ADDON = { key: 'double', type: 'toggle' as const, label: { en: 'Double-sided' }, price: 149, enables_back: true };
const BACK_TEMPLATES = [
  { template_id: 't1', template_version_id: 'v1', name: 'Front template', thumbnail_url: null },
  { template_id: 't2', template_version_id: 'v2', name: 'Greeting back', thumbnail_url: 'http://api.test/thumb.webp' },
];
/** The back template: a required text "greeting" (no photo slot). */
const BACK_SPEC = {
  ...SPEC,
  surfaces: [
    {
      ...SPEC.surfaces![0]!,
      elements: SPEC.surfaces![0]!.elements
        .filter((e) => e.id === 'name')
        .map((e) => ({ ...e, id: 'greeting', label: { en: 'Greeting' }, required: true })),
    },
  ],
} as unknown as TemplateSpecV1;
const doublePayload = { ...payload, addons: [DOUBLE_ADDON], back_templates: BACK_TEMPLATES };
/** Design routes that echo `back` like the server does. */
function backRoutes() {
  let back: unknown = undefined;
  h.routes = {
    'POST /designs': ({ body }) => {
      const b = body as { state: never; back?: unknown };
      if (b.back !== undefined) back = b.back;
      return jsonResponse(201, { data: { ...makeView({ state: b.state, state_version: 1 }), addons: { double: 1 }, ...(back ? { back } : {}), token: 'tok' } });
    },
    'PATCH /designs/d1': ({ body }) => {
      const b = body as { state: never; back?: unknown };
      if (b.back !== undefined) back = b.back;
      return jsonResponse(200, { data: { ...makeView({ state: b.state, state_version: 2 }), addons: { double: 1 }, ...(back ? { back } : {}) } });
    },
    'GET /back-templates/t2': () => jsonResponse(200, { data: { ...BACK_TEMPLATES[1], spec_public: BACK_SPEC, fonts: [] } }),
    'POST /designs/d1/proof': () => jsonResponse(200, { data: { proof_url: '/proofs/d1.jpg', proof_back_url: '/proofs/d1-back.jpg' } }),
  };
  return { back: () => back };
}

/** SPEC with the name text required (for the validation path). */
const REQUIRED_SPEC = {
  ...SPEC,
  surfaces: [
    {
      ...SPEC.surfaces![0]!,
      elements: SPEC.surfaces![0]!.elements.map((e) => (e.id === 'name' ? { ...e, required: true } : e)),
    },
  ],
} as unknown as TemplateSpecV1;

const ID = '11111111-2222-3333-4444-555555555555';

function renderInline(opts: { spec?: TemplateSpecV1; payload?: DesignerPayload; onAddToCart?: (line: DesignedLine) => Promise<void>; blockedReason?: string | null } = {}) {
  const onAddToCart: (line: DesignedLine) => Promise<void> = opts.onAddToCart ?? vi.fn(async () => undefined);
  const designer = { ...(opts.payload ?? payload), spec_public: opts.spec ?? SPEC };
  const utils = render(
    <StoreAppsProvider value={{ designer: { enabled: true } }}>
      <DesignerSessionProvider designer={designer} productId="p1" locale="en">
        <div data-testid="gallery">
          <DesignerCanvasSlot />
        </div>
        <div data-testid="summary">
          <DesignerFormSlot
            totalLabel="349 kr"
            quantitySelector={<span data-testid="qty">qty</span>}
            blockedReason={opts.blockedReason ?? null}
            onAddToCart={onAddToCart}
          />
        </div>
      </DesignerSessionProvider>
    </StoreAppsProvider>,
  );
  return { ...utils, onAddToCart };
}

describe('Designer inline (M5.5, NPP layout)', () => {
  beforeEach(() => {
    h.routes = {};
    h.calls.length = 0;
    h.refreshDesignLine.mockClear();
    h.replaceDesignLine.mockClear();
    h.push.mockClear();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/products/sign');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders the canvas in the gallery slot and the form in the summary slot, nothing modal', async () => {
    renderInline();
    const canvas = await screen.findByRole('application', { name: 'canvasLabel' });
    expect(screen.getByTestId('gallery')).toContainElement(canvas);
    const input = await screen.findByLabelText('Name');
    expect(screen.getByTestId('summary')).toContainElement(input);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.position).toBe('');
    // One CTA with the live total, the quantity picker next to it.
    const cta = screen.getByRole('button', { name: /addToCartWithPrice/ });
    expect(cta).toBeEnabled();
    expect(screen.getByTestId('qty')).toBeInTheDocument();
    // The canvas keeps the page scroll on vertical swipes (NPP).
    expect(canvas.style.touchAction).toBe('pan-y');
  });

  it('shows inline errors, a summary above the CTA and focuses the first field on an incomplete design', async () => {
    const user = userEvent.setup();
    const { onAddToCart } = renderInline({ spec: REQUIRED_SPEC });
    const cta = await screen.findByRole('button', { name: /addToCartWithPrice/ });
    await waitFor(() => expect(cta).toBeEnabled());
    await user.click(cta);
    expect(await screen.findByRole('alert')).toHaveTextContent('errorsSummary');
    // The required marker is part of the label ("Name*").
    const input = screen.getByLabelText(/^Name/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onAddToCart).not.toHaveBeenCalled();
    expect(h.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('one click saves the draft, adds the line and renders the proof in the background', async () => {
    const user = userEvent.setup();
    h.routes = {
      'POST /designs': ({ body }) =>
        jsonResponse(201, { data: { ...makeView({ state: (body as { state: never }).state, state_version: 1 }), token: 'tok' } }),
      'PATCH /designs/d1': ({ body }) => jsonResponse(200, { data: makeView({ state: (body as { state: never }).state, state_version: 2 }) }),
      'POST /designs/d1/proof': () => jsonResponse(200, { data: { proof_url: '/proofs/d1.jpg' } }),
    };
    const addDesignLine = vi.fn(async () => undefined);
    renderInline({ onAddToCart: addDesignLine });
    const input = await screen.findByLabelText('Name');
    await user.type(input, 'Anna');
    const cta = screen.getByRole('button', { name: /addToCartWithPrice/ });
    await user.click(cta);
    await waitFor(() => expect(addDesignLine).toHaveBeenCalledTimes(1));
    expect(addDesignLine).toHaveBeenCalledWith({
      designId: 'd1',
      token: 'tok',
      proofUrl: null,
      display: [{ id: 'name', label: 'Name', value: 'Anna' }],
    });
    // The proof was asked for after the add and pushed onto the cart line.
    await waitFor(() => expect(h.calls.some((c) => c.method === 'POST' && c.url.endsWith('/designs/d1/proof'))).toBe(true));
    await waitFor(() => expect(h.refreshDesignLine).toHaveBeenCalledWith('d1', { display: [{ id: 'name', label: 'Name', value: 'Anna' }], proofUrl: '/proofs/d1.jpg' }));
    // The product's draft pointer is cleared: the next visit starts a new design.
    expect(JSON.parse(window.localStorage.getItem(DESIGN_DRAFTS_KEY) || '{}').p1).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('loads the design of ?design=<id> inline and strips the parameter', async () => {
    window.history.replaceState({}, '', `/products/sign?design=${ID}`);
    h.routes = {
      [`GET /designs/${ID}`]: () => jsonResponse(200, { data: makeView({ id: ID, state: { v: 1, texts: { name: 'Anna' }, photos: {} } }) }),
    };
    renderInline();
    const input = await screen.findByLabelText('Name');
    await waitFor(() => expect(input).toHaveValue('Anna'));
    expect(window.location.search).toBe('');
    expect(JSON.parse(window.localStorage.getItem(DESIGN_DRAFTS_KEY) || '{}').p1).toBe(ID);
  });

  it('an ordered (locked) design shows the inline notice and "start again" copies it into a new draft', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', `/products/sign?design=${ID}`);
    h.routes = {
      [`GET /designs/${ID}`]: () => jsonResponse(409, { code: 'DESIGNER_DESIGN_LOCKED', message: 'locked' }),
      [`POST /designs/${ID}/duplicate`]: () =>
        jsonResponse(201, { data: { ...makeView({ id: 'd2', state: { v: 1, texts: { name: 'Anna' }, photos: {} } }), token: 'tok2' } }),
    };
    renderInline();
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('noticeLocked');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /startAgain/ }));
    await waitFor(() => expect(screen.queryByText('noticeLocked')).toBeNull());
    expect(screen.getByLabelText('Name')).toHaveValue('Anna');
    expect(JSON.parse(window.localStorage.getItem(DESIGN_DRAFTS_KEY) || '{}').p1).toBe('d2');
    // Nothing in the cart referenced the ordered design: no line to move.
    expect(h.replaceDesignLine).not.toHaveBeenCalled();
  });

  it('a blocked line (no variant picked) disables the CTA without touching the API', async () => {
    renderInline({ blockedReason: 'selectOptions' });
    const cta = await screen.findByRole('button', { name: /addToCartWithPrice/ });
    expect(cta).toBeDisabled();
    fireEvent.click(cta);
    expect(h.calls).toHaveLength(0);
  });
  it('add-ons (M5.5): toggling updates the CTA total, the selection autosaves and the add carries it', async () => {
    const user = userEvent.setup();
    const ADDONS = [
      { key: 'double', type: 'toggle' as const, label: { en: 'Double-sided' }, price: 149 },
      { key: 'poster', type: 'quantity' as const, label: { en: 'Poster' }, price: 179, max_qty: 10 },
    ];
    let saved: Record<string, number> | undefined;
    h.routes = {
      'POST /designs': ({ body }) => {
        saved = (body as { addons?: Record<string, number> }).addons;
        return jsonResponse(201, {
          data: { ...makeView({ state: (body as { state: never }).state, state_version: 1 }), ...(saved ? { addons: saved } : {}), token: 'tok' },
        });
      },
      'PATCH /designs/d1': ({ body }) => {
        const b = body as { state: never; addons?: Record<string, number> };
        if (b.addons) saved = b.addons;
        return jsonResponse(200, { data: { ...makeView({ state: b.state, state_version: 2 }), ...(saved ? { addons: saved } : {}) } });
      },
      'POST /designs/d1/proof': () => jsonResponse(200, { data: { proof_url: '/proofs/d1.jpg' } }),
    };
    const addDesignLine = vi.fn<(line: DesignedLine) => Promise<void>>(async () => undefined);
    // The host adds the hook's total to the unit price, like the product page.
    function Total() {
      const addons = useDesignerAddonsTotal();
      return <span data-testid="total">{349 + addons}</span>;
    }
    render(
      <StoreAppsProvider value={{ designer: { enabled: true } }}>
        <DesignerSessionProvider designer={{ ...payload, addons: ADDONS }} productId="p1" locale="en">
          <Total />
          <DesignerFormSlot totalLabel="349 kr" onAddToCart={addDesignLine} formatMoney={(n) => `${n} kr`} />
        </DesignerSessionProvider>
      </StoreAppsProvider>,
    );
    const legend = await screen.findByText('addonsTitle');
    expect(legend.tagName).toBe('LEGEND');
    expect(screen.getByTestId('total')).toHaveTextContent('349');
    const double = screen.getByRole('checkbox', { name: /Double-sided/ });
    await user.click(double);
    expect(double).toBeChecked();
    expect(screen.getByTestId('total')).toHaveTextContent('498');
    await user.click(screen.getByRole('checkbox', { name: /Poster/ }));
    const qty = screen.getByRole('combobox', { name: 'addonQuantityFor' });
    await user.selectOptions(qty, '2');
    expect(screen.getByTestId('total')).toHaveTextContent(String(349 + 149 + 2 * 179));
    await user.type(screen.getByLabelText('Name'), 'Anna');
    await user.click(screen.getByRole('button', { name: /addToCartWithPrice/ }));
    await waitFor(() => expect(addDesignLine).toHaveBeenCalledTimes(1));
    // The server got the selection with the draft; the line carries it.
    expect(saved).toEqual({ double: 1, poster: 2 });
    expect(addDesignLine).toHaveBeenCalledWith({
      designId: 'd1',
      token: 'tok',
      proofUrl: null,
      addonsUnitPrice: 149 + 358,
      display: [
        { id: 'name', label: 'Name', value: 'Anna' },
        { id: 'addon:double', label: 'Double-sided', value: '+149 kr' },
        { id: 'addon:poster', label: 'Poster', value: '× 2 (+358 kr)' },
      ],
    });
  });

  it('add-ons restore from ?design= (edit from the cart)', async () => {
    window.history.replaceState({}, '', `/products/sign?design=${ID}`);
    h.routes = {
      [`GET /designs/${ID}`]: () =>
        jsonResponse(200, { data: { ...makeView({ id: ID, state: { v: 1, texts: { name: 'Anna' }, photos: {} } }), addons: { double: 1 } } }),
    };
    render(
      <StoreAppsProvider value={{ designer: { enabled: true } }}>
        <DesignerSessionProvider
          designer={{ ...payload, addons: [{ key: 'double', type: 'toggle', label: { en: 'Double-sided' }, price: 149 }] }}
          productId="p1"
          locale="en"
        >
          <DesignerFormSlot totalLabel="349 kr" onAddToCart={vi.fn(async () => undefined)} />
        </DesignerSessionProvider>
      </StoreAppsProvider>,
    );
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Double-sided/ })).toBeChecked());
  });

  it('M5.6: the "Baksida" block appears only while the enabling add-on is ticked, "Samma design" by default', async () => {
    const user = userEvent.setup();
    backRoutes();
    renderInline({ payload: doublePayload });
    await screen.findByLabelText('Name');
    expect(document.querySelector('[data-designer-back]')).toBeNull();
    const double = screen.getByRole('checkbox', { name: /Double-sided/ });
    await user.click(double);
    const block = await waitFor(() => document.querySelector('[data-designer-back]'));
    expect(block).not.toBeNull();
    expect(screen.getByRole('radio', { name: /backSame/ })).toHaveAttribute('aria-checked', 'true');
    // Side thumbnails "Framsida / Baksida" and the desktop back canvas.
    expect(document.querySelector('[data-designer-side-thumbs]')).not.toBeNull();
    expect(screen.getAllByRole('img', { name: 'backCanvasLabel' }).length).toBeGreaterThan(0);
    // No gallery while "Samma design".
    expect(document.querySelector('[data-designer-back-gallery]')).toBeNull();
    await user.click(double);
    await waitFor(() => expect(document.querySelector('[data-designer-back]')).toBeNull());
  });

  it('M5.6: "Annan mall" shows the gallery; a pick loads that template\'s fields; an incomplete back blocks the add', async () => {
    const user = userEvent.setup();
    const routes = backRoutes();
    const addDesignLine = vi.fn<(line: DesignedLine) => Promise<void>>(async () => undefined);
    renderInline({ payload: doublePayload, onAddToCart: addDesignLine });
    await screen.findByLabelText('Name');
    await user.click(screen.getByRole('checkbox', { name: /Double-sided/ }));
    await user.click(await screen.findByRole('radio', { name: /backOther/ }));
    const gallery = await waitFor(() => document.querySelector('[data-designer-back-gallery]'));
    expect(gallery).not.toBeNull();
    expect(screen.getByRole('button', { name: /Greeting back/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Front template/ })).toBeInTheDocument();
    // Nothing picked yet: the add points at the gallery.
    await user.click(screen.getByRole('button', { name: /addToCartWithPrice/ }));
    expect(await screen.findByText('backTemplateRequired')).toBeInTheDocument();
    expect(addDesignLine).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Greeting back/ }));
    // The picked template's own editable text, bound to back.state.
    const greeting = await screen.findByLabelText(/^Greeting/);
    expect(h.calls.some((c) => c.method === 'GET' && c.url.endsWith('/products/p1/back-templates/t2'))).toBe(true);
    expect(document.querySelector('[data-designer-back-fields]')).not.toBeNull();
    // Required back text empty: blocked, focused, counted in the summary.
    await user.click(screen.getByRole('button', { name: /addToCartWithPrice/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('errorsSummary');
    expect(greeting).toHaveFocus();
    expect(addDesignLine).not.toHaveBeenCalled();
    await user.type(greeting, 'Hej');
    await user.click(screen.getByRole('button', { name: /addToCartWithPrice/ }));
    await waitFor(() => expect(addDesignLine).toHaveBeenCalledTimes(1));
    expect(addDesignLine.mock.calls[0]![0]).toMatchObject({ designId: 'd1', doubleSided: true, proofBackUrl: null });
    // The server got the back with the draft; both proofs refresh the cart line.
    expect(routes.back()).toEqual({ mode: 'other', template_id: 't2', template_version_id: 'v2', state: { v: 1, texts: { greeting: 'Hej' }, photos: {} } });
    await waitFor(() => expect(h.refreshDesignLine).toHaveBeenCalledWith('d1', expect.objectContaining({ proofUrl: '/proofs/d1.jpg', proofBackUrl: '/proofs/d1-back.jpg' })));
  });

  it('M5.6: edit-from-cart restores the back (mode, template, texts)', async () => {
    window.history.replaceState({}, '', `/products/sign?design=${ID}`);
    h.routes = {
      [`GET /designs/${ID}`]: () =>
        jsonResponse(200, {
          data: {
            ...makeView({ id: ID, state: { v: 1, texts: { name: 'Anna' }, photos: {} } }),
            addons: { double: 1 },
            back: { mode: 'other', template_id: 't2', template_version_id: 'v2', state: { v: 1, texts: { greeting: 'Hej' }, photos: {} } },
          },
        }),
      'GET /back-templates/t2': () => jsonResponse(200, { data: { ...BACK_TEMPLATES[1], spec_public: BACK_SPEC, fonts: [] } }),
    };
    renderInline({ payload: doublePayload });
    expect(await screen.findByLabelText(/^Greeting/)).toHaveValue('Hej');
    expect(screen.getByRole('radio', { name: /backOther/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /Greeting back/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /Double-sided/ })).toBeChecked();
  });

  it('G0: no add-ons in the payload renders no add-ons block', async () => {
    renderInline();
    await screen.findByLabelText('Name');
    expect(screen.queryByText('addonsTitle')).toBeNull();
    expect(document.querySelector('[data-designer-addons]')).toBeNull();
  });
});
