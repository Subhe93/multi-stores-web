'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, LinkIcon, CheckCircle2 } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth, isNotCustomerAccountError, type AuthTokensPayload } from '@/hooks/useAuth';
import { api } from '@/lib/api';

type Status = 'loading' | 'success' | 'invalid' | 'notCustomer';

/** Token from the URL fragment (`#token=`, current emails: never sent to the
 *  server, so it stays out of access logs) or the query string (`?token=`,
 *  links mailed before the switch). */
function readToken(): string | null {
  try {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    return fromHash || new URLSearchParams(window.location.search).get('token');
  } catch {
    return null;
  }
}

/** Remove `token` from the address bar (query and fragment) so it does not
 *  linger in history, bookmarks or a shared screenshot. Other params stay. */
function stripTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const inHash = hash.has('token');
    if (!url.searchParams.has('token') && !inHash) return;
    url.searchParams.delete('token');
    hash.delete('token');
    const rest = hash.toString();
    const fragment = inHash ? (rest ? `#${rest}` : '') : url.hash;
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${fragment}`);
  } catch { /* non-fatal: the token is single-use anyway */ }
}

const LINK_COLOR = 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))';

/**
 * One-click login from an emailed magic link (`/auth/magic#token=…`, or `?token=…` in older emails).
 * The token is single-use, so it is exchanged exactly once per mount even
 * when React runs the effect twice (strict mode).
 */
export function MagicLogin({ variant }: { variant: 'store' | 'platform' }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const lp = useLocalePath();
  const { loginWithTokens } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = readToken();
    stripTokenFromUrl();

    (async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }
      try {
        const data = await api<AuthTokensPayload>('/auth/magic-login', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        await loginWithTokens(data);
        setStatus('success');
        // The platform has no account area; customers land on its home page.
        router.replace(variant === 'store' ? lp('/account') : '/');
      } catch (err) {
        setStatus(isNotCustomerAccountError(err) ? 'notCustomer' : 'invalid');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isStore = variant === 'store';
  const card = isStore
    ? 'bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center'
    : 'bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center';
  const title = isStore ? 'text-2xl font-semibold text-gray-900 mb-2' : 'text-2xl font-semibold text-slate-800 mb-2';
  const muted = isStore ? 'text-sm text-gray-500' : 'text-sm text-slate-500';

  if (status === 'loading' || status === 'success') {
    return (
      <div className={card} aria-live="polite" aria-busy={status === 'loading'}>
        <div className="mx-auto mb-5 flex size-12 items-center justify-center">
          {status === 'loading' ? (
            <Loader2
              className={`size-8 animate-spin ${isStore ? '' : 'text-slate-700'}`}
              style={isStore ? { color: 'var(--store-primary, #2563eb)' } : undefined}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className={`size-8 ${isStore ? '' : 'text-green-600'}`}
              style={isStore ? { color: 'var(--store-primary, #16a34a)' } : undefined}
              aria-hidden="true"
            />
          )}
        </div>
        <h1 className={title}>{t('magicTitle')}</h1>
        <p className={muted}>{status === 'loading' ? t('magicLoading') : t('magicSuccess')}</p>
      </div>
    );
  }

  const primaryBtn = isStore
    ? 'block w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90'
    : 'block w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition';

  return (
    <div className={card} role="alert">
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-amber-50">
        <LinkIcon className="size-6 text-amber-600" aria-hidden="true" />
      </div>
      <h1 className={title}>{t('magicInvalidTitle')}</h1>
      <p className={`${muted} mb-2`}>
        {status === 'notCustomer' ? t('dashboardAccountNotAllowed') : t('magicInvalid')}
      </p>
      {status === 'invalid' && <p className={`${muted} mb-8`}>{t('magicInvalidHint')}</p>}
      {status === 'notCustomer' && <div className="mb-8" />}

      <Link
        href={lp('/auth/login')}
        className={primaryBtn}
        style={isStore ? { backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' } : undefined}
      >
        {t('magicLogin')}
      </Link>
      <Link
        href={lp('/auth/forgot-password')}
        className={`mt-4 inline-block text-sm font-medium underline underline-offset-2 hover:opacity-80 ${isStore ? '' : 'text-slate-800'}`}
        style={isStore ? { color: LINK_COLOR } : undefined}
      >
        {t('magicForgot')}
      </Link>
    </div>
  );
}
