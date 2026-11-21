import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// M156 §5 guard: no store link builder may derive the URL prefix from the
// locale alone any more (`/de` can now be `/de-de` or `/de-at`). Every
// builder reads the request's prefix through `linkPrefix` /
// `storeLocalePrefix(scope)` / `useStorePathPrefix` / `pageLinkPrefix`. A
// new `/${locale}` template outside the allow-list fails here.

const SRC = fileURLToPath(new URL('..', import.meta.url));

const PATTERNS = [/`\/\$\{(?:locale|lang|urlLocale)\}/, /!==\s*primaryLocale\s*\?\s*`\//];

// Files allowed to build the bare form: the prefix helpers themselves, the
// proxy / routing (they parse URLs), the platform pages, the picker URL
// builders and the legacy branches of the two language switchers.
const ALLOW = new Set(
  [
    'lib/localePaths.ts',
    'lib/storeUrl.ts',
    'lib/market-routing.ts',
    'proxy.ts',
    'lib/locale-path.ts',
    'lib/regionUrl.ts',
    'lib/marketSwitch.ts',
    'hooks/useLocalePath.ts',
    'components/layout/LanguageSwitcher.tsx',
    'themes/minimal/sections/chrome/LocaleSwitcher.client.tsx',
  ].map((p) => p.split('/').join(sep)),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('locale-path guard', () => {
  it('no link prefix is built from the locale alone outside the allow-list', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (ALLOW.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (PATTERNS.some((re) => re.test(line))) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the patterns catch the old forms', () => {
    expect(PATTERNS.some((re) => re.test("const lp = lang ? `/${lang}` : '';"))).toBe(true);
    expect(PATTERNS.some((re) => re.test("locale && locale !== primaryLocale ? `/${locale}` : ''"))).toBe(true);
    expect(PATTERNS.some((re) => re.test('const lp = pageLinkPrefix(pathPrefix, lang);'))).toBe(false);
  });
});
