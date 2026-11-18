// Gate of the creative demo route (/dev/creative-demo): development builds,
// or a production build started with CREATIVE_DEMO=1 (integration QA).
// Imported by the proxy, so it stays dependency-free.

export const CREATIVE_DEMO_PATH = '/dev/creative-demo';

export function isCreativeDemoPath(pathname: string): boolean {
  return pathname === CREATIVE_DEMO_PATH || pathname.startsWith(`${CREATIVE_DEMO_PATH}/`);
}

export function creativeDemoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.CREATIVE_DEMO === '1';
}
