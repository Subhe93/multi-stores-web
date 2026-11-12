import { describe, expect, it } from 'vitest';
import { embedCodeSection } from './EmbedCode';
import { minimalTheme } from '../theme';

describe('embed-code section definition', () => {
  it('is allowed in the HEADER / FOOTER builders on top of content pages', () => {
    expect(embedCodeSection.schema.id).toBe('embed-code');
    expect(embedCodeSection.schema.chrome).toBe(true);
    // No explicit whitelist: it keeps the default (every content page type).
    expect(embedCodeSection.schema.pageTypes).toBeUndefined();
  });

  it('defaults to an isolated embed with no minimum height', () => {
    expect(embedCodeSection.defaultSettings).toEqual({ mode: 'isolated', min_height: 0 });
  });

  it('is the only content section flagged for the chrome builders', () => {
    const flagged = Object.values(minimalTheme.sections)
      .filter((def) => def.schema.chrome)
      .map((def) => def.schema.id);
    expect(flagged).toEqual(['embed-code']);
  });
});
