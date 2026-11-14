'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { MEDIA_VENDORS, VENDOR_LABELS, marketingVendorKeys, type TrackerVendor, type VendorKey } from '@/lib/consent';
import { consentTextHash } from '@/lib/consentLog';
import { CONSENT_BUTTON_CLASS, CONSENT_BUTTON_STYLE } from './CookieBanner';

// Second layer of the cookie consent (plans/consent-v2/CONTRACT.md §4.3):
// one switch per category with its description and the vendors the store
// actually configured. Modal: backdrop, focus trap (only here), initial
// focus on the title, ESC / close button close WITHOUT saving, focus goes
// back to the opener, body scroll locked. Switches never start on: with no
// prior decision `initial` is all false; re-opened, they show the current
// choices. Purely presentational: the manager saves through `onSave`.

export type ConsentDialogChoice = { analytics: boolean; marketing: boolean; external_media: boolean };
export type ConsentDialogAction = 'save' | 'accept_all' | 'reject_all';

export interface CookieSettingsDialogProps {
  open: boolean;
  /** Categories with configured vendors; external media is always offered. */
  offered: { analytics: boolean; marketing: boolean };
  vendors: { analytics: TrackerVendor[]; marketing: TrackerVendor[]; ungated: TrackerVendor[] };
  /** Microsoft Clarity configured: the analytics row explains recordings. */
  recordings: boolean;
  initial: ConsentDialogChoice;
  consentId: string | null;
  /** Unix ms of the last decision, when one exists. */
  decidedAt: number | null;
  cookiePolicyHref: string | null;
  privacyHref: string;
  onSave(choice: ConsentDialogChoice, action: ConsentDialogAction, textHash: string): void;
  onClose(): void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus trap: Tab / Shift+Tab wrap inside the panel, also when focus is outside it. */
function trapTab(e: KeyboardEvent, panel: HTMLElement | null, title: HTMLElement | null): void {
  if (!panel) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && panel.contains(active);
  if (e.shiftKey) {
    if (!inside || active === first || active === title) {
      e.preventDefault();
      last.focus();
    }
  } else if (!inside || active === last) {
    e.preventDefault();
    first.focus();
  }
}

export function CookieSettingsDialog(props: CookieSettingsDialogProps) {
  // Mounting the body only while open re-initialises the switches from
  // `initial` on every open (no state carried over from a cancelled edit).
  if (!props.open) return null;
  return <DialogBody {...props} />;
}

function DialogBody({
  offered,
  vendors,
  recordings,
  initial,
  consentId,
  decidedAt,
  cookiePolicyHref,
  privacyHref,
  onSave,
  onClose,
}: CookieSettingsDialogProps) {
  const t = useTranslations('consent');
  const locale = useLocale();
  const lp = useLocalePath();
  const titleId = useId();
  const introId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const [analytics, setAnalytics] = useState(offered.analytics && initial.analytics);
  const [marketing, setMarketing] = useState(offered.marketing && initial.marketing);
  const [external, setExternal] = useState(initial.external_media);
  const [copied, setCopied] = useState(false);

  // Open: remember the opener, focus the title, lock body scroll, ESC closes.
  // Close (unmount): restore scroll and return focus to the opener.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    // Document-level, so the trap also holds when focus left the panel (a
    // click on the non-focusable backdrop moves focus to <body>).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') trapTab(e, panelRef.current, titleRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const submit = async (choice: ConsentDialogChoice, action: ConsentDialogAction) => {
    if (busy.current) return;
    busy.current = true;
    let hash = 'unavailable';
    try {
      hash = await consentTextHash(panelRef.current);
    } catch {
      // Keep 'unavailable': the decision itself must never be blocked.
    }
    try {
      onSave(choice, action, hash);
    } finally {
      busy.current = false;
    }
  };

  const copyId = async () => {
    if (!consentId) return;
    try {
      await navigator.clipboard.writeText(consentId);
      setCopied(true);
    } catch {
      // Clipboard blocked: the id stays visible for manual copying.
    }
  };

