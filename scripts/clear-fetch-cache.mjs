// Runs before every `npm run start` (npm "prestart"): empties the Next fetch
// cache on disk.
//
// Why: Next keeps tag expirations in process memory only. After a restart it
// has forgotten which cached API responses were expired, and it reads the old
// files in .next/cache/fetch-cache again. A resource deleted since then
// answers 404 on refetch, a non-200 response is never written to the cache,
// so the old 200 body would be served again indefinitely. Starting with an
// empty fetch cache makes every restart safe; the cache refills on demand.
//
// This must never stop the server from starting: every failure is logged and
// swallowed. `--dir=<path>` overrides the directory (used when testing).
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.find((a) => a.startsWith('--dir='));
const dir = arg ? resolve(arg.slice('--dir='.length)) : join(root, '.next', 'cache', 'fetch-cache');

try {
  if (!existsSync(dir)) {
    console.log(`[clear-fetch-cache] nothing to clear (${dir} does not exist)`);
  } else {
    const count = readdirSync(dir).length;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    console.log(`[clear-fetch-cache] cleared ${count} entries from ${dir}`);
  }
} catch (err) {
  console.warn(`[clear-fetch-cache] could not clear ${dir}: ${err instanceof Error ? err.message : String(err)}`);
}
