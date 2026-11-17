import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { storeTag } from '@/lib/api';

// On-demand cache invalidation. The API server calls this after any mutation
// that affects a storefront (publish, product/category/menu/store edits) so the
// cached storefront data refreshes within seconds instead of waiting for the
// time-based revalidate fallback.
//
// POST /api/revalidate
//   headers: x-revalidate-secret: <REVALIDATE_SECRET>
//   body:    { "slug": "my-store" }  — revalidates everything tagged store:<slug>
//            { "tag": "legal" }      — platform legal pages (or "legal:<slug>")

// Platform-wide tags the API may purge; anything else is rejected so the
// endpoint cannot be used to flush arbitrary cache entries.
const PLATFORM_TAG = /^legal(?::[a-z0-9-]{1,80})?$/;

// Expire the tagged entries at once. The "max" profile only marks them stale:
// the old body keeps being served while Next refetches in the background, and
// a refetch that fails (a deleted product answers 404, which is never written
// to the cache) leaves the old 200 entry in place forever. With an immediate
// expiry the next request is a blocking miss, so a deleted or unpublished
// resource becomes a real 404 and a renamed one follows its redirect. This is
// the form the Next documentation gives for route handlers called by an
// external system.
const EXPIRE_NOW = { expire: 0 } as const;
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, error: 'REVALIDATE_SECRET not configured' },
      { status: 500 },
    );
  }

  if (req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json(
      { revalidated: false, error: 'Invalid secret' },
      { status: 401 },
    );
  }

  let slug: string | undefined;
  let tag: string | undefined;
  try {
    ({ slug, tag } = await req.json());
  } catch {
    return NextResponse.json(
      { revalidated: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (typeof tag === 'string') {
    if (!PLATFORM_TAG.test(tag)) {
      return NextResponse.json(
        { revalidated: false, error: 'Unknown "tag"' },
        { status: 400 },
      );
    }
    revalidateTag(tag, EXPIRE_NOW);
    return NextResponse.json({ revalidated: true, tag, now: Date.now() });
  }

  if (!slug) {
    return NextResponse.json(
      { revalidated: false, error: 'Missing "slug" or "tag"' },
      { status: 400 },
    );
  }

  revalidateTag(storeTag(slug), EXPIRE_NOW);

  return NextResponse.json({ revalidated: true, slug, now: Date.now() });
}
