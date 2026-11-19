#!/usr/bin/env node
// Kurmanji (ku) storefront strings: check the translators' part files and
// merge them into src/i18n/messages/ku.json.
//
// Each translator owns some top-level groups of en.json and writes ONLY those
// groups, with the same nested keys as en.json, into
// scripts/i18n/ku-parts/part<N>.json. Nobody but the integrator writes ku.json.
//
//   node scripts/i18n/ku-parts.mjs check 1      check one part file
//   node scripts/i18n/ku-parts.mjs check        check every part file present
//   node scripts/i18n/ku-parts.mjs merge        check all, then write ku.json
//
// Checks per string: the key exists in en.json, the value is a string, the
// ICU structure matches the English one (argument names and types, plural /
// select option keys, rich-text tag names), no group outside the part's
// list. Strings left identical to English are reported as a warning only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const EN_FILE = join(root, 'src', 'i18n', 'messages', 'en.json');
const KU_FILE = join(root, 'src', 'i18n', 'messages', 'ku.json');
const PARTS_DIR = join(here, 'ku-parts');

// Top-level groups per part (PLAN.md, plans/kurdish-locale). `home` is the
// platform marketing page, never served in ku: it stays English.
export const PARTS = {
  1: ['common', 'cart', 'checkout', 'account', 'orderStatus', 'company', 'b2b', 'market', 'store'],
  2: [
    'product', 'personalization', 'designer', 'listing', 'nav', 'footer', 'sections',
    'creative', 'slider', 'focused', 'externalMap', 'consent', 'builderPreview', 'editHint',
  ],
  3: ['errors', 'auth'],
};
const UNTRANSLATED_GROUPS = ['home'];

let parse;
try {
  ({ parse } = await import('@formatjs/icu-messageformat-parser'));
} catch {
  parse = null;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** A comparable signature of one ICU message (structure only, no text). */
function signature(message) {
  if (!parse) {
    // Fallback without the parser: argument-like tokens and tag names.
    const args = [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*(,\s*\w+)?/g)].map((m) => m[1] + (m[2] || ''));
    const tags = [...message.matchAll(/<\/?([A-Za-z]\w*)>/g)].map((m) => m[1]);
    return JSON.stringify({ args: args.sort(), tags: tags.sort() });
  }
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      switch (n.type) {
        case 1: out.push(`arg:${n.value}`); break;
        case 2: out.push(`number:${n.value}`); break;
        case 3: out.push(`date:${n.value}`); break;
        case 4: out.push(`time:${n.value}`); break;
        case 5:
        case 6: {
          const kind = n.type === 5 ? 'select' : 'plural';
          out.push(`${kind}:${n.value}:${Object.keys(n.options).sort().join('|')}`);
          for (const opt of Object.values(n.options)) walk(opt.value);
          break;
        }
        case 7: out.push('#'); break;
        case 8: out.push(`tag:${n.value}`); walk(n.children); break;
        default: break;
      }
    }
  };
  walk(parse(message, { ignoreTag: false }));
  return JSON.stringify(out.sort());
}

function checkPart(n, en) {
  const file = join(PARTS_DIR, `part${n}.json`);
  const errors = [];
  const warnings = [];
  if (!existsSync(file)) return { file, missing: true, errors, warnings, data: null };
  let data;
  try {
    data = readJson(file);
  } catch (e) {
    errors.push(`invalid JSON: ${e.message}`);
    return { file, errors, warnings, data: null };
  }
  const allowed = new Set(PARTS[n]);
  for (const group of Object.keys(data)) {
    if (!allowed.has(group)) errors.push(`group "${group}" is not owned by part ${n}`);
  }
  let total = 0;
  let same = 0;
  const walk = (src, ku, path) => {
    for (const [key, enValue] of Object.entries(src)) {
      const p = `${path}.${key}`;
      const kuValue = ku?.[key];
      if (typeof enValue === 'string') {
        total++;
        if (kuValue === undefined) { errors.push(`${p}: missing`); continue; }
        if (typeof kuValue !== 'string') { errors.push(`${p}: not a string`); continue; }
        if (kuValue.trim() === '' && enValue.trim() !== '') { errors.push(`${p}: empty`); continue; }
        try {
          if (signature(kuValue) !== signature(enValue)) {
            errors.push(`${p}: placeholders / plural / tags differ from English`);
          }
        } catch (e) {
          errors.push(`${p}: ICU syntax error (${e.message})`);
        }
        if (kuValue === enValue) same++;
      } else {
        if (!kuValue || typeof kuValue !== 'object') { errors.push(`${p}: missing group`); continue; }
        walk(enValue, kuValue, p);
      }
    }
    if (ku && typeof ku === 'object') {
      for (const key of Object.keys(ku)) {
        if (!(key in src)) errors.push(`${path}.${key}: not in en.json`);
      }
    }
  };
  for (const group of PARTS[n]) {
    if (!(group in data)) { errors.push(`group "${group}" missing`); continue; }
    walk(en[group], data[group], group);
  }
  if (same) warnings.push(`${same} of ${total} strings are identical to English (fine for names, codes, "OK"; check the rest)`);
  return { file, errors, warnings, data, total };
}

function report(n, r) {
  if (r.missing) { console.log(`part${n}: no file yet (${r.file})`); return; }
  console.log(`part${n}: ${r.total ?? 0} strings, ${r.errors.length} error(s)`);
  for (const e of r.errors.slice(0, 200)) console.log(`  ERROR ${e}`);
  for (const w of r.warnings) console.log(`  warn  ${w}`);
}

const [cmd = 'check', arg] = process.argv.slice(2);
const en = readJson(EN_FILE);

// Every group of en.json belongs to exactly one part or stays English.
const owned = [...Object.values(PARTS).flat(), ...UNTRANSLATED_GROUPS];
const unowned = Object.keys(en).filter((g) => !owned.includes(g));
if (unowned.length) {
  console.log(`ERROR en.json groups without an owner: ${unowned.join(', ')} (add them to PARTS)`);
  process.exitCode = 1;
}

const which = arg ? [Number(arg)] : Object.keys(PARTS).map(Number);
const results = {};
for (const n of which) {
  if (!PARTS[n]) { console.log(`unknown part ${n}`); process.exit(1); }
  results[n] = checkPart(n, en);
  report(n, results[n]);
  if (results[n].errors.length) process.exitCode = 1;
}

if (cmd === 'merge') {
  const absent = which.filter((n) => results[n].missing);
  if (absent.length || process.exitCode) {
    console.log('merge aborted: every part must exist and pass the check');
    process.exit(1);
  }
  // en.json order and structure; each owned group from its part.
  const out = {};
  for (const group of Object.keys(en)) {
    const n = which.find((p) => PARTS[p].includes(group));
    out[group] = n ? results[n].data[group] : en[group];
  }
  const ordered = (src, val) =>
    typeof src === 'string' ? val : Object.fromEntries(Object.keys(src).map((k) => [k, ordered(src[k], val[k])]));
  writeFileSync(KU_FILE, `${JSON.stringify(ordered(en, out), null, 2)}\n`);
  console.log(`wrote ${KU_FILE}`);
} else if (cmd !== 'check') {
  console.log(`unknown command ${cmd}`);
  process.exit(1);
}
