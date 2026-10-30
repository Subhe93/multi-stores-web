// Builder-selectable HTML tag of a section's texts, for the page outline /
// SEO: `settings.heading_level` (heading), `settings.subheading_tag` and
// `settings.eyebrow_tag`. Only the element changes; each text keeps its
// visual style (see Heading). Unset or unknown keeps the section's default.

export const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'] as const;

export type TextTag = (typeof TEXT_TAGS)[number];
/** @deprecated kept for older imports; same as TextTag. */
export type HeadingTag = TextTag;

export function headingTag(value: unknown, fallback: TextTag): TextTag {
  return typeof value === 'string' && (TEXT_TAGS as readonly string[]).includes(value)
    ? (value as TextTag)
    : fallback;
}

/** Same as headingTag; reads better for subheadings / eyebrows. */
export const textTag = headingTag;
