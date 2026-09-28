/** Layouts that sit on the theme's hero background (title/section/closing style pages). */
export const HERO_LAYOUT_IDS: readonly string[] = [
  "title-center",
  "title-left-image",
  "title-big-type",
  "section-number",
  "closing-thanks",
  "poster-hero",
  "social-tip",
  "social-quote",
];

/** Fallback layout that can render any content (used when nothing scores). */
export const FALLBACK_LAYOUT_ID = "bullets-simple";

/** Flow layout that renders every field; used to guarantee progress on continuation pages. */
export const FLOW_LAYOUT_ID = "doc-article";
