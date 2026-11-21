// Section "script-manifesto": one sentence, said in each of the store's
// languages, with the visitor's own language in ink.
//
// All lines stay on the page at once, each in its own script, font and
// direction, separated by hairlines with a small language label. The line
// whose `lang` matches the page locale is strong (and first, by default);
// the others are quiet. Sizes are medium on purpose.
//
// Every word, the mark and the colours are owner content. The lines are NOT
// translated per locale (the same lines show everywhere), so they are stored
// with the settings; `content.lines` is read as a fallback.
//
// Each sentence carries its own `lang` and `dir`: a right-to-left sentence
// on a left-to-right page aligns to its own start. Nothing is mirrored, and
// Arabic is only ever split into words (MotionText).
//
// No JavaScript of its own (island off): motion comes from the store runtime
// through the `motion` prop. Without it there is no reveal attribute at all.

import type { CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import { StoreImage } from '@/components/StoreImage';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { SCRIPT_MANIFESTO_CSS } from '../css/scriptManifesto.css';
import { isArabicScript } from '../emphasis';
import { CxSection } from '../primitives/CxSection';
import { EmptyState } from '../primitives/EmptyState';
import { MotionText } from '../primitives/Motion';
import { drift, fade, hover, line, rise } from '../recipes';
import { entry, MANIFESTO_MAX_LINES } from '../schemas/script-manifesto.schema';

const KEY = 'script-manifesto';

/** BCP 47 shape accepted for a line's `lang`; anything else is omitted. */
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** Primary language subtags written right to left. */
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur', 'ckb']);
/** Colour values allowed into an inline custom property. */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-zA-Z.,%/\s-]{1,60}\)|[a-zA-Z]{3,24})$/;

export interface ManifestoLine {
  text: string;
  label: string;
  /** Validated language tag, or undefined. */
  lang?: string;
  dir: 'ltr' | 'rtl';
  /** The text is in Arabic script (font, line height, words-only motion). */
  arabic: boolean;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const base = (tag: string): string => tag.toLowerCase().split('-')[0];

/** A valid language tag, else undefined. */
export function manifestoLang(raw: unknown): string | undefined {
  const tag = str(raw);
  return LANG_RE.test(tag) ? tag : undefined;
}

/**
 * Direction of a sentence: the stored value when it is ltr or rtl; "auto"
 * follows the language (ar, fa, he, ur, ckb are right to left) and, without
 * a language, the script of the text.
 */
export function manifestoDir(rawDir: unknown, lang: string | undefined, text: string): 'ltr' | 'rtl' {
  if (rawDir === 'ltr' || rawDir === 'rtl') return rawDir;
  if (lang) return RTL_LANGS.has(base(lang)) ? 'rtl' : 'ltr';
  return isArabicScript(text) ? 'rtl' : 'ltr';
}

/** The filled lines, at most four, in stored order. */
export function manifestoLines(raw: unknown): ManifestoLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ManifestoLine[] = [];
  for (const row of raw) {
    if (out.length >= MANIFESTO_MAX_LINES) break;
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const text = str(r.text);
    if (!text) continue;
    const lang = manifestoLang(r.lang);
    out.push({ text, label: str(r.label), lang, dir: manifestoDir(r.dir, lang, text), arabic: isArabicScript(text) });
  }
  return out;
}

/** Index of the line in the page locale; the first line when none matches. */
export function manifestoActiveIndex(lines: ManifestoLine[], locale: string): number {
  const want = base(str(locale));
  const hit = want ? lines.findIndex((l) => l.lang !== undefined && base(l.lang) === want) : -1;
  return hit < 0 ? 0 : hit;
}

const safeColor = (v: unknown): string | undefined => {
  const c = str(v);
  return c && COLOR_RE.test(c) ? c : undefined;
};

