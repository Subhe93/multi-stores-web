// Section "promise-band": up to three promises under a small heading and a
// horizon line. Complete and visible without JavaScript. With motion the
// `promise` behaviour draws the line, lets a small sun rise on it with a
// gleam running along, draws the icons and lifts the titles through their
// masks when the band enters; while the page scrolls the sun walks along
// the horizon (mirrored in right-to-left stores). Hover is CSS only.
//
// Every word, icon choice and colour is a setting; the platform ships none.

import { useId, type CSSProperties } from 'react';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { PB_GROUPS, PB_PREFIX, PB_TONES, PROMISE_BAND_CSS } from '../css/promiseBand.css';
import { CxSection, EmptyState } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { heroMedia, scriptOf, str, unoptimized } from './heroShared';
import { isPromiseIcon, PromiseIcon } from './promiseIcons';
import { toneVars } from './tones';

const KEY = 'promise-band';
const MAX_ITEMS = 3;

export interface PromiseItem {
  title: string;
  text: string;
  /** A built-in icon name, or '' when an own image is used or nothing is set. */
  icon: string;
  image: string;
}

/** The usable items of the content: a title or a text, at most three. */
export function readPromises(raw: unknown): PromiseItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PromiseItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = str(r.title);
    const text = str(r.text);
    if (!title && !text) continue;
    const image = r.icon === 'custom' ? heroMedia(r.icon_image) : '';
    const icon = image ? '' : isPromiseIcon(r.icon) ? (r.icon as string) : r.icon === 'custom' ? '' : 'book';
    out.push({ title, text, icon, image });
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

function PromiseBand({ settings, content, builderPreview }: SectionRenderProps) {
  const headingId = useId();
  const heading = str(content.heading);
  const items = readPromises(content.items);
  if (!heading && !items.length) return builderPreview ? <EmptyState name={KEY} /> : null;
  const numbers = settings.numbers !== false;
  const style = {
    ...toneVars(PB_PREFIX, PB_TONES, PB_GROUPS, settings),
    '--cx-pm-n': String(Math.max(1, items.length)),
  } as CSSProperties;

  return (
    <CxSection
      name={KEY}
      css={PROMISE_BAND_CSS}
      className="cx-pm"
      style={style}
      aria-labelledby={heading ? headingId : undefined}
      data-cx-behavior="promise"
    >
      <div className="cx-pm-in">
        {heading ? (
          <Heading level={headingTag(settings.heading_level, 'h2')} id={headingId} className="cx-pm-eb" data-cx-pm-fade="">
            <span className="cx-pm-ebt" data-cx-script={scriptOf(heading)}>
              {heading}
            </span>
          </Heading>
        ) : null}
        <div className="cx-pm-horizon" aria-hidden="true">
          <span className="cx-pm-hline" />
          <span className="cx-pm-gleam" />
          <span className="cx-pm-hsun" />
        </div>
        {items.length ? (
          <ul className="cx-pm-list">
            {items.map((item, i) => (
              <li className="cx-pm-item" key={i}>
                <span className="cx-pm-div" aria-hidden="true" />
                {numbers ? (
                  <span className="cx-pm-num" data-cx-pm-fade="" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                ) : null}
                <span className="cx-pm-iconwrap" aria-hidden="true">
                  <span className="cx-pm-glow" />
                  {item.image ? (
                    <span className="cx-pm-img" data-cx-pm-img="">
                      <StoreImage
                        src={item.image}
                        alt=""
                        fill
                        sizes="54px"
                        unoptimized={unoptimized(item.image)}
                        style={{ objectFit: 'contain' }}
                      />
                    </span>
                  ) : item.icon ? (
                    <PromiseIcon name={item.icon} />
                  ) : null}
                </span>
                <div className="cx-pm-body">
                  {item.title ? (
                    <h3 className="cx-pm-title">
                      <span className="cx-pm-mask">
                        <span data-cx-pm-mask="">
                          <span className="cx-pm-tt" data-cx-script={scriptOf(item.title)}>
                            {item.title}
                          </span>
                        </span>
                      </span>
                      <span className="cx-pm-uline" aria-hidden="true" />
                    </h3>
                  ) : null}
                  {item.text ? (
                    <p className="cx-pm-text" data-cx-pm-fade="">
                      <span className="cx-pm-xt" data-cx-script={scriptOf(item.text)}>
                        {item.text}
                      </span>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </CxSection>
  );
}

export const promiseBandSection = defineCreativeSection(KEY, PromiseBand);
