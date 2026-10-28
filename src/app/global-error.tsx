'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Inter } from 'next/font/google';
import { defaultLocale, isRtl, locales, type Locale } from '@/i18n/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// global-error replaces the root layout, so no next-intl provider exists
// here. The three strings mirror `errors.errorTitle` / `errorDescription` /
// `retry` in src/i18n/messages and are picked by the document's `lang`.
const MESSAGES: Record<Locale, { title: string; description: string; retry: string }> = {
  en: { title: 'Something went wrong', description: 'An unexpected error occurred. Please try again.', retry: 'Try again' },
  ar: { title: 'حدث خطأ ما', description: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.', retry: 'حاول مرة أخرى' },
  tr: { title: 'Bir şeyler ters gitti', description: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.', retry: 'Tekrar dene' },
  de: { title: 'Etwas ist schiefgelaufen', description: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', retry: 'Erneut versuchen' },
  fr: { title: 'Une erreur est survenue', description: "Une erreur inattendue s'est produite. Veuillez réessayer.", retry: 'Réessayer' },
  sv: { title: 'Något gick fel', description: 'Ett oväntat fel inträffade. Försök igen.', retry: 'Försök igen' },
};

function resolveLocale(): Locale {
  const lang = document.documentElement.lang.toLowerCase().split('-')[0];
  return (locales as readonly string[]).includes(lang) ? (lang as Locale) : defaultLocale;
}

// The document language never changes while this boundary is shown, so
// there is nothing to subscribe to; the server snapshot keeps SSR and
// hydration markup identical (default locale).
const subscribeNoop = () => () => {};

// Root error boundary (Next App Router): must render its own <html>/<body>
// because the root layout is out of the tree when this shows.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const locale = useSyncExternalStore(subscribeNoop, resolveLocale, () => defaultLocale);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const m = MESSAGES[locale];
  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-3">{m.title}</h1>
          <p className="text-gray-600 max-w-md mb-8">{m.description}</p>
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {m.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
