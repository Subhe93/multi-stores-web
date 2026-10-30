// Builder-selectable heading level (`settings.heading_level`). Only the HTML
// tag changes, for the page outline / SEO; each section keeps its own visual
// size. Unset (or unknown) keeps the section's default tag.

export type HeadingTag = 'h1' | 'h2' | 'h3';

export function headingTag(value: unknown, fallback: HeadingTag): HeadingTag {
  return value === 'h1' || value === 'h2' || value === 'h3' ? value : fallback;
}
