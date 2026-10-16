/*
 * Mirror integrity (M4.2 D2 / §3.5): design-renderer.ts is a byte copy of
 * multi-stores-shared/src/designer/design-renderer.ts; the hash constant is
 * rewritten by multi-stores-shared/scripts/sync-designer-renderer.mjs.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Ctx2D } from './design-renderer';
import { RENDERER_SHA256 } from './designer-renderer.hash';

const here = fileURLToPath(new URL('.', import.meta.url));
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');

// Compile-time guard: the browser contexts satisfy the renderer's structural Ctx2D.
export const ctxCompat: Array<(c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => Ctx2D> = [
  (c) => c,
];

describe('design-renderer mirror', () => {
  const mirror = resolve(here, 'design-renderer.ts');

  it('matches RENDERER_SHA256 (run the sync script after editing the shared source)', () => {
    expect(sha(mirror)).toBe(RENDERER_SHA256);
  });

  it('equals the shared source when the sibling repo is checked out', () => {
    const shared = resolve(here, '../../../../multi-stores-shared/src/designer/design-renderer.ts');
    if (!existsSync(shared)) return;
    expect(sha(shared)).toBe(sha(mirror));
  });
});
