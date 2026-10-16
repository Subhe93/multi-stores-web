/*
 * Personalization evaluator mirror (M4.1, contract C12): runs every shared
 * evaluator case against the web copy, proves the M4.0 parity on every M4.0
 * validate vector, and checks that the copies still match the pinned hashes
 * (and the shared source when the sibling repo is checked out).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_ONLY_TYPES,
  buildPersonalizationGroups,
  evaluateConditions,
  evaluatePersonalization,
  formatMinorUnits,
  groupValueText,
  hasPersonalizationGroups,
  insertAtCaret,
  lineKey,
  lineSnapshotColumns,
  optionCount,
  snapshotGroupLabel,
  splitFieldTree,
  toMinorUnits,
  truncateChars,
  validatePersonalization,
  type FieldDef,
  type PContext,
  type PFieldDef,
} from './index';
import { EVALUATOR_MIRROR_SHA256 } from './evaluator.hash';
import casesJson from './personalization-cases.json';
import m40Json from './personalization.vectors.json';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const cases: Json = casesJson;
const m40: Json = m40Json;

const here = fileURLToPath(new URL('.', import.meta.url));
const sharedDir = resolve(here, '../../../../multi-stores-shared/src/personalization');
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');

const defsOf = (c: Json): PFieldDef[] => (typeof c.defs === 'string' ? cases.defs[c.defs] : c.defs);
const ctxOf = (c: Json): PContext => ({ ...cases.baseContext, ...c.ctx });
const withoutMessage = (errors: Json[]): Json[] =>
  errors.map(({ message, ...rest }) => {
    expect(message).toBe('');
    return rest;
  });

describe('personalization evaluator mirror parity', () => {
  const files = Object.keys(EVALUATOR_MIRROR_SHA256);

  it('pins the four modules and the cases file', () => {
    expect(files.sort()).toEqual(
      ['conditions.ts', 'display.ts', 'evaluator.ts', 'personalization-cases.json', 'types.ts'].sort(),
    );
  });

  it.each(files)('%s matches its pinned sha256 (re-run the shared sync script)', (file) => {
    expect(sha(resolve(here, file))).toBe(EVALUATOR_MIRROR_SHA256[file]);
  });

  it.skipIf(!existsSync(resolve(sharedDir, 'evaluator.ts'))).each(files)(
    '%s equals the shared source when the sibling repo is checked out',
    (file) => {
      expect(sha(resolve(sharedDir, file))).toBe(EVALUATOR_MIRROR_SHA256[file]);
    },
  );

  it('runs all 174 cases', () => {
    const count = ['evaluate', 'conditions', 'optionCount', 'money', 'formatMoney', 'truncate', 'insertAtCaret', 'display', 'groupLabels'].reduce(
      (n, k) => n + (cases[k] as Json[]).length,
      0,
    );
    expect(cases.version).toBe(1);
    expect(count).toBe(174);
  });

  it('has the price-guard cases', () => {
    expect((cases.evaluateGuards as Json[]).length).toBeGreaterThanOrEqual(8);
  });
});

describe('evaluatePersonalization cases', () => {
  // `evaluateGuards`: the price-guard cases (same format; not in the 174 count).
  it.each(
    [...(cases.evaluate as Json[]), ...((cases.evaluateGuards ?? []) as Json[])].map((c) => [c.name, c] as const),
  )('%s', (_n, c) => {
    const defs = defsOf(c);
    const ctx = ctxOf(c);
    const res = evaluatePersonalization(defs, c.raw, ctx);
    const e = c.expect;

    if (e.ok !== undefined) expect(res.ok).toBe(e.ok);
    if (e.legacy !== undefined) expect(res.legacy).toBe(e.legacy);
    if (e.errors !== undefined) expect(res.errors).toEqual(e.errors);
    if (e.errorCount !== undefined) expect(res.errors).toHaveLength(e.errorCount);
    if (e.lastError !== undefined) expect(res.errors[res.errors.length - 1]).toEqual(e.lastError);
    if (e.values !== undefined) expect(res.values).toEqual(e.values);
    if (e.priceDelta !== undefined) expect(res.priceDelta).toBe(e.priceDelta);
    if (e.priceDeltaMinor !== undefined) expect(res.priceDeltaMinor).toBe(e.priceDeltaMinor);
    if (e.visibleIds !== undefined) expect(res.visibleIds).toEqual(e.visibleIds);
    if (e.lineCount !== undefined) expect(res.lines).toHaveLength(e.lineCount);
    if (e.lines !== undefined) {
      expect(res.lines).toHaveLength(e.lines.length);
      (e.lines as Json[]).forEach((l, i) => expect(res.lines[i]).toMatchObject(l));
    }
    if (e.snapshot !== undefined) {
      (e.snapshot as Json[]).forEach((s, i) => expect(lineSnapshotColumns(res.lines[i])).toEqual(s));
    }

    const sum = res.lines.reduce((n, l) => n + l.price_delta_minor, 0);
    expect(res.priceDeltaMinor).toBe(sum);
    expect(res.priceDelta).toBe(formatMinorUnits(sum));
    for (const l of res.lines) expect(l.price_delta).toBe(formatMinorUnits(l.price_delta_minor));

    if (!res.legacy) {
      const again = evaluatePersonalization(defs, res.values, ctx);
      expect(JSON.stringify(again.values)).toBe(JSON.stringify(res.values));
      expect(again.priceDeltaMinor).toBe(res.priceDeltaMinor);
      expect(lineKey(again.values)).toBe(lineKey(res.values));
    }

    if (c.compareToM40) {
      const fields = splitFieldTree(defs).top.filter((d) => !APP_ONLY_TYPES.has(d.type));
      const m = validatePersonalization({ fields: fields as FieldDef[], values: c.raw });
      expect(res.ok).toBe(m.ok);
      expect(withoutMessage(res.errors)).toEqual(m.issues);
      expect(res.values).toEqual(m.values);
    }
    if (c.sameAs !== undefined) {
      const b = evaluatePersonalization(defs, c.sameAs, ctx);
      expect(JSON.stringify(res.values)).toBe(JSON.stringify(b.values));
      expect(lineKey(res.values)).toBe(lineKey(b.values));
    }
    if (c.differentFrom !== undefined) {
      const b = evaluatePersonalization(defs, c.differentFrom, ctx);
      expect(lineKey(res.values)).not.toBe(lineKey(b.values));
    }
  });
});

describe('M4.0 parity on every M4.0 validate vector', () => {
  const base = cases.baseContext;
  // App-only types (passed through as "unknown" by M4.0) are M4.1 fields: D10 drops them.
  const usesAppType = (v: Json): boolean => (v.fields as Json[]).some((f) => APP_ONLY_TYPES.has(f.type));
  const vectors: Json[] = (m40.validate as Json[]).filter((v) => !usesAppType(v));
  const appOn = vectors.filter((v) => !v.prefilled);

  it.each(vectors.map((v) => [v.name, v] as const))('app off: %s', (_n, v) => {
    const m = validatePersonalization({ fields: v.fields, values: v.values, prefilled: v.prefilled });
    const res = evaluatePersonalization(v.fields, v.values, { ...base, appEnabled: false, prefilled: v.prefilled });
    expect(res.legacy).toBe(true);
    expect(res.ok).toBe(m.ok);
    expect(withoutMessage(res.errors)).toEqual(m.issues);
    expect(res.values).toEqual(m.values);
  });

  it.each(appOn.map((v) => [v.name, v] as const))('app on: %s', (_n, v) => {
    const m = validatePersonalization({ fields: v.fields, values: v.values });
    const res = evaluatePersonalization(v.fields, v.values, { ...base, appEnabled: true });
    expect(res.legacy).toBe(false);
    expect(res.ok).toBe(m.ok);
    expect(withoutMessage(res.errors)).toEqual(m.issues);
    expect(res.values).toEqual(m.values);
  });

  it.each((m40.validate as Json[]).filter(usesAppType).map((v) => [v.name, v] as const))(
    'app off drops app-only types (D10): %s',
    (_n, v) => {
      const res = evaluatePersonalization(v.fields, v.values, { ...base, appEnabled: false });
      const appIds = (v.fields as Json[]).filter((f) => APP_ONLY_TYPES.has(f.type)).map((f) => f.id);
      for (const id of appIds) expect(res.values).not.toHaveProperty(id);
    },
  );
});

describe('conditions, optionCount, money and character cases', () => {
  it.each((cases.conditions as Json[]).map((c) => [c.name, c] as const))('condition: %s', (_n, c) => {
    const ctx = { variantOptions: c.options ?? {}, optionConfig: c.optionConfig ?? [] };
    const fields: Record<string, unknown> = c.fields ?? {};
    expect(evaluateConditions(c.conditions, ctx, (name) => fields[name])).toBe(c.expected);
  });
  it.each((cases.optionCount as Json[]).map((c) => [c.name, c] as const))('optionCount: %s', (_n, c) => {
    expect(optionCount({ variantOptions: c.options ?? {}, optionConfig: c.optionConfig ?? [] }, c.count)).toBe(c.expected);
  });
  it.each((cases.money as Json[]).map((c) => [JSON.stringify(c.input), c] as const))('toMinorUnits(%s)', (_n, c) => {
    expect(toMinorUnits(c.input)).toBe(c.minor);
  });
  it.each((cases.formatMoney as Json[]).map((c) => [c.minor, c] as const))('formatMinorUnits(%s)', (_n, c) => {
    expect(formatMinorUnits(c.minor)).toBe(c.text);
  });
  it.each((cases.truncate as Json[]).map((c) => [JSON.stringify(c.input), c] as const))('truncateChars(%s)', (_n, c) => {
    expect(truncateChars(c.input, c.max)).toBe(c.expected);
  });
  it.each((cases.insertAtCaret as Json[]).map((c) => [c.name, c] as const))('insertAtCaret: %s', (_n, c) => {
    expect(insertAtCaret(c.value, c.caret, c.ch, c.max)).toEqual(c.expected);
  });
});

describe('display cases', () => {
  it.each((cases.display as Json[]).map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const out = buildPersonalizationGroups(c.rows, {
      ...(c.opts ?? {}),
      ...(c.useDefaultLabel ? { defaultGroupLabel: (i: number) => `Item ${i}` } : {}),
    });
    expect(out).toEqual(c.expected);
    expect(hasPersonalizationGroups(c.rows)).toBe(c.expected.groups.length > 0);
    if (c.groupText) expect(out.groups.map((g) => groupValueText(g))).toEqual(c.groupText);
  });
  it.each((cases.groupLabels as Json[]).map((c) => [c.name, c] as const))('snapshotGroupLabel: %s', (_n, c) => {
    expect(snapshotGroupLabel(c.row, c.locale, c.primary)).toBe(c.expected);
  });
});
