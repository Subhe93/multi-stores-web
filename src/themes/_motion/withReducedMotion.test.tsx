import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useContext } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { render } from '@testing-library/react';
import { MotionConfigContext, motion } from 'framer-motion';
import { withReducedMotion } from './withReducedMotion';

// framer copies MotionConfig's reducedMotion into each motion element once,
// when the element is created (its first client render). So what counts is
// the value the FIRST client render reads, the hydration render included: a
// value that only arrives one render later never reaches the elements.

let seen: string[] = [];

function Probe() {
  const { reducedMotion } = useContext(MotionConfigContext);
  seen.push(String(reducedMotion));
  return (
    <motion.div data-testid="m" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}>
      hi
    </motion.div>
  );
}
const Wrapped = withReducedMotion(Probe);

let roots: Root[] = [];
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  seen = [];
  roots = [];
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => roots.forEach((r) => r.unmount()));
  errorSpy.mockRestore();
  document.body.innerHTML = '';
});

/** Server HTML first (no store root in the document yet), then the page as the browser gets it. */
function serverThenHydrate(reveal?: string) {
  const serverHtml = renderToString(<Wrapped />);
  const serverSeen = [...seen];
  seen = [];

  const root = document.createElement('div');
  root.className = 'store-root min-h-screen';
  if (reveal) root.setAttribute('data-motion-reveal', reveal);
  const container = document.createElement('main');
  container.innerHTML = serverHtml;
  root.appendChild(container);
  document.body.appendChild(root);

  act(() => {
    roots.push(hydrateRoot(container, <Wrapped />));
  });
  return { serverHtml, serverSeen, container };
}

describe('withReducedMotion', () => {
  it('motion "off": the hydration render already reads "always"', () => {
    const { serverSeen } = serverThenHydrate('off');
    // The server has no document to read: "user", as for every store.
    expect(serverSeen).toEqual(['user']);
    // Every client render, the first one included.
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(['always']));
  });

  it('motion "off": hydration reports no mismatch (the wrapper adds no markup)', () => {
    const { serverHtml, container } = serverThenHydrate('off');
    expect(serverHtml).toMatch(/^<div data-testid="m"/);
    expect(container.querySelector('[data-testid="m"]')).not.toBeNull();
    const messages = errorSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(messages.filter((m: string) => /hydrat|did not match|mismatch/i.test(m))).toEqual([]);
  });

  it('an unset store and "calm" keep "user" on every render', () => {
    serverThenHydrate();
    expect(new Set(seen)).toEqual(new Set(['user']));
    seen = [];
    serverThenHydrate('calm');
    expect(new Set(seen)).toEqual(new Set(['user']));
  });

  it('the server markup is the same for every store', () => {
    const a = renderToString(<Wrapped />);
    const root = document.createElement('div');
    root.className = 'store-root';
    root.setAttribute('data-motion-reveal', 'off');
    document.body.appendChild(root);
    // Even with the flag readable, the wrapper renders the same HTML.
    expect(renderToString(<Wrapped />)).toBe(a);
  });

  it('a client-only mount (navigation) reads the flag too', () => {
    const root = document.createElement('div');
    root.className = 'store-root';
    root.setAttribute('data-motion-reveal', 'off');
    document.body.appendChild(root);
    render(<Wrapped />, { container: root });
    expect(new Set(seen)).toEqual(new Set(['always']));
  });

  it('keeps a readable display name', () => {
    expect(Wrapped.displayName).toBe('WithReducedMotion(Probe)');
  });
});
