import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import sv from '@/i18n/messages/sv.json';
import { VENDOR_LABELS } from '@/lib/consent';
import { CookieSettingsDialog, type CookieSettingsDialogProps } from './CookieSettingsDialog';

// Second layer (plans/consent-v2/CONTRACT.md §4.3, §9 web-ui).

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/consentLog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/consentLog')>()),
  consentTextHash: vi.fn(async () => 'b'.repeat(64)),
}));

const ID = '5f0c2a9e-1d2b-4c3d-8e4f-0123456789ab';

function baseProps(over: Partial<CookieSettingsDialogProps> = {}): CookieSettingsDialogProps {
  return {
    open: true,
    offered: { analytics: true, marketing: true },
    vendors: { analytics: ['ga4', 'clarity'], marketing: ['meta'], ungated: [] },
    recordings: true,
    initial: { analytics: false, marketing: false, external_media: false },
    consentId: null,
    decidedAt: null,
    cookiePolicyHref: '/om-cookies',
    privacyHref: '/legal/privacy',
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}

function wrap(ui: React.ReactNode, messages: Record<string, unknown> = en, locale = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Stockholm">
      {ui}
    </NextIntlClientProvider>
  );
}

const switchFor = (name: string) => screen.getByRole('switch', { name });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = '';
});

