import { describe, expect, it } from 'vitest';
import en from './messages/en.json';
import ku from './messages/ku.json';
import sv from './messages/sv.json';
import { loadMessages, mergeMessages } from './loadMessages';

type Tree = { [key: string]: string | Tree };

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keyPaths(v, `${prefix}${k}.`),
  );
}

describe('mergeMessages', () => {
  it('keeps the base where the override is missing or empty', () => {
    const base = { a: 'A', g: { b: 'B', c: 'C' } };
    const over = { a: '', g: { b: 'BB' } };
    expect(mergeMessages(base, over)).toEqual({ a: 'A', g: { b: 'BB', c: 'C' } });
  });
});

describe('loadMessages', () => {
  it('ku.json has exactly the key structure of en.json', () => {
    expect(keyPaths(ku as Tree).sort()).toEqual(keyPaths(en as Tree).sort());
  });

  it('falls back to English for every key of a store-only locale', async () => {
    const msgs = await loadMessages('ku');
    expect(keyPaths(msgs).sort()).toEqual(keyPaths(en as Tree).sort());
  });

  it('loads the six original locales untouched and unknown codes as English', async () => {
    expect(await loadMessages('sv')).toEqual(sv);
    expect(await loadMessages('xx')).toEqual(en);
  });
});