  const dateLabel =
    decidedAt !== null
      ? (() => {
          try {
            return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(decidedAt));
          } catch {
            return new Date(decidedAt).toISOString().slice(0, 10);
          }
        })()
      : null;

  const linkClass = 'underline underline-offset-2 hover:opacity-80';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center md:p-4"
      data-testid="consent-dialog-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        data-testid="consent-dialog"
        className="store-surface store-bd flex w-full flex-col overflow-hidden border text-start shadow-2xl max-md:h-[100dvh] max-md:border-0 md:max-h-[85vh] md:max-w-lg md:rounded-xl"
      >
        <div className="store-bd flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} data-consent-text="" className="text-base font-semibold outline-none">
            {t('dialogTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="store-muted -m-1 rounded-md p-1 transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-colors-primary)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" style={{ overscrollBehavior: 'contain' }}>
          <p id={introId} data-consent-text="" className="store-muted text-sm leading-relaxed">
            {t('dialogIntro')}
          </p>

          <ul className="space-y-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <CategoryRow name={t('necessaryName')} description={t('necessaryDesc')} alwaysOnLabel={t('alwaysOn')} />
            {offered.analytics && (
              <CategoryRow
                name={t('analyticsName')}
                description={t('analyticsDesc')}
                extra={recordings ? t('analyticsRecordings') : undefined}
                servicesLabel={t('services')}
                vendors={vendors.analytics}
                checked={analytics}
                onToggle={() => setAnalytics((v) => !v)}
                testId="consent-switch-analytics"
              />
            )}
            {offered.marketing && (
              <CategoryRow
                name={t('marketingName')}
                description={t('marketingDesc')}
                servicesLabel={t('services')}
                vendors={marketingVendorKeys(vendors)}
                checked={marketing}
                onToggle={() => setMarketing((v) => !v)}
                testId="consent-switch-marketing"
              />
            )}
            <CategoryRow
              name={t('externalName')}
              description={t('externalDesc')}
              // The store cannot know which pages embed which provider, so
              // these are the possible ones ("May include:"), not a claim.
              servicesLabel={t('servicesPossible')}
              vendors={MEDIA_VENDORS}
              checked={external}
              onToggle={() => setExternal((v) => !v)}
              testId="consent-switch-external_media"
            />
          </ul>

          {vendors.ungated.length > 0 && (
            <p data-consent-text="" data-testid="consent-ungated" className="store-muted text-xs leading-relaxed">
              {t('dialogUngated', { services: vendors.ungated.map((v) => VENDOR_LABELS[v]).join(', ') })}
            </p>
          )}

          <div className="store-muted space-y-2 text-xs leading-relaxed">
            <p data-consent-text="">{t('dialogTransfer')}</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {cookiePolicyHref && (
                <Link href={lp(cookiePolicyHref)} className={linkClass} data-consent-text="">
                  {t('cookiePolicy')}
                </Link>
              )}
              <Link href={lp(privacyHref)} className={linkClass} data-consent-text="">
                {t('privacyPolicy')}
              </Link>
            </p>
            {consentId && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="consent-id">
                <span title={consentId}>{t('consentId', { id: `${consentId.slice(0, 8)}…` })}</span>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className="rounded border px-1.5 py-0.5 text-[11px] font-medium transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-colors-primary)]"
                  style={{ borderColor: 'var(--theme-colors-border)' }}
                >
                  {copied ? t('copied') : t('copyId')}
                </button>
                <span role="status" aria-live="polite" className="sr-only">
                  {copied ? t('copied') : ''}
                </span>
              </p>
            )}
            {dateLabel && <p data-testid="consent-updated">{t('updatedAt', { date: dateLabel })}</p>}
          </div>
        </div>

        {/* Sticky button row; DOM order: Save, Accept all, Reject all (§4.3). */}
        <div
          className="store-bd grid shrink-0 grid-cols-1 gap-2 border-t px-5 py-3 md:flex md:flex-wrap md:justify-end"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            data-consent-action="save"
            data-consent-text=""
            onClick={() => void submit({ analytics, marketing, external_media: external }, 'save')}
            className={CONSENT_BUTTON_CLASS}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('save')}
          </button>
          <button
            type="button"
            data-consent-action="accept_all"
            data-consent-text=""
            onClick={() =>
              void submit({ analytics: offered.analytics, marketing: offered.marketing, external_media: true }, 'accept_all')
            }
            className={CONSENT_BUTTON_CLASS}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('acceptAll')}
          </button>
          <button
            type="button"
            data-consent-action="reject_all"
            data-consent-text=""
            onClick={() => void submit({ analytics: false, marketing: false, external_media: false }, 'reject_all')}
            className={CONSENT_BUTTON_CLASS}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('rejectAll')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  name: string;
  description: string;
  /** Extra sentence under the description (Clarity recordings). */
  extra?: string;
  servicesLabel?: string;
  vendors?: readonly VendorKey[];
  /** Locked category (necessary): a badge instead of a switch. */
  alwaysOnLabel?: string;
  checked?: boolean;
  onToggle?(): void;
  testId?: string;
}

function CategoryRow({ name, description, extra, servicesLabel, vendors, alwaysOnLabel, checked = false, onToggle, testId }: CategoryRowProps) {
  const nameId = useId();
  const descId = useId();
  return (
    <li className="store-bd rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={nameId} data-consent-text="" className="text-sm font-semibold">
          {name}
          {/* The locked state belongs to the category name for screen readers
              (the visible badge below is decorative for them). */}
          {alwaysOnLabel && <span className="sr-only">{`, ${alwaysOnLabel}`}</span>}
        </h3>
        {alwaysOnLabel ? (
          <span
            aria-hidden="true"
            data-testid="consent-always-on"
            className="store-muted shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: 'var(--theme-colors-border)' }}
          >
            {alwaysOnLabel}
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={nameId}
            aria-describedby={descId}
            data-testid={testId}
            onClick={onToggle}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
            style={{
              backgroundColor: checked ? 'var(--theme-colors-primary)' : 'var(--theme-colors-border, #d1d5db)',
              borderColor: checked ? 'var(--theme-colors-primary)' : 'var(--theme-colors-border, #d1d5db)',
            }}
          >
            {/* Knob: logical margin so it slides the right way in RTL. */}
            <span
              aria-hidden="true"
              className={`block size-5 rounded-full bg-white shadow transition-[margin] ${checked ? 'ms-[1.3rem]' : 'ms-0.5'}`}
            />
          </button>
        )}
      </div>
      <div id={descId} className="store-muted mt-1.5 space-y-1 text-xs leading-relaxed">
        <p data-consent-text="">{description}</p>
        {extra && <p data-consent-text="">{extra}</p>}
        {servicesLabel && vendors && vendors.length > 0 && (
          <p data-consent-text="" data-testid={testId ? `${testId}-vendors` : undefined}>
            <span className="font-medium">{servicesLabel}</span> {vendors.map((v) => VENDOR_LABELS[v]).join(', ')}
          </p>
        )}
      </div>
    </li>
  );
}
