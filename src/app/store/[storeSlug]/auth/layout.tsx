import type { Metadata } from 'next';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { getRequestMarket } from '@/lib/market.server';
import { isSvgSrc } from '@/lib/storeMedia';
import { StoreImage } from '@/components/StoreImage';
import { resolveAuthBackground, type AuthBackground, type AuthImagePosition } from './authBackground';

const POSITION_CLASS: Record<AuthImagePosition, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
};

// Same call (and fetch cache entry) as the store layout, so no extra request.
async function loadAuthBackground(storeSlug: string): Promise<AuthBackground | null> {
  try {
    const store = (await storefront.getStore(storeSlug, await getRequestMarket())) as {
      theme?: { auth?: unknown };
    };
    return resolveAuthBackground(store?.theme?.auth);
  } catch {
    return null;
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
  const bg = await loadAuthBackground(storeSlug);

  // No settings: the original look, unchanged.
  if (!bg) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    );
  }

  const src = bg.image ? resolveMediaUrl(bg.image) : '';

  return (
    <div
      className="relative isolate overflow-hidden"
      style={bg.color ? { backgroundColor: bg.color } : undefined}
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
        <div className="w-full max-w-xl *:shadow-xl *:border-transparent sm:*:p-10">{children}</div>
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
