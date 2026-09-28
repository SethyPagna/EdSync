/**
 * Engine-agnostic Studio scene model. Fabric is only a renderer for it.
 * Geometry is normalized to the page (0..1 of width/height) so any design
 * reflows across formats; colors are theme tokens so a theme swap is a recolor.
 */

export type ColorToken =
  | "bg"
  | "surface"
  | "surface2"
  | "text"
  | "muted"
  | "accent"
  | "accent2"
  | "accentSoft"
  | "onAccent"
  | "border"
  | "success"
  | "warning"
  | "danger";

/** A theme token name, a hex/rgb(a) color, or "transparent". */
export type Paint = ColorToken | "transparent" | (string & {});

export type TextStyleToken =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "small"
  | "caption"
  | "quote"
  | "stat"
  | "label";

export type ElementRole =
  | "title"
  | "subtitle"
  | "kicker"
  | "body"
  | "bullet"
  | "item-title"
  | "item-body"
  | "number"
  | "stat-value"
  | "stat-label"
  | "quote"
  | "author"
  | "caption"
  | "label"
  | "answer"
  | "media"
  | "icon"
  | "card"
  | "chip"
  | "shape"
  | "line"
  | "chart"
  | "table"
  | "deco";

export type ShapeKind =
  | "rect"
  | "rounded"
  | "circle"
  | "ellipse"
  | "pill"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "arrow"
  | "chevron"
  | "speech"
  | "blob"
  | "ring"
  | "line"
  | "arrow-line"
  | "dashed-line";

interface BaseElement {
  id: string;
  role: ElementRole;
  /** Layout slot this element fills (e.g. "title", "item-2-body"); kept across relayouts. */
  slot?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  name?: string;
  /** Elements sharing a group id move together. */
  group?: string;
  /** True once the user moved/resized/restyled it; relayout keeps user edits. */
  edited?: boolean;
}

export interface TextElement extends BaseElement {
  kind: "text";
  text: string;
  style: TextStyleToken;
  color?: Paint;
  /** Background fill behind the text box. */
  fill?: Paint;
  /** Font size in px at the deck's design size; overrides the style's size. */
  fontSize?: number;
  fontWeight?: number;
  /** "heading" | "body" resolve through the deck font pair; anything else is a family name. */
  fontFamily?: "heading" | "body" | (string & {});
  align?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  letterSpacing?: number;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  list?: "bullet" | "number";
  padding?: number;
  radius?: number;
  /** Shrink font (down to the style minimum) when text overflows the box. */
  autoFit?: boolean;
}

export interface ShapeElement extends BaseElement {
  kind: "shape";
  shape: ShapeKind;
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  radius?: number;
  dash?: number[];
  shadow?: boolean;
}

export interface ImageElement extends BaseElement {
  kind: "image";
  src: string;
  fit?: "cover" | "contain";
  radius?: number;
  /** Search hint for a placeholder the user (or AI) can fill later. */
  query?: string;
  placeholder?: boolean;
  mask?: "none" | "circle" | "rounded" | "blob" | "arch";
}

