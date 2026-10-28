import { headers } from 'next/headers';
import { StoreNotFoundView } from '@/components/layout/StoreNotFoundView';

// App-root 404 for paths outside every route group (platform routes,
// `/store/...` paths the proxy did not rewrite). Store hosts normally reach
// the store segment's own not-found.tsx; this one reuses the same content
// without the store chrome. Translated through the request config, which
// resolves the locale from the proxy headers (or the default locale).
export default async function RootNotFound() {
  const urlLocale = (await headers()).get('x-locale');
  const lp = urlLocale ? `/${urlLocale}` : '';
  return (
    <main className="flex-1 flex flex-col">
      <StoreNotFoundView lp={lp} />
    </main>
  );
}
