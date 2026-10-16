/**
 * Personalization (web mirror, M4.0; M4.1 adds types, conditions, evaluator,
 * display next to it).
 *
 * MIRROR: `rules.ts` and `personalization.vectors.json` are byte copies of
 * multi-stores-shared/src/personalization/. Never edit them here — edit the
 * shared source, copy both files and update `rules.hash.ts`. rules.spec.ts
 * runs every vector and fails on drift.
 */
export * from './rules';
// M4.1 evaluator mirror (byte copies, sha256 pinned in evaluator.hash.ts;
// re-copy with multi-stores-shared/scripts/sync-personalization-evaluator.mjs).
export * from './types';
export * from './conditions';
export * from './evaluator';
export * from './display';
