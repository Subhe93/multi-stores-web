'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, X } from 'lucide-react';
import {
  EDIT_HINT_DISMISSED_KEY,
  forgetEditHintToken,
  readEditHintToken,
} from './editHintStorage';

/** `GET /storefront/:slug/edit-target` response. */
interface EditTarget {
  edit_url: string | null;
  label_kind: 'product' | 'collection' | 'page' | 'dashboard' | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** Wait after a navigation before asking the API (rapid clicks coalesce). */
const DEBOUNCE_MS = 300;

/** Answers per public pathname for this page session. */
const targetCache = new Map<string, EditTarget>();

const LABEL_KEYS = {
  product: 'editHint.editProduct',
  collection: 'editHint.editCollection',
  page: 'editHint.editPage',
  dashboard: 'editHint.openDashboard',
} as const;

function isDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(EDIT_HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The owner's floating "Edit" button (lazy chunk, loaded only when an
 * edit-hint token is stored). Asks the API which dashboard page edits the
 * current storefront path — on mount and after every client-side
 * navigation — and shows a link to it. A 401 means the token is no longer
 * the owner's: it is forgotten and the button disappears for good.
 */
export function EditHintButton({ storeSlug }: { storeSlug: string }) {
  const t = useTranslations();
  // Re-run on client-side navigations; the public path itself is read from
  // window.location (the router path is the rewritten /store/<slug>/… one).
  const routerPath = usePathname();
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [hidden, setHidden] = useState(isDismissed);

  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const path = window.location.pathname;
      const cached = targetCache.get(path);
      if (cached) {
        setTarget(cached);
        return;
      }
      const token = readEditHintToken();
      if (!token) {
        setHidden(true);
        return;
      }
      setTarget(null);
      try {
        const res = await fetch(
          `${API_URL}/storefront/${encodeURIComponent(storeSlug)}/edit-target?path=${encodeURIComponent(path)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
          },
        );
        if (res.status === 401) {
          forgetEditHintToken();
          targetCache.clear();
          setHidden(true);
          return;
        }
        if (!res.ok) return;
        // The API wraps every response in `{ success, data }`.
        const next = ((await res.json()) as { data?: EditTarget }).data;
        if (!next) return;
        targetCache.set(path, next);
        setTarget(next);
      } catch {
        /* aborted or offline: show nothing for this path */
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [routerPath, storeSlug, hidden]);

  if (hidden || !target?.edit_url || !target.label_kind) return null;
  // Defence in depth: only ever link to an http(s) dashboard URL.
  if (!target.edit_url.startsWith('https://') && !target.edit_url.startsWith('http://')) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(EDIT_HINT_DISMISSED_KEY, '1');
    } catch {
      /* storage unavailable: hide for this page view only */
    }
    setHidden(true);
  };

  return (
    <div
      data-ms-edit-hint
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-e-3 md:bottom-14 md:inset-e-4 z-40 flex items-center gap-0.5 rounded-full bg-gray-900/90 text-white shadow-lg ps-3 pe-1 py-1 text-sm backdrop-blur print:hidden"
    >
      <a
        href={target.edit_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 py-1 font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-full"
      >
        <Pencil className="size-3.5 shrink-0" aria-hidden />
        {t(LABEL_KEYS[target.label_kind])}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('editHint.dismiss')}
        title={t('editHint.dismiss')}
        className="ms-1 rounded-full p-1.5 opacity-70 hover:opacity-100 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