export interface IconElement extends BaseElement {
  kind: "icon";
  /** Id from the icon library (`src/lib/studio/library/icons.ts`). */
  icon: string;
  color?: Paint;
  fill?: Paint;
  strokeWidth?: number;
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartElement extends BaseElement {
  kind: "chart";
  chart: "bar" | "column" | "line" | "area" | "donut" | "pie" | "progress";
  data: ChartDatum[];
  color?: Paint;
  showLabels?: boolean;
}

export interface TableElement extends BaseElement {
  kind: "table";
  rows: string[][];
  header?: boolean;
  fill?: Paint;
  color?: Paint;
  stroke?: Paint;
}

export type SceneElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | IconElement
  | ChartElement
  | TableElement;

export type SceneElementKind = SceneElement["kind"];

export type Background =
  | { kind: "solid"; color: Paint }
  | { kind: "gradient"; from: Paint; to: Paint; angle: number; via?: Paint }
  | { kind: "image"; src: string; overlay?: Paint; overlayOpacity?: number }
  | {
      kind: "pattern";
      pattern: "dots" | "grid" | "lines" | "diagonal" | "waves" | "confetti";
      color: Paint;
      on: Paint;
    };

export type ContentKind =
  | "title"
  | "agenda"
  | "section"
  | "bullets"
  | "concept"
  | "steps"
  | "timeline"
  | "compare"
  | "stat"
  | "stats"
  | "quote"
  | "definition"
  | "glossary"
  | "question"
  | "quiz"
  | "activity"
  | "image"
  | "summary"
  | "closing";

export interface ContentItem {
  title: string;
  body?: string;
  icon?: string;
}

export interface ContentQuestion {
  prompt: string;
  choices?: string[];
  /** Index into choices, boolean for true/false, or the expected text. */
  answer?: number | boolean | string;
  explanation?: string;
}

/** Semantic slide/page content. Layouts turn this into elements. */
export interface SlideContent {
  kind: ContentKind;
  title: string;
  subtitle?: string;
  kicker?: string;
  body?: string;
  bullets?: string[];
  items?: ContentItem[];
  steps?: string[];
  compare?: {
    a: { label: string; points: string[] };
    b: { label: string; points: string[] };
  };
  stats?: { value: string; label: string }[];
  quote?: { text: string; author?: string };
  question?: ContentQuestion;
  terms?: { term: string; definition: string }[];
  imageQuery?: string;
  image?: string;
  icon?: string;
  notes?: string;
  /** Marks continuation pages produced by overflow splitting. */
  continued?: boolean;
}

export interface ScenePage {
  id: string;
  name?: string;
  layoutId?: string;
  content?: SlideContent;
  background: Background;
  elements: SceneElement[];
  notes?: string;
  hidden?: boolean;
  transition?: "none" | "fade" | "slide" | "zoom";
}

export type DeckKind = "slides" | "doc" | "design" | "worksheet" | "social";

export interface SceneDeck {
  v: 2;
  id: string;
  title: string;
  kind: DeckKind;
  formatId: string;
  width: number;
  height: number;
  themeId: string;
  fontPairId?: string;
  /** Per-deck brand color overrides on top of the theme. */
  colorOverrides?: Partial<Record<ColorToken, string>>;
  pages: ScenePage[];
  /** Seed for deterministic layout rotation/shuffles. */
  seed?: number;
}

export interface TextStyleDef {
  /** Size in px for a page whose shorter side is 720px; scaled by min(w,h)/720. */
  size: number;
  minSize: number;
  weight: number;
  lineHeight: number;
  letterSpacing?: number;
  font: "heading" | "body";
  uppercase?: boolean;
  italic?: boolean;
}

export interface FontPair {
  id: string;
  name: string;
  heading: string;
  body: string;
  headingWeight: number;
  bodyWeight: number;
  /** Google Fonts css2 family query, e.g. "Fraunces:wght@400;600". */
  googleFamilies: string[];
  mood: string[];
}

export interface DeckTheme {
  id: string;
  name: string;
  mode: "light" | "dark";
  colors: Record<ColorToken, string>;
  fontPairId: string;
  /** Corner radius in px at 720px base. */
  radius: number;
  /** Default page background. */
  background: Background;
  /** Background for title/section pages. */
  heroBackground?: Background;
  /** Decorative motif the layouts may add as "deco" elements. */
  decor: "none" | "blobs" | "lines" | "dots" | "frame" | "corner" | "grain" | "waves";
  cardStyle: "flat" | "outline" | "soft" | "shadow" | "glass";
  tags: string[];
}

export interface FormatDef {
  id: string;
  name: string;
  group: "presentation" | "document" | "social" | "print" | "board";
  kind: DeckKind;
  width: number;
  height: number;
}

export interface LayoutContext {
  width: number;
  height: number;
  theme: DeckTheme;
  fontPair: FontPair;
  measure: TextMeasurer;
  /** Deterministic seed for tie-breaks/rotation. */
  seed: number;
  /** Layout ids used on the previous pages, newest last, to avoid repeats. */
  recent: string[];
  newId: () => string;
}

export interface LayoutDef {
  id: string;
  name: string;
  kinds: ContentKind[];
  orientation: "landscape" | "portrait" | "any";
  /** 0 = unsuitable; higher = better fit for this content. */
  score: (content: SlideContent, ctx: LayoutContext) => number;
  build: (content: SlideContent, ctx: LayoutContext) => {
    elements: SceneElement[];
    background?: Background;
    /** Content that did not fit and should continue on another page. */
    overflow?: SlideContent;
  };
}

export interface TextMeasureRequest {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
  /** Box width in px. */
  maxWidth: number;
}

export type TextMeasurer = (request: TextMeasureRequest) => {
  height: number;
  lines: number;
};
