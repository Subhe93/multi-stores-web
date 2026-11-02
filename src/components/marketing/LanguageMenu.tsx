'use client';

import { useEffect, useRef, useState } from 'react';
import { locales, defaultLocale } from '@/i18n/config';
import { localePath } from '@/lib/locale-path';

// Native names so every visitor can find their own language.
const NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};

interface Props {
  locale: string;
  label: string;
  /** `drawer` renders a flat list for the mobile menu; `menu` a dropdown. */
  variant?: 'menu' | 'drawer';
}

/**
 * Marketing-site language switcher. The current page path is read from the
 * browser after mount (the header is shared by the landing, company and legal
 * pages and the server does not know the pathname), so the links keep the
 * visitor on the same page in the chosen language. Before mount they point
 * at the localised home page, which is still a valid target.
 */
export function LanguageMenu({ locale, label, variant = 'menu' }: Props) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('/');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const browserPath = window.location.pathname;
    const prefix = locales.find((l) => browserPath === `/${l}` || browserPath.startsWith(`/${l}/`));
    setPath((prefix ? browserPath.slice(`/${prefix}`.length) : browserPath) || '/');
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = (locales as readonly string[]).includes(locale) ? locale : defaultLocale;
  const hrefFor = (l: string) => localePath(path, l);

  if (variant === 'drawer') {
    return (
      <div className="sd-lang-drawer" aria-label={label}>
        {locales.map((l) => (
          <a key={l} href={hrefFor(l)} hrefLang={l} lang={l} aria-current={l === current ? 'true' : undefined} className={l === current ? 'is-active' : ''}>
            {NAMES[l] || l.toUpperCase()}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="sd-lang">
      <button
        type="button"
        className="sd-link sd-header-link sd-lang-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span dir="ltr">{current.toUpperCase()}</span>
      </button>
      {open && (
        <ul className="sd-lang-menu" role="menu">
          {locales.map((l) => (
            <li key={l} role="none">
              <a role="menuitem" href={hrefFor(l)} hrefLang={l} lang={l} aria-current={l === current ? 'true' : undefined} className={l === current ? 'is-active' : ''}>
                {NAMES[l] || l.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