describe('CookieSettingsDialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(wrap(<CookieSettingsDialog {...baseProps({ open: false })} />));
    expect(container.innerHTML).toBe('');
  });

  it('is a labelled modal dialog with focus on its title and body scroll locked', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    const dialog = screen.getByRole('dialog', { name: 'Cookie settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Cookie settings' }));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('starts with every switch off when there is no decision (no pre-ticked boxes)', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    const switches = screen.getAllByRole('switch');
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
  });

  it('reflects `initial` when re-opened, and resets an unsaved edit on the next open', () => {
    const props = baseProps({ initial: { analytics: true, marketing: false, external_media: true } });
    const { rerender } = render(wrap(<CookieSettingsDialog {...props} />));
    expect(switchFor('Analytics')).toHaveAttribute('aria-checked', 'true');
    expect(switchFor('Marketing')).toHaveAttribute('aria-checked', 'false');
    expect(switchFor('External media')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(switchFor('Marketing'));
    expect(switchFor('Marketing')).toHaveAttribute('aria-checked', 'true');
    rerender(wrap(<CookieSettingsDialog {...props} open={false} />));
    rerender(wrap(<CookieSettingsDialog {...props} />));
    expect(switchFor('Marketing')).toHaveAttribute('aria-checked', 'false');
  });

  it('the necessary row has an "Always active" badge and no switch', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    expect(screen.getByText('Necessary')).toBeInTheDocument();
    // The badge is decorative for screen readers; the state is part of the heading.
    expect(screen.getByTestId('consent-always-on')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'Necessary, Always active' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Necessary' })).toBeNull();
  });

  it('names Google under Marketing when GA4 is gated (marketing grants it the ad signals)', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    const marketing = screen.getByTestId('consent-switch-marketing-vendors').textContent ?? '';
    expect(marketing).toContain(VENDOR_LABELS.meta);
    expect(marketing).toContain(VENDOR_LABELS.google_ads);
  });

  it('does not name Google under Marketing without a gated GA4', () => {
    render(
      wrap(<CookieSettingsDialog {...baseProps({ vendors: { analytics: ['clarity'], marketing: ['meta'], ungated: [] } })} />),
    );
    expect(screen.getByTestId('consent-switch-marketing-vendors').textContent).not.toContain(VENDOR_LABELS.google_ads);
  });

  it('labels the external media providers as possible ones', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />, sv, 'sv'));
    expect(screen.getByTestId('consent-switch-external_media-vendors').textContent).toMatch(/^Kan omfatta:/);
    expect(screen.getByTestId('consent-switch-analytics-vendors').textContent).toMatch(/^Tjänster:/);
  });

  it('keeps the focus trap after a backdrop click moved focus to <body>', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    const close = screen.getByRole('button', { name: 'Close' });
    const reject = screen.getByRole('button', { name: 'Reject all' });
    fireEvent.mouseDown(screen.getByTestId('consent-dialog-backdrop'));
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(reject);
  });

  it('shows only offered categories, and only configured vendors (external media lists all three)', () => {
    render(
      wrap(
        <CookieSettingsDialog
          {...baseProps({ offered: { analytics: true, marketing: false }, vendors: { analytics: ['clarity'], marketing: [], ungated: [] } })}
        />,
      ),
    );
    expect(screen.queryByRole('switch', { name: 'Marketing' })).toBeNull();
    const analyticsVendors = screen.getByTestId('consent-switch-analytics-vendors').textContent ?? '';
    expect(analyticsVendors).toContain(VENDOR_LABELS.clarity);
    expect(analyticsVendors).not.toContain(VENDOR_LABELS.ga4);
    const mediaVendors = screen.getByTestId('consent-switch-external_media-vendors').textContent ?? '';
    for (const v of ['youtube', 'vimeo', 'google_maps'] as const) expect(mediaVendors).toContain(VENDOR_LABELS[v]);
    expect(screen.getByText(en.consent.analyticsRecordings)).toBeInTheDocument();
  });

  it('a store without gated trackers shows only Necessary + External media', () => {
    render(
      wrap(
        <CookieSettingsDialog
          {...baseProps({ offered: { analytics: false, marketing: false }, vendors: { analytics: [], marketing: [], ungated: [] } })}
        />,
      ),
    );
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(switchFor('External media')).toBeInTheDocument();
  });

  it('lists services that run without consent (consent_required = false)', () => {
    render(
      wrap(
        <CookieSettingsDialog
          {...baseProps({
            offered: { analytics: true, marketing: false },
            vendors: { analytics: ['clarity'], marketing: [], ungated: ['ga4', 'meta'] },
          })}
        />,
      ),
    );
    const note = screen.getByTestId('consent-ungated').textContent ?? '';
    expect(note).toContain(VENDOR_LABELS.ga4);
    expect(note).toContain(VENDOR_LABELS.meta);
    expect(screen.queryByTestId('consent-ungated')).toBeInTheDocument();
  });

  it('has no ungated note when every vendor is gated', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    expect(screen.queryByTestId('consent-ungated')).toBeNull();
  });

  it('buttons: Save, Accept all, Reject all in DOM order with one identical style', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />, sv, 'sv'));
    const actions = Array.from(document.querySelectorAll('[data-consent-action]'));
    expect(actions.map((b) => b.textContent)).toEqual(['Spara val', 'Acceptera alla', 'Avböj alla']);
    expect(new Set(actions.map((b) => b.className)).size).toBe(1);
    expect(new Set(actions.map((b) => b.getAttribute('style'))).size).toBe(1);
  });

  it('Save sends the toggled choice; Accept all grants offered + external; Reject all denies all', async () => {
    const onSave = vi.fn();
    const { rerender } = render(wrap(<CookieSettingsDialog {...baseProps({ onSave, offered: { analytics: true, marketing: false } })} />));
    fireEvent.click(switchFor('Analytics'));
    fireEvent.click(screen.getByRole('button', { name: 'Save choices' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({ analytics: true, marketing: false, external_media: false }, 'save', 'b'.repeat(64)),
    );
    rerender(wrap(<CookieSettingsDialog {...baseProps({ onSave, offered: { analytics: true, marketing: false } })} />));
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({ analytics: true, marketing: false, external_media: true }, 'accept_all', 'b'.repeat(64)),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({ analytics: false, marketing: false, external_media: false }, 'reject_all', 'b'.repeat(64)),
    );
  });

  it('ESC and the close button close without saving and return focus to the opener', () => {
    function Harness({ onSave }: { onSave: CookieSettingsDialogProps['onSave'] }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          <CookieSettingsDialog {...baseProps({ open, onSave, onClose: () => setOpen(false) })} />
        </>
      );
    }
    const onSave = vi.fn();
    render(wrap(<Harness onSave={onSave} />));
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('traps focus: Tab from the last control wraps to the first, Shift+Tab from the first to the last', () => {
    render(wrap(<CookieSettingsDialog {...baseProps()} />));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const reject = screen.getByRole('button', { name: 'Reject all' });
    reject.focus();
    fireEvent.keyDown(reject, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(reject);
    // From the initially focused title, Shift+Tab also stays inside.
    screen.getByRole('heading', { name: 'Cookie settings' }).focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(reject);
  });

  it('shows the short consent id with a copy button that copies the full id, and the last-changed date', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(wrap(<CookieSettingsDialog {...baseProps({ consentId: ID, decidedAt: Date.UTC(2026, 10, 14, 9, 0) })} />));
    expect(screen.getByTestId('consent-id').textContent).toContain('Your consent ID: 5f0c2a9e…');
    expect(screen.getByTestId('consent-id').textContent).not.toContain(ID);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ID));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByTestId('consent-updated').textContent).toMatch(/^Last changed: November 14, 2026/);
  });

  it('hides the id and date without a decision; the cookie link only with an href', () => {
    render(wrap(<CookieSettingsDialog {...baseProps({ cookiePolicyHref: null })} />));
    expect(screen.queryByTestId('consent-id')).toBeNull();
    expect(screen.queryByTestId('consent-updated')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Cookie policy' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/legal/privacy');
  });

  it('the id, the date and the switches are not part of the hashed text', () => {
    render(wrap(<CookieSettingsDialog {...baseProps({ consentId: ID, decidedAt: Date.now() })} />));
    const marked = Array.from(screen.getByRole('dialog').querySelectorAll('[data-consent-text]'));
    expect(marked.some((el) => el.textContent?.includes('5f0c2a9e'))).toBe(false);
    expect(marked.some((el) => el.textContent?.startsWith('Last changed'))).toBe(false);
    expect(marked.some((el) => el.getAttribute('role') === 'switch')).toBe(false);
    expect(marked.map((el) => el.textContent)).toContain(en.consent.dialogIntro);
  });
});
