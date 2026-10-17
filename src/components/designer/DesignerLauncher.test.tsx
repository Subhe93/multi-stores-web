import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, lazy, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DRAFTS_KEY, type DesignerPayload } from '@/lib/designer/api';
import { SPEC } from '@/test/designer-fixtures';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ storeSlug: 'shop' }),
}));
// next/dynamic → React.lazy, so the stub editor below loads in the test.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) => {
    const Lazy = lazy(loader);
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      );
    };
  },
}));
vi.mock('./DesignerEditor', () => ({
  default: ({ onClose, initialDesignId }: { onClose: () => void; initialDesignId: string | null }) => (
    <div role="dialog" data-design={initialDesignId ?? ''}>
      <button type="button" onClick={onClose}>
        close-editor
      </button>
    </div>
  ),
}));

import { DesignerLauncher, HISTORY_MARK } from './DesignerLauncher';

const payload: DesignerPayload = {
  template_id: 't1',
  template_version_id: 'v1',
  spec_public: SPEC,
  fonts: [],
  settings: { max_upload_mb: 25, min_effective_dpi_warning: 100 },
};

function renderLauncher() {
  return render(
    <DesignerLauncher payload={payload} productId="p1" locale="en" productTitle="Sign" onAddToCart={async () => undefined} />,
  );
}

describe('DesignerLauncher history handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/products/sign');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('clears a stale open-marker left on the current entry by a reload', async () => {
    window.history.replaceState({ [HISTORY_MARK]: true, keep: 1 }, '', '/products/sign');
    renderLauncher();
    await waitFor(() => expect(window.history.state[HISTORY_MARK]).toBeUndefined());
    expect(window.history.state.keep).toBe(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on click, pushes one marked entry, and the Back button closes it', async () => {
    const user = userEvent.setup();
    const pushes = vi.spyOn(window.history, 'pushState');
    renderLauncher();
    await user.click(screen.getByRole('button', { name: 'cta' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(pushes).toHaveBeenCalledTimes(1);
    expect(window.history.state[HISTORY_MARK]).toBe(true);
    // Browser Back: the entry is already gone when popstate fires.
    window.history.replaceState({}, '', '/products/sign');
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'cta' })).toHaveFocus());
  });

  it('closing from the editor pops the pushed entry (history.back once)', async () => {
    const user = userEvent.setup();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderLauncher();
    await user.click(screen.getByRole('button', { name: 'cta' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByText('close-editor'));
    expect(back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // A later popstate (the back landing) must not call back() again.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('opens by itself on ?design=<id> and strips the parameter from the entry', async () => {
    const id = '11111111-2222-3333-4444-555555555555';
    window.history.replaceState({}, '', `/products/sign?design=${id}`);
    renderLauncher();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('data-design', id);
    expect(window.location.search).toBe('');
    expect(window.history.state[HISTORY_MARK]).toBe(true);
  });

  it('keeps both labels in the button so its width is stable (D23)', async () => {
    window.localStorage.setItem(DESIGN_DRAFTS_KEY, JSON.stringify({ p1: '11111111-2222-3333-4444-555555555555' }));
    renderLauncher();
    const button = await screen.findByRole('button', { name: 'continueDesign' });
    const cta = screen.getByText('cta');
    const cont = screen.getByText('continueDesign');
    expect(button).toContainElement(cta);
    expect(button).toContainElement(cont);
    expect(cta).toHaveAttribute('aria-hidden', 'true');
    expect(cta.className).toContain('invisible');
    expect(cont.className).not.toContain('invisible');
  });
});
