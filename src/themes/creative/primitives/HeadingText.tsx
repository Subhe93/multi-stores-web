import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { isArabicScript, parseEmphasis, type Emphasis } from '../emphasis';

export interface HeadingTextProps {
  /** Output of headingLines(): lines joined by "\n". */
  text: string;
  /** 'intro' animates on load (CSS only), 'scroll' when the heading enters the viewport. */
  reveal?: 'none' | 'intro' | 'scroll';
  /** 'none' prints the `*…*` markers literally; otherwise the marked phrase becomes the accent. */
  emphasis?: Emphasis;
  /** Empty = the theme accent colour. */
  emphasisColor?: string;
  /** Start delay in seconds (words follow in a stagger). */
  delay?: number;
  /**
   * Intro pacing by author line: the lines of the heading enter one after
   * the other (0.12 s apart) and the words of one line almost together
   * (0.03 s apart), instead of one even word stagger.
   */
  byLine?: boolean;
}

// In steps of --cx-word-step (0.05 s): 0.12 s between lines, 0.03 s between words.
const LINE_STEPS = 2.4;
const WORD_STEPS = 0.6;

/**
 * The text of a heading, as children of the section's own heading element
 * (which keeps multilineStyle()). Lines stay separated by a literal "\n"
 * text node and words by real spaces, so textContent equals the input minus
 * the removed markers. Words are the smallest unit, for every script:
 * Arabic is never split into characters.
 */
export function HeadingText({ text, reveal = 'none', emphasis = 'none', emphasisColor, delay, byLine }: HeadingTextProps) {
  if (!text) return null;
  const split = reveal !== 'none';
  if (!split && emphasis === 'none') return <>{text}</>;

  let wordIndex = 0;
  let lineIndex = 0;
  let lineWord = 0;
  const words = (chunk: string, key: string): ReactNode => {
    if (!split) return chunk;
    // Odd entries are the whitespace runs: they stay text nodes.
    return chunk.split(/(\s+)/).map((piece, i) => {
      if (piece === '') return null;
      if (i % 2 === 1) return piece;
      const n = byLine ? +(lineIndex * LINE_STEPS + lineWord++ * WORD_STEPS).toFixed(2) : wordIndex++;
      return (
        <span className="cx-w" key={`${key}-${i}`}>
          <span className="cx-wi" style={{ '--cx-i': n } as CSSProperties}>
            {piece}
          </span>
        </span>
      );
    });
  };

  const lines = text.split('\n').map((line, li) => {
    const parts = emphasis === 'none' ? [{ text: line, em: false }] : parseEmphasis(line);
    return (
      <Fragment key={li}>
        {li > 0 ? '\n' : null}
        {parts.map((part, pi) => {
          const key = `${li}-${pi}`;
          if (!part.em) return <Fragment key={key}>{words(part.text, key)}</Fragment>;
          return (
            <em
              key={key}
              className="cx-em"
              data-cx-em={emphasis}
              data-text-look="heading"
              data-cx-script={isArabicScript(part.text) ? 'arabic' : undefined}
              style={{ color: emphasisColor || 'var(--theme-colors-accent)', fontSize: 'inherit' }}
            >
              {words(part.text, key)}
            </em>
          );
        })}
      </Fragment>
    );
  });

  if (!split) return <>{lines}</>;
  const style = typeof delay === 'number' && delay > 0 ? ({ '--cx-delay': `${delay}s` } as CSSProperties) : undefined;
  return (
    <span
      className="cx-ht"
      data-cx-intro={reveal === 'intro' ? 'words' : undefined}
      data-cx-reveal={reveal === 'scroll' ? 'words' : undefined}
      style={style}
    >
      {lines}
    </span>
  );
}
