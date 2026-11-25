'use client';

// Write / edit a product review (M171). Two ways in:
//  - a review link (`/reviews/write#token=…`): no login. The token is read
//    from the URL fragment once, removed from the address bar at once and
//    kept in memory only (never in storage or a cookie); it is only ever
//    sent in a JSON body;
//  - the signed-in customer (`/reviews/write?product=<id>`): a verified
//    buyer of that product in this store.
// Server errors are shown by code (translated), never as raw text.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, LinkIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocalePath } from '@/hooks/useLocalePath';
import { resolveMediaUrl, type ApiError } from '@/lib/api';
import { readUrlToken, stripTokenFromUrl } from '@/lib/urlToken';
import { CUSTOMER_CAPTCHA_ON, CustomerCaptcha } from '@/components/auth/CustomerCaptcha';
import {
  reviewErrorField,
  reviewFatalState,
  reviewLocale,
  validateReviewForm,
  type ReviewFormValues,
} from '@/lib/reviews';
import { reviewsApi, type OwnReview, type ReviewFields, type ReviewLinkContext, type ReviewStatus } from '@/lib/reviewsApi';
import { ReviewForm, type ReviewFieldErrors } from './ReviewForm';

const LINK_COLOR = 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))';

type Phase =
  | 'loading'
  | 'sign_in'
  | 'not_purchased'
  | 'form'
  | 'done'
  | 'deleted'
  | 'link_invalid'
  | 'not_eligible'
  | 'unavailable';

const EMPTY: ReviewFormValues = { rating: 0, title: '', body: '', display_name: '' };

