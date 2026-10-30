'use client';

import { useEffect, useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Newline-separated help text (namez examples list). */
  text?: string;
  imageUrl?: string;
}

/**
 * Help dialog of a personalization field (namez A L301-372): the help text
 * (line breaks kept) and an optional image. Escape and the backdrop close it;
 * focus moves to the close button and back to the opener on close.
 */
export function HelpModal({ open, onClose, title, text, imageUrl }: HelpModalProps) {
  const t = useTranslations('personalization');
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {text && <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">{text}</p>}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(imageUrl)} alt="" className="mt-4 w-full rounded-lg border border-gray-100" />
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
