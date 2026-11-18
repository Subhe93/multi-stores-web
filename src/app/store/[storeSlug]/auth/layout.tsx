import type { Metadata } from 'next';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { getRequestMarket } from '@/lib/market.server';
import { isSvgSrc } from '@/lib/storeMedia';
import { StoreImage } from '@/components/StoreImage';
import { resolveAuthBackground, type AuthBackground, type AuthImagePosition } from './authBackground';
import { FlowMotionProvider } from '@/components/cart/FlowMotion';
import { storeMotionOf } from '@/themes/creative/creativeAttrs';
import { surface } from '@/themes/creative/recipes';

const POSITION_CLASS: Record<AuthImagePosition, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
};

// Same call (and fetch cache entry) as the store layout, so no extra request.
// `motion`: the store switched its motion style on (flow scope, fast timing).
async function loadAuthBackground(storeSlug: string): Promise<{ bg: AuthBackground | null; motion: boolean }> {
  try {
    const store = (await storefront.getStore(storeSlug, await getRequestMarket())) as {
      theme?: { auth?: unknown };
    };
    return { bg: resolveAuthBackground(store?.theme?.auth), motion: storeMotionOf(store) };
  } catch {
    return { bg: null, motion: false };
  }
}

export default async function StoreAuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { bg, motion } = await loadAuthBackground(storeSlug);
  const m = motion ? ('scroll' as const) : undefined;
  const content = m ? <FlowMotionProvider>{children}</FlowMotionProvider> : children;

  // Every wrapper carries data-clarity-mask: sign-in forms are masked in
  // Clarity recordings when Clarity was loaded on an earlier page and the
  // visitor navigated here client-side (it is not loaded on auth routes).
  // No settings: the original look, unchanged.
  if (!bg) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16" data-clarity-mask="True" {...surface(m, 'auth', true)}>
        <div className="w-full max-w-md">{content}</div>
      </div>
    );
  }

  const src = bg.image ? resolveMediaUrl(bg.image) : '';

  return (
    <div
      className="relative isolate overflow-hidden"
      data-clarity-mask="True"
      style={bg.color ? { backgroundColor: bg.color } : undefined}
      {...surface(m, 'auth', true)}
    >
      {/* Decorative: absolutely positioned (no CLS), never the LCP element. */}
      {src && (
        <StoreImage
          src={src}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="low"
          unoptimized={isSvgSrc(src)}
          className={`-z-10 object-cover ${POSITION_CLASS[bg.position]}`}
        />
      )}
      {src && bg.overlay > 0 && (
        <div aria-hidden className="absolute inset-0 -z-10 bg-black" style={{ opacity: bg.overlay }} />
      )}
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 sm:py-20">
        {/* Wider card with a stronger shadow over the background. */}
        <div className="w-full max-w-xl *:shadow-xl *:border-transparent sm:*:p-10">{content}</div>
      </div>
    </div>
  );
}

// Transactional / private surface — never indexable. robots.txt already
// disallows these paths; the meta tag covers URLs a crawler reaches anyway
// (e.g. from an external link), which robots.txt alone cannot suppress.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