function prefill(review: OwnReview | null, suggestion: string): ReviewFormValues {
  if (!review) return { ...EMPTY, display_name: suggestion || '' };
  return {
    rating: review.rating,
    title: review.title ?? '',
    body: review.body,
    display_name: review.display_name,
  };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 lg:py-14" data-review-write="">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}

function Message({
  icon,
  title,
  text,
  children,
  state,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  children?: React.ReactNode;
  state: string;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 text-center" data-review-state={state}>
        {icon}
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {text && <p className="max-w-md text-sm text-gray-500">{text}</p>}
        {children}
      </div>
    </Card>
  );
}

export function ReviewWriteClient({
  storeSlug,
  productId,
}: {
  storeSlug: string;
  /** `?product=<id>` of the signed-in path; ignored when the URL has a token. */
  productId?: string | null;
}) {
  const t = useTranslations('reviews');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const lp = useLocalePath();
  const { token: session, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  // undefined = the URL has not been read yet; null = no review link.
  const [linkToken, setLinkToken] = useState<string | null | undefined>(undefined);
  const [context, setContext] = useState<ReviewLinkContext | null>(null);
  const [existing, setExisting] = useState<OwnReview | null>(null);
  const [values, setValues] = useState<ReviewFormValues>(EMPTY);
  const [errors, setErrors] = useState<ReviewFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [result, setResult] = useState<ReviewStatus>('PENDING');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const read = useRef(false);

  /** A coded error as text; unknown codes get the generic message. */
  const errorText = useCallback(
    (err: unknown) => {
      const code = (err as ApiError | null)?.code;
      return code && tErrors.has(code) ? tErrors(code) : tErrors('generic');
    },
    [tErrors],
  );

  // 1. The review link token: read once, removed from the address bar in
  //    the same effect, kept in component state only.
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const value = readUrlToken();
    stripTokenFromUrl();
    // Reading window state has to wait for the client (never during render).
    setLinkToken(value || null);
  }, []);

  // 2a. Review link: what the form shows.
  useEffect(() => {
    if (!linkToken) return;
    let cancelled = false;
    reviewsApi
      .linkContext(storeSlug, linkToken)
      .then((ctx) => {
        if (cancelled) return;
        setContext(ctx);
        setExisting(ctx.review);
        setValues(prefill(ctx.review, ctx.display_name_suggestion));
        setPhase('form');
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        // Every failure of a link ends on a friendly page; an unknown one
        // reads as "this link does not work".
        setPhase(reviewFatalState(err?.code) ?? 'link_invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [linkToken, storeSlug]);

  // 2b. Signed-in customer: may I review this product?
  useEffect(() => {
    if (linkToken !== null || authLoading) return;
    let cancelled = false;
    // Deferred so no state is set synchronously inside the effect.
    const settle = (next: Phase) => {
      queueMicrotask(() => {
        if (!cancelled) setPhase(next);
      });
    };
    if (!productId) {
      settle('link_invalid');
    } else if (!session) {
      settle('sign_in');
    } else {
      reviewsApi
        .eligibility(storeSlug, productId, session)
        .then((res) => {
          if (cancelled) return;
          if (!res.eligible) {
            setPhase('not_purchased');
            return;
          }
          setExisting(res.review);
          setValues(prefill(res.review, res.display_name_suggestion));
          setPhase('form');
        })
        .catch((err: ApiError) => {
          if (cancelled) return;
          if (err?.status === 401) setPhase('sign_in');
          else if (err?.code === 'REVIEW_NOT_PURCHASED') setPhase('not_purchased');
          else setPhase(reviewFatalState(err?.code) ?? 'unavailable');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [linkToken, authLoading, session, productId, storeSlug]);

  const change = (patch: Partial<ReviewFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    // A corrected field loses its message.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as keyof ReviewFieldErrors];
      return next;
    });
  };

  const submit = async () => {
    const found = validateReviewForm(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('');
      return;
    }
    const viaLink = Boolean(linkToken);
    if (viaLink && CUSTOMER_CAPTCHA_ON && !captchaToken) {
      setFormError(tErrors.has('AUTH_CAPTCHA_FAILED') ? tErrors('AUTH_CAPTCHA_FAILED') : tErrors('generic'));
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError('');
    const title = values.title.trim();
    const fields: ReviewFields = {
      rating: values.rating,
      ...(title ? { title } : {}),
      body: values.body,
      display_name: values.display_name.trim(),
      locale: reviewLocale(locale),
      ...(honeypot ? { website: honeypot } : {}),
    };
    try {
      const res = viaLink
        ? await reviewsApi.submitLink(storeSlug, {
            ...fields,
            ...(captchaToken ? { turnstile_token: captchaToken } : {}),
            token: linkToken as string,
          })
        : await reviewsApi.submitMine(storeSlug, { ...fields, product_id: productId as string }, session as string);
      setResult(res.status === 'APPROVED' ? 'APPROVED' : 'PENDING');
      setPhase('done');
    } catch (err) {
      const e = err as ApiError;
      // A captcha token is single-use.
      if (viaLink && CUSTOMER_CAPTCHA_ON) {
        setCaptchaToken(null);
        setCaptchaReset((n) => n + 1);
      }
      const fatal = reviewFatalState(e?.code);
      const field = reviewErrorField(e?.code);
      if (fatal) setPhase(fatal);
      else if (!viaLink && e?.status === 401) setPhase('sign_in');
      else if (e?.code === 'REVIEW_NOT_PURCHASED') setPhase('not_purchased');
      else if (field && e.code) setErrors({ [field]: e.code });
      else setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing?.id || !session) return;
    setBusy(true);
    setFormError('');
    try {
      await reviewsApi.deleteMine(storeSlug, existing.id, session);
      setPhase('deleted');
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  // Product of a review link, in the page language when translated.
  const productRow =
    context?.product.translations.find((r) => r.locale === locale) ?? context?.product.translations[0] ?? null;
  const productHref = productRow?.slug ? lp(`/products/${encodeURIComponent(productRow.slug)}`) : null;
  const back = (
    <Link
      href={productHref ?? lp('/')}
      className="text-sm font-medium underline underline-offset-2 hover:opacity-80"
      style={{ color: LINK_COLOR }}
    >
      {productHref ? t('form.backToProduct') : t('form.backToStore')}
    </Link>
  );

  if (phase === 'loading') {
    return (
      <Card>
        <div className="flex justify-center py-10" role="status" data-review-state="loading">
          <Loader2 className="size-6 animate-spin text-gray-400" aria-hidden="true" />
          <span className="sr-only">{t('form.loading')}</span>
        </div>
      </Card>
    );
  }

  if (phase === 'link_invalid') {
    return (
      <Message state="link_invalid" icon={<LinkIcon className="size-8 text-gray-400" aria-hidden="true" />} title={t('form.linkInvalidTitle')} text={t('form.linkInvalidText')}>
        {back}
      </Message>
    );
  }
  if (phase === 'not_eligible') {
    return (
      <Message state="not_eligible" title={t('form.notEligibleTitle')} text={t('form.notEligibleText')}>
        {back}
      </Message>
    );
  }
  if (phase === 'unavailable') {
    return (
      <Message state="unavailable" title={t('form.unavailableTitle')} text={t('form.unavailableText')}>
        {back}
      </Message>
    );
  }
  if (phase === 'sign_in') {
    return (
      <Message state="sign_in" title={t('form.title')} text={t('form.signInRequired')}>
        <Link
          href={lp('/auth/login')}
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--store-primary, #111)', color: 'var(--store-primary-contrast, #fff)' }}
        >
          {t('form.signIn')}
        </Link>
      </Message>
    );
  }
  if (phase === 'not_purchased') {
    return (
      <Message state="not_purchased" title={t('form.title')} text={t('form.notPurchased')}>
        {back}
      </Message>
    );
  }
  if (phase === 'deleted') {
    return (
      <Message state="deleted" icon={<CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />} title={t('form.deletedTitle')}>
        {back}
      </Message>
    );
  }
  if (phase === 'done') {
    const published = result === 'APPROVED';
    return (
      <Message
        state={published ? 'done_published' : 'done_pending'}
        icon={<CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />}
        title={published ? t('form.successPublishedTitle') : t('form.successPendingTitle')}
        text={published ? t('form.successPublishedText') : t('form.successPendingText')}
      >
        {back}
      </Message>
    );
  }

  const image = context?.product.image_url ? resolveMediaUrl(context.product.image_url) : '';
  return (
    <Card>
      <h1 className="text-2xl font-bold text-gray-900">{existing ? t('edit') : t('form.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('form.intro')}</p>
      {productRow?.title && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-gray-100 p-3" data-review-product="">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- small fixed thumbnail
            <img src={image} alt="" width={48} height={48} loading="lazy" className="size-12 rounded-lg border border-gray-100 object-cover" />
          )}
          <p className="min-w-0 truncate text-sm font-medium text-gray-900">{productRow.title}</p>
        </div>
      )}
      <div className="mt-6">
        <ReviewForm
          values={values}
          errors={errors}
          formError={formError}
          busy={busy}
          onChange={change}
          onSubmit={submit}
          honeypot={honeypot}
          onHoneypot={setHoneypot}
          notice={existing ? t('form.editingNotice') : undefined}
          captcha={linkToken ? <CustomerCaptcha onToken={setCaptchaToken} resetSignal={captchaReset} /> : undefined}
        />
      </div>

      {/* The signed-in customer may remove their own review (a link-only
          buyer asks the store). */}
      {existing?.id && session && !linkToken && (
        <div className="mt-8 border-t border-gray-100 pt-5 text-sm" data-review-delete="">
          {!confirmDelete ? (
            <button type="button" className="min-h-11 text-red-600 underline underline-offset-2 hover:opacity-80" onClick={() => setConfirmDelete(true)}>
              {t('form.delete')}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-700">{t('form.deleteConfirm')}</span>
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {t('form.delete')}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-4 text-gray-700">
                {t('form.cancel')}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
