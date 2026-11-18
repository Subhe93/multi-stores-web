// STUB (owner: B3). Scene theme and living background on ANY section, from
// settings._style (contract 4.10). The foundation returns null, so
// SectionRenderer renders today's markup for every section.

import type { CSSProperties, ReactNode } from 'react';
import type { SectionStyle } from '../../sectionStyle';

export interface SectionDecor {
  className: string;
  attrs: Record<string, string>;
  style?: CSSProperties;
  before: ReactNode;
}

export function renderSectionDecor(style: SectionStyle | undefined, opts: { nested: boolean }): SectionDecor | null {
  void style;
  void opts;
  return null;
}
