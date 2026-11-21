import { headers } from 'next/headers';
import { StoreNotFoundView } from '@/components/layout/StoreNotFoundView';
import { requestPathPrefix } from '@/lib/market';
import { pageLinkPrefix } from '@/lib/localePaths';

// App-root 404 for paths outside every route group (platform routes,
// `/store/...` paths the proxy did not rewrite). Store hosts normally reach
// the store segment's own not-found.tsx; this one reuses the same content
// without the store chrome. Translated through the request config, which
// resolves the locale from the proxy headers (or the default locale).
export default async function RootNotFound() {
  const h = await headers();
  const urlLocale = h.get('x-locale');
  // M156: the proxy's path prefix on a locale-path market (`/de-at`).
  const lp = pageLinkPrefix(requestPathPrefix(h), urlLocale);
  return (
    <main className="flex-1 flex flex-col">
      <StoreNotFoundView lp={lp} />
    </main>
  );
}
