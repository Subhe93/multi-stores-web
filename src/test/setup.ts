// Setup of the `dom` vitest project (React component / hook tests).
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `findBy*` / `waitFor` default to 1 s, which the designer inline tests miss
// when the whole suite runs in parallel (module transform + jsdom start-up
// land on the same tick); they pass alone. A longer ceiling only matters
// when something is actually wrong.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Browser APIs jsdom lacks: a no-op ResizeObserver and a silent 2D canvas
// context (the renderer itself is covered by the node golden tests).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
}
// jsdom's scrollTo only logs "not implemented".
if (typeof window !== 'undefined') {
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
}