function ScriptManifesto({ settings, content, locale, primaryLocale, pathPrefix, builderPreview, motion }: SectionRenderProps) {
  const stored = manifestoLines(Array.isArray(settings.lines) ? settings.lines : content.lines);
  if (stored.length === 0) return builderPreview ? <EmptyState name={KEY} /> : null;

  const activeAt = manifestoActiveIndex(stored, locale);
  const active = stored[activeAt];
  // The active line moves to the top; the others keep their order.
  const rows = settings.active_first === false ? stored : [active, ...stored.filter((_, i) => i !== activeAt)];

  const vars: Record<string, string> = {};
  const bg = safeColor(settings.bg_color);
  const fg = safeColor(settings.text_color);
  const ac = safeColor(settings.accent_color);
  if (bg) vars['--cx-sm-bg'] = bg;
  if (fg) vars['--cx-sm-fg'] = fg;
  if (ac) vars['--cx-sm-ac'] = ac;

  const markRaw = str(settings.mark_image);
  // Inline artwork (a data: image) is used as it is; resolveMediaUrl would
  // prefix it with the media origin.
  const mark = !markRaw ? '' : markRaw.toLowerCase().startsWith('data:image/') ? markRaw : resolveMediaUrl(markRaw);
  const ctaText = str(content.cta_text);
  const ActiveTag = settings.heading_level === 'h2' ? 'h2' : 'p';

  return (
    <CxSection name={KEY} css={SCRIPT_MANIFESTO_CSS} island={false} className="cx-sm" style={vars as CSSProperties}>
      <div className="cx-sm-in">
        {mark ? (
          // Decoration: empty alt, never mirrored. Entrance and scroll drift
          // sit on two elements (an animation and an inline transform).
          <div className="cx-sm-mark" aria-hidden="true" {...fade(motion)}>
            <div className="cx-sm-mark-in" {...drift(motion, { y: -4 })}>
              <StoreImage src={mark} alt="" width={40} height={40} sizes="40px" unoptimized={isSvgSrc(mark)} />
            </div>
          </div>
        ) : null}
        <div className="cx-sm-stack">
          <ul className="cx-sm-list">
            {rows.map((row, n) => {
              const isActive = row === active;
              const Tag = isActive ? ActiveTag : 'p';
              return (
                <li
                  key={n}
                  className="cx-sm-row"
                  data-active={isActive ? '' : undefined}
                  data-nolabel={row.label ? undefined : ''}
                  // The accent bar follows its sentence: the row's beat plus 0.8 s.
                  style={
                    isActive && motion ? ({ '--cx-sm-bd': `${(n * 0.2 + 0.8).toFixed(1)}s` } as CSSProperties) : undefined
                  }
                >
                  <span className="cx-sm-rule" aria-hidden="true" {...line(motion, { d: n * 2 })} />
                  {row.label ? (
                    <span
                      className="cx-sm-label"
                      data-cx-script={isArabicScript(row.label) ? 'arabic' : undefined}
                      {...fade(motion, { d: n * 2 + 1 })}
                    >
                      {row.label}
                    </span>
                  ) : null}
                  <div className="cx-sm-cell">
                    {isActive ? <span className="cx-sm-bar" aria-hidden="true" /> : null}
                    <Tag
                      className="cx-sm-text"
                      lang={row.lang}
                      dir={row.dir}
                      data-text-look="heading"
                      data-cx-script={row.arabic ? 'arabic' : undefined}
                    >
                      <MotionText motion={motion} text={row.text} d={n * 2} />
                    </Tag>
                  </div>
                </li>
              );
            })}
          </ul>
          <span className="cx-sm-rule" data-end="" aria-hidden="true" {...line(motion, { d: rows.length * 2 })} />
        </div>
        {ctaText ? (
          <div className="cx-sm-cta">
            <a
              className="cx-sm-link"
              href={sectionHref(settings.cta_url, { locale, primaryLocale, pathPrefix })}
              {...rise(motion, { i: 4 })}
              {...hover(motion, 'underline')}
            >
              {ctaText}
            </a>
          </div>
        ) : null}
      </div>
    </CxSection>
  );
}

// Same shape defineCreativeSection() returns, built from this section's own
// schema entry so the file does not depend on the shared registry.
export const scriptManifestoSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: ScriptManifesto,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
