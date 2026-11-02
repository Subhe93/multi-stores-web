'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { clearPreviewCookie } from './StorePreviewUnlock';

/**
 * Small fixed strip shown to the owner while the storefront is rendered
 * from the preview endpoint (store not LIVE yet). "Exit" drops the preview
 * cookie and reloads into the public gate page.
 */
export function StorePreviewBar() {
  const t = useTranslations('store');
  const exit = () => {
    clearPreviewCookie();
    window.location.reload();
  };
  return (
    <div
      role="status"
      className="fixed bottom-0 start-0 end-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900/95 shadow-lg"
    >
      <Eye className="w-4 h-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span>{t('previewBar')}</span>
      <button
        type="button"
        onClick={exit}
        className="ms-2 rounded-md border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10 transition-colors"
      >
        {t('previewBarExit')}
      </button>
    </div>
  );
}
