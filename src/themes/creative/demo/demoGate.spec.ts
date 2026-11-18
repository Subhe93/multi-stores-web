import { afterEach, describe, expect, it, vi } from 'vitest';
import { creativeDemoEnabled, isCreativeDemoPath } from './demoGate';

describe('creative demo gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches the demo path only', () => {
    expect(isCreativeDemoPath('/dev/creative-demo')).toBe(true);
    expect(isCreativeDemoPath('/dev/creative-demo/')).toBe(true);
    expect(isCreativeDemoPath('/dev/creative-demos')).toBe(false);
    expect(isCreativeDemoPath('/dev')).toBe(false);
    expect(isCreativeDemoPath('/store/x/dev/creative-demo')).toBe(false);
  });

  it('is open outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(creativeDemoEnabled()).toBe(true);
  });

  it('is closed in production unless CREATIVE_DEMO=1', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CREATIVE_DEMO', '');
    expect(creativeDemoEnabled()).toBe(false);
    vi.stubEnv('CREATIVE_DEMO', 'true');
    expect(creativeDemoEnabled()).toBe(false);
    vi.stubEnv('CREATIVE_DEMO', '1');
    expect(creativeDemoEnabled()).toBe(true);
  });
});
