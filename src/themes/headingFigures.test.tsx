import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The rule lives in globals.css (not loaded in the dom project): read the
// file and check the selector itself against real elements.
const CSS = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

const MARKER = 'store-heading-figures';
const afterMarker = CSS.slice(CSS.indexOf(MARKER));
const afterComment = afterMarker.slice(afterMarker.indexOf('*/') + 2);
const SELECTOR = afterComment.slice(0, afterComment.indexOf('{')).trim().replace(/\s+/g, ' ');
const BODY = afterComment.slice(afterComment.indexOf('{') + 1, afterComment.indexOf('}'));

function mount(markup: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
}

const matches = (host: HTMLElement, id: string) => host.querySelector(`#${id}`)!.matches(SELECTOR);

describe('store-heading-figures rule (globals.css)', () => {
  it('is present once, inside the base layer', () => {
    expect(CSS.split(MARKER)).toHaveLength(2);
    expect(SELECTOR.startsWith('.store-root :is(')).toBe(true);
    const before = CSS.slice(0, CSS.indexOf(MARKER));
    expect(before.slice(before.lastIndexOf('@layer')).startsWith('@layer base {')).toBe(true);
  });

  it('declares lining figures, composable with the numeric utilities', () => {
    const declarations = BODY.split(';').map((d) => d.trim()).filter(Boolean);
    expect(declarations).toEqual(['--tw-numeric-figure: lining-nums', 'font-variant-numeric: lining-nums']);
  });

  it('matches the elements that use the heading font inside the store', () => {
    const host = mount(`
      <div class="store-root">
        <h2 id="h2">Project 001</h2>
        <h5 id="h5">100 kits</h5>
        <span id="inline" style="font-family:var(--theme-font-heading)">Store 24</span>
        <span id="hydrated" style="font-family: var(--theme-font-heading); font-size: 2rem;">Store 24</span>
        <p id="look" data-text-look="heading">2026</p>
        <p id="plain">Body 100</p>
        <span id="bodyfont" style="font-family:var(--theme-font-body)">Body 100</span>
        <h2 id="asbody" data-text-look="body">Looks like body</h2>
      </div>
      <h2 id="outside">Outside the store</h2>
      <span id="outsidevar" style="font-family:var(--theme-font-heading)">Outside</span>
    `);
    for (const id of ['h2', 'h5', 'inline', 'hydrated', 'look']) expect(matches(host, id), id).toBe(true);
    for (const id of ['plain', 'bodyfont', 'asbody', 'outside', 'outsidevar']) expect(matches(host, id), id).toBe(false);
    host.remove();
  });

  it('covers the portaled overlay (cart drawer) too', () => {
    const host = mount(`
      <div class="store-overlay">
        <h3 id="title">Cart (3)</h3>
        <span id="var" style="font-family:var(--theme-font-heading)">Total 100</span>
        <p id="plain">3 items</p>
      </div>
    `);
    expect(matches(host, 'title')).toBe(true);
    expect(matches(host, 'var')).toBe(true);
    expect(matches(host, 'plain')).toBe(false);
    host.remove();
  });
});
