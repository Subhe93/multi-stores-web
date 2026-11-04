import { afterEach, describe, expect, it } from 'vitest';
import { readUrlToken, stripTokenFromUrl } from './urlToken';

// Emailed tokens: `#token=` in current links, `?token=` in older ones.

function setUrl(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => setUrl('/'));

describe('readUrlToken', () => {
  it('prefers the fragment, falls back to the query string', () => {
    setUrl('/auth/reset-password#token=frag');
    expect(readUrlToken()).toBe('frag');
    setUrl('/auth/reset-password?token=query');
    expect(readUrlToken()).toBe('query');
    setUrl('/auth/reset-password');
    expect(readUrlToken()).toBeNull();
  });
});

describe('stripTokenFromUrl', () => {
  it('removes the token from query and fragment, keeps other params', () => {
    setUrl('/auth/reset-password?x=1&token=q#token=f&y=2');
    stripTokenFromUrl();
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#y=2');
  });
});
