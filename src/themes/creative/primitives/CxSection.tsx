import type { CSSProperties, ReactNode } from 'react';
import { Cx } from '../boot.client';
import { BASE_CSS } from '../css/base.css';
import { CxStyle } from './CxStyle';
import { JsFlag } from './JsFlag';

type DataOrAria = { [k: `data-${string}` | `aria-${string}`]: string | undefined };

export type CxSectionProps = {
  /** Section key; becomes data-cx-section and the id of its stylesheet. */
  name: string;
  /** The section's own CSS (constant per section type). */
  css?: string;
  as?: 'section' | 'div';
  /** Mount the client island (reveals, behaviours). False = zero JavaScript. */
  island?: boolean;
  /** Break out of the page container to the full viewport width. */
  bleed?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & DataOrAria;

/**
 * Root of every creative section. Renders, in order: the motion flag script,
 * the base stylesheet, the section stylesheet, then the element carrying
 * data-cx-section, with the island as last child.
 */
export function CxSection({
  name,
  css,
  as = 'section',
  island = true,
  bleed = true,
  className,
  style,
  children,
  ...rest
}: CxSectionProps) {
  const Tag = as;
  const cls = [bleed ? 'cx-bleed' : '', className || ''].filter(Boolean).join(' ');
  return (
    <>
      <JsFlag />
      <CxStyle id="base" css={BASE_CSS} />
      {css ? <CxStyle id={name} css={css} /> : null}
      <Tag
        data-cx-section={name}
        className={cls || undefined}
        style={style}
        {...rest}
      >
        {children}
        {island && <Cx />}
      </Tag>
    </>
  );
}

/**
 * Assets for an EXISTING section that turned a creative option on: its own
 * root carries data-cx-section="" and renders this once. `island={false}`
 * when nothing needs JavaScript (emphasis only).
 */
export function CxAssets({ island = true }: { island?: boolean }) {
  return (
    <>
      <JsFlag />
      <CxStyle id="base" css={BASE_CSS} />
      {island && <Cx />}
    </>
  );
}
