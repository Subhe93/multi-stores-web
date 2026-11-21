'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { lockScroll } from '@/lib/scrollLock';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour for the region picker (same logic as FilterSheet):
 * page scroll lock, first focus on `[data-autofocus]` inside the panel,
 * Tab / Shift+Tab trapped inside it, Esc closes, and focus returns to the
 * element that opened it.
 */
export function useModalDialog(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLElement | null>,
): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = (returnFocusRef?.current ?? document.activeElement) as HTMLElement | null;
    const unlock = lockScroll();
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => !n.closest('[hidden],[inert]') && !(n instanceof HTMLInputElement && n.type === 'radio' && !n.checked && groupHasChecked(panel, n)),
      );
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef, returnFocusRef]);
}

// A radio group is one Tab stop: only its checked radio is focusable by Tab.
function groupHasChecked(panel: HTMLElement, radio: HTMLInputElement): boolean {
  if (!radio.name || !/^[\w-]+$/.test(radio.name)) return false;
  return Boolean(panel.querySelector(`input[type="radio"][name="${radio.name}"]:checked`));
}
