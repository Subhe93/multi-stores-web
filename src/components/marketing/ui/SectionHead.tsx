import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';
import { SplitReveal } from './SplitReveal';
import { Reveal } from './Reveal';

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'start' | 'center';
  tone?: 'light' | 'dark';
  locale?: string;
  className?: string;
}

/** Eyebrow + split-line headline + optional lead paragraph. */
export function SectionHead({ eyebrow, title, lead, align = 'center', tone = 'light', locale, className = '' }: Props) {
  return (
    <div className={`sd-section-head sd-section-head-${align} sd-tone-${tone} ${className}`.trim()}>
      {eyebrow && (
        <Reveal y={16} duration={0.9}>
          <Eyebrow tone={tone === 'dark' ? 'ivory' : 'teal'}>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <SplitReveal as="h2" className="sd-h2" type="lines" locale={locale}>
        {title}
      </SplitReveal>
      {lead && (
        <Reveal y={24} delay={0.15}>
          <p className="sd-lead">{lead}</p>
        </Reveal>
      )}
    </div>
  );
}
