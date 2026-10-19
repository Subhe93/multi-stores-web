/*
 * @multi-stores/core consumption (M5.3). The designer renderer and the
 * personalization modules live only in multi-stores-shared/packages/core;
 * the web imports them (file: dependency, ESM build). This spec checks that
 *   - the browser canvas contexts satisfy the renderer's structural Ctx2D,
 *   - the package build matches the current renderer source (RENDERER_SHA256
 *     is the sha256 of design-renderer.ts with LF line endings),
 *   - nobody re-added a copy of a package module to this repo.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RENDERER_VERSION, type Ctx2D } from '@multi-stores/core/designer';
import { RENDERER_SHA256 } from '@multi-stores/core/designer/hash';

const coreDir = dirname(createRequire(import.meta.url).resolve('@multi-stores/core/package.json'));
const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

// Compile-time guard: the browser contexts satisfy the renderer's structural Ctx2D.
export const ctxCompat: Array<(c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => Ctx2D> = [
  (c) => c,
];

describe('@multi-stores/core package', () => {
  it('was built from the current renderer source (RENDERER_SHA256)', () => {
    const source = readFileSync(resolve(coreDir, 'src/designer/design-renderer.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(source, 'utf8').digest('hex')).toBe(RENDERER_SHA256);
  });

  it('exposes a semver RENDERER_VERSION', () => {
    expect(RENDERER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has no copy of a package module in this repo', () => {
    let problems = '';
    try {
      execFileSync(process.execPath, [resolve(coreDir, 'tools/check-no-copies.mjs'), repoRoot], { stdio: 'pipe' });
    } catch (e) {
      // Non-zero exit: the offending files are listed on stderr.
      problems = String((e as { stderr?: Buffer }).stderr ?? e);
    }
    expect(problems).toBe('');
  });
});
