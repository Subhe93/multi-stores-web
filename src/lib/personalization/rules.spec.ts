/*
 * Personalization rules mirror (M4.0 K6, C12): runs every shared vector
 * against the web copy of rules.ts and checks that both files are unchanged
 * byte copies of multi-stores-shared/src/personalization/.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  charCount,
  compileAllowedChars,
  isFileRefPath,
  isValidAllowedChars,
  isValidPattern,
  lineKey,
  normalizeFieldValues,
  readLinkedValidation,
  stripVariationSelectors,
  validatePersonalization,
  type FieldDef,
} from './index';
import { RULES_SHA256, VECTORS_SHA256 } from './rules.hash';
import vectors from './personalization.vectors.json';

interface ValidateVector {
  name: string;
  fields: FieldDef[];
  values: unknown;
  prefilled?: Record<string, string>;
  expected: { ok: boolean; issues: unknown[]; values?: Record<string, unknown> };
}

const here = fileURLToPath(new URL('.', import.meta.url));
const sharedDir = resolve(here, '../../../../multi-stores-shared/src/personalization');
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');

describe('personalization mirror parity', () => {
  it('rules.ts matches RULES_SHA256 (re-copy from shared, then update rules.hash.ts)', () => {
    expect(sha(resolve(here, 'rules.ts'))).toBe(RULES_SHA256);
  });

  it('personalization.vectors.json matches VECTORS_SHA256', () => {
    expect(sha(resolve(here, 'personalization.vectors.json'))).toBe(VECTORS_SHA256);
  });

  const sharedRules = resolve(sharedDir, 'rules.ts');
  it.skipIf(!existsSync(sharedRules))('both files equal the shared source when the sibling repo is checked out', () => {
    expect(sha(sharedRules)).toBe(RULES_SHA256);
    expect(sha(resolve(sharedDir, 'personalization.vectors.json'))).toBe(VECTORS_SHA256);
  });

  it('runs all 171 vectors', () => {
    const count =
      vectors.charCount.length +
      vectors.normalize.length +
      vectors.lineKey.length +
      vectors.allowedChars.length +
      vectors.pattern.length +
      vectors.linkedValidation.length +
      vectors.fileRef.length +
      vectors.validate.length +
      vectors.generated.length;
    expect(count).toBe(182);
  });
});

describe('charCount vectors', () => {
  it.each(vectors.charCount.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(charCount(v.input)).toBe(v.expected);
  });
});

describe('normalizeFieldValues vectors', () => {
  it.each(vectors.normalize.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(normalizeFieldValues(v.input)).toEqual(v.expected);
  });
});

describe('lineKey vectors', () => {
  it.each(vectors.lineKey.map((v) => [v.name, v] as const))('%s', (_n, raw) => {
    const v = raw as {
      a: unknown;
      aDesign?: string;
      b?: unknown;
      bDesign?: string;
      equal?: boolean;
      expectedA?: string;
    };
    const keyA = lineKey(v.a, v.aDesign);
    if (v.expectedA !== undefined) expect(keyA).toBe(v.expectedA);
    if (v.equal !== undefined) {
      const keyB = lineKey(v.b, v.bDesign);
      if (v.equal) expect(keyA).toBe(keyB);
      else expect(keyA).not.toBe(keyB);
    }
  });
});

describe('allowed_chars vectors', () => {
  it.each(vectors.allowedChars.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(isValidAllowedChars(v.body)).toBe(v.valid);
    const re = compileAllowedChars(v.body);
    for (const s of v.samples) {
      expect(re !== null && re.test(stripVariationSelectors(s.value))).toBe(s.ok);
    }
  });
});

describe('pattern vectors', () => {
  it.each(vectors.pattern.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(isValidPattern(v.pattern)).toBe(v.valid);
  });
});

describe('linked_validation vectors', () => {
  it.each(vectors.linkedValidation.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(readLinkedValidation(v.raw)).toEqual(v.expected);
  });
});

describe('file reference vectors', () => {
  it.each(vectors.fileRef.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    expect(isFileRefPath(v.url)).toBe(v.ok);
  });
});

describe('validatePersonalization vectors', () => {
  const cases = vectors.validate as unknown as ValidateVector[];
  it.each(cases.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    const res = validatePersonalization({ fields: v.fields, values: v.values, prefilled: v.prefilled });
    expect(res.ok).toBe(v.expected.ok);
    expect(res.issues).toEqual(v.expected.issues);
    if (v.expected.values !== undefined) expect(res.values).toEqual(v.expected.values);
  });
});

describe('generated vectors', () => {
  it.each(vectors.generated.map((v) => [v.name, v] as const))('%s', (_n, v) => {
    const res = validatePersonalization({
      fields: [v.field as FieldDef],
      values: { [v.field.id]: v.repeat.repeat(v.count) },
    });
    expect(res.issues[0]?.code ?? null).toBe(v.expectedCode);
  });
});
