'use client';

// Overlays of the filtered listing: the desktop dropdown of one filter group
// (bar layout) and the phone bottom sheet with every group.
//
// Dropdown: a disclosure (button + panel), non-modal; Escape or a click
// outside closes it and focus returns to its button. Changes apply at once.
// Sheet: a modal dialog with a focus trap, scroll lock and Escape; the
// shopper edits a draft and applies it with the count on the button.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, X } from 'lucide-react';
import { lockScroll } from '@/lib/scrollLock';

export function FilterDropdown({
  label,
  count,
  open,
  onOpenChange,
  wide,
  footer,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest callback, so the listeners below are bound once per opening.
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChangeRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onOpenChangeRef.current(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // On opening the panel takes focus (Tab reaches its controls); no ring
    // on a field the shopper did not choose.
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lx-pop" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lx-pill"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        data-active={count > 0 || undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span>{label}</span>
        {count > 0 && <span className="lx-pill-badge">{count}</span>}
        <ChevronDown className="lx-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          ref={panelRef}
          tabIndex={-1}
          className="lx-pop-panel"
          data-wide={wide || undefined}
          role="group"
          aria-label={label}
        >
          {children}
          {footer && <div className="lx-pop-foot">{footer}</div>}
        </div>
      )}
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FilterSheet({
  open,
  onClose,
  title,
  onClear,
  clearDisabled,
  onApply,
  applyLabel,
  busy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onClear: () => void;
  clearDisabled: boolean;
  onApply: () => void;
  applyLabel: string;
  busy: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('listing');
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const nodes = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const firstNode = nodes[0]!;
      const lastNode = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
      opener.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="lx-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={sheetRef} className="lx-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="lx-sheet-grip" aria-hidden="true" />
        <div className="lx-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="lx-icon-btn" onClick={onClose} aria-label={t('close')} data-autofocus>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="lx-sheet-body">{children}</div>
        <div className="lx-sheet-foot">
          <button type="button" className="lx-btn lx-btn-ghost" onClick={onClear} disabled={clearDisabled}>
            {t('clear')}
          </button>
          <button
            type="button"
            className="lx-btn lx-btn-primary"
            onClick={onApply}
            aria-disabled={busy || undefined}
            aria-live="polite"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </>
  );
}
