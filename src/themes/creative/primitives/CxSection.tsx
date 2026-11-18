import type { CSSProperties, ReactNode } from 'react';
import { Cx } from '../boot.client';
import { BASE_CSS } from '../css/base.css';
import { sceneProps, sceneValue } from '../scene';
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
  scene?: unknown;
  sceneBg?: unknown;
  sceneText?: unknown;
  sceneAccent?: unknown;
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
  scene,
  sceneBg,
  sceneText,
  sceneAccent,
  className,
  style,
  children,
  ...rest
}: CxSectionProps) {
  const Tag = as;
  const sp = sceneProps(sceneValue(scene), { bg: sceneBg, text: sceneText, accent: sceneAccent });
  const cls = [bleed ? 'cx-bleed' : '', className || ''].filter(Boolean).join(' ');
  const merged = sp.style || style ? { ...sp.style, ...style } : undefined;
  return (
    <>
      <JsFlag />
      <CxStyle id="base" css={BASE_CSS} />
      {css ? <CxStyle id={name} css={css} /> : null}
      <Tag
        data-cx-section={name}
        data-cx-scene={sp['data-cx-scene']}
        className={cls || undefined}
        style={merged}
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
