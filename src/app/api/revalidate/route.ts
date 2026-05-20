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
  try {
    ({ slug } = await req.json());
  } catch {
    return NextResponse.json(
      { revalidated: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!slug) {
    return NextResponse.json(
      { revalidated: false, error: 'Missing "slug"' },
      { status: 400 },
    );
  }

  // Next 16 requires a cache-life profile as the second arg; "max" purges the
  // tagged entries on the next request.
  revalidateTag(storeTag(slug), 'max');

  return NextResponse.json({ revalidated: true, slug, now: Date.now() });
}
