import type {
  ChartElement,
  ElementRole,
  IconElement,
  ImageElement,
  Paint,
  SceneElement,
  ShapeElement,
  ShapeKind,
  TableElement,
  TextElement,
  TextStyleToken,
} from "@/lib/studio/scene";
import { SAMPLE_CHART_DATA } from "./charts";

export type ElementKitCategory =
  | "callouts"
  | "badges"
  | "steps"
  | "frames"
  | "lines"
  | "sticky"
  | "speech"
  | "quiz"
  | "trackers"
  | "tables"
  | "charts";

export interface ElementKitOptions {
  /** Top-left of the kit, normalized to the page (0..1). */
  x: number;
  y: number;
  /** Size multiplier; 1 is the default insert size. */
  scale?: number;
  newId: () => string;
  /** Page size in px (defaults to 1280×720); keeps circles round and text sized. */
  width?: number;
  height?: number;
}

export interface ElementKit {
  id: string;
  name: string;
  category: ElementKitCategory;
  keywords: readonly string[];
  build: (options: ElementKitOptions) => SceneElement[];
}

export const ELEMENT_CATEGORIES: readonly { id: ElementKitCategory; name: string }[] = [
  { id: "callouts", name: "Callouts" },
  { id: "badges", name: "Badges & chips" },
  { id: "steps", name: "Steps" },
  { id: "frames", name: "Frames" },
  { id: "lines", name: "Lines & dividers" },
  { id: "sticky", name: "Sticky notes" },
  { id: "speech", name: "Speech bubbles" },
  { id: "quiz", name: "Quiz" },
  { id: "trackers", name: "Progress & lists" },
  { id: "tables", name: "Tables" },
  { id: "charts", name: "Charts" },
];

/** [x, y, w, h] in units of 1% of the page's shorter side. */
type Box = [number, number, number, number];

interface TextOptions {
  role?: ElementRole;
  style?: TextStyleToken;
  /** Font size in units (1% of the shorter side). */
  size: number;
  color?: Paint;
  weight?: number;
  align?: TextElement["align"];
  verticalAlign?: TextElement["verticalAlign"];
  italic?: boolean;
  uppercase?: boolean;
  font?: TextElement["fontFamily"];
}

interface ShapeOptions {
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  radius?: number;
  dash?: number[];
  shadow?: boolean;
  role?: ElementRole;
  opacity?: number;
}

const r4 = (value: number) => Math.round(value * 10000) / 10000;

function kitBuilder(options: ElementKitOptions) {
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const unit = (Math.min(width, height) / 100) * (options.scale ?? 1);
  const group = options.newId();
  const elements: SceneElement[] = [];

  const place = ([ux, uy, uw, uh]: Box) => ({
    x: r4(options.x + (ux * unit) / width),
    y: r4(options.y + (uy * unit) / height),
    w: r4((uw * unit) / width),
    h: r4((uh * unit) / height),
  });
  const px = (units: number) => Math.round(units * unit * 10) / 10;
  const base = (role: ElementRole, box: Box) => ({ id: options.newId(), role, group, ...place(box) });

  return {
    text(box: Box, value: string, opts: TextOptions): TextElement {
      const element: TextElement = {
        ...base(opts.role ?? "body", box),
        kind: "text",
        text: value,
        style: opts.style ?? "body",
        color: opts.color ?? "text",
        fontSize: px(opts.size),
        align: opts.align ?? "left",
        verticalAlign: opts.verticalAlign ?? "middle",
      };
      if (opts.weight) element.fontWeight = opts.weight;
      if (opts.italic) element.italic = true;
      if (opts.uppercase) element.uppercase = true;
      if (opts.font) element.fontFamily = opts.font;
      elements.push(element);
      return element;
    },
    shape(box: Box, shape: ShapeKind, opts: ShapeOptions = {}): ShapeElement {
      const element: ShapeElement = { ...base(opts.role ?? "shape", box), kind: "shape", shape };
      if (opts.fill) element.fill = opts.fill;
      if (opts.stroke) element.stroke = opts.stroke;
      if (opts.strokeWidth) element.strokeWidth = px(opts.strokeWidth);
      if (opts.radius !== undefined) element.radius = px(opts.radius);
      if (opts.dash) element.dash = opts.dash.map(px);
      if (opts.shadow) element.shadow = true;
      if (opts.opacity !== undefined) element.opacity = opts.opacity;
      elements.push(element);
      return element;
    },
    icon(box: Box, icon: string, color: Paint = "accent", strokeWidth = 2): IconElement {
      const element: IconElement = { ...base("icon", box), kind: "icon", icon, color, strokeWidth };
      elements.push(element);
      return element;
    },
    image(box: Box, mask: NonNullable<ImageElement["mask"]>, query: string, radius?: number): ImageElement {
      const element: ImageElement = { ...base("media", box), kind: "image", src: "", placeholder: true, fit: "cover", mask, query };
      if (radius !== undefined) element.radius = px(radius);
      elements.push(element);
      return element;
    },
    chart(box: Box, chart: ChartElement["chart"]): ChartElement {
      const element: ChartElement = {
        ...base("chart", box),
        kind: "chart",
        chart,
        data: SAMPLE_CHART_DATA[chart].map((datum) => ({ ...datum })),
        color: "accent",
        showLabels: true,
      };
      elements.push(element);
      return element;
    },
    table(box: Box, rows: string[][]): TableElement {
      const element: TableElement = {
        ...base("table", box),
        kind: "table",
        rows: rows.map((row) => [...row]),
        header: true,
        fill: "surface",
        color: "text",
        stroke: "border",
      };
      elements.push(element);
      return element;
    },
    done: () => fitToPage(elements),
  };
}

type Kit = ReturnType<typeof kitBuilder>;

/** Shrinks and nudges a group so every element stays inside the page (0..1). */
function fitToPage(elements: SceneElement[]): SceneElement[] {
  if (elements.length === 0) return elements;
  const bounds = () => ({
    minX: Math.min(...elements.map((e) => e.x)),
    minY: Math.min(...elements.map((e) => e.y)),
    maxX: Math.max(...elements.map((e) => e.x + e.w)),
    maxY: Math.max(...elements.map((e) => e.y + e.h)),
  });
  const first = bounds();
  const factor = Math.min(1, 0.96 / (first.maxX - first.minX || 1), 0.96 / (first.maxY - first.minY || 1));
  if (factor < 1) {
    for (const element of elements) {
      element.x = first.minX + (element.x - first.minX) * factor;
      element.y = first.minY + (element.y - first.minY) * factor;
      element.w *= factor;
      element.h *= factor;
      if (element.kind === "text" && element.fontSize) element.fontSize = Math.round(element.fontSize * factor * 10) / 10;
      if (element.kind === "shape" && element.strokeWidth) element.strokeWidth *= factor;
    }
  }
  const next = bounds();
  const dx = next.maxX > 1 ? 1 - next.maxX : next.minX < 0 ? -next.minX : 0;
  const dy = next.maxY > 1 ? 1 - next.maxY : next.minY < 0 ? -next.minY : 0;
  for (const element of elements) {
    element.x = r4(Math.max(0, element.x + dx));
    element.y = r4(Math.max(0, element.y + dy));
    element.w = r4(Math.min(element.w, 1 - element.x));
    element.h = r4(Math.min(element.h, 1 - element.y));
  }
  return elements;
}

function kit(
  id: string,
  name: string,
  category: ElementKitCategory,
  keywords: string,
  draw: (k: Kit) => void,
): ElementKit {
  return {
    id,
    name,
    category,
    keywords: keywords.split(" "),
    build: (options) => {
      const k = kitBuilder(options);
      draw(k);
      return k.done();
    },
  };
}

function callout(id: string, name: string, keywords: string, icon: string, label: string, body: string, fill: Paint, accent: Paint, stroke?: Paint): ElementKit {
  return kit(id, name, "callouts", keywords, (k) => {
    k.shape([0, 0, 62, 18], "rounded", { fill, stroke, strokeWidth: stroke ? 0.3 : undefined, radius: 2.2, role: "card" });
    k.shape([0, 0, 1.1, 18], "rect", { fill: accent, role: "deco" });
    k.icon([4, 3.2, 5, 5], icon, accent);
    k.text([11, 2.6, 46, 4.6], label, { role: "label", style: "label", size: 2.1, weight: 600, uppercase: true });
    k.text([11, 7.4, 48, 8.4], body, { role: "body", style: "small", size: 2.5, verticalAlign: "top" });
  });
}

const STICKY_COLORS: [string, string, string][] = [
  ["yellow", "Yellow", "#FDE68A"],
  ["pink", "Pink", "#FBCFE8"],
  ["blue", "Blue", "#BFDBFE"],
  ["green", "Green", "#BBF7D0"],
  ["orange", "Orange", "#FED7AA"],
];

const FRAMES: [string, string, NonNullable<ImageElement["mask"]>, Box, number | undefined][] = [
  ["frame-circle", "Circle frame", "circle", [0, 0, 30, 30], undefined],
  ["frame-rounded", "Rounded frame", "rounded", [0, 0, 42, 28], 3],
  ["frame-arch", "Arch frame", "arch", [0, 0, 28, 38], undefined],
  ["frame-blob", "Blob frame", "blob", [0, 0, 34, 32], undefined],
];

export const ELEMENT_KITS: readonly ElementKit[] = [
  callout("callout-tip", "Tip", "tip hint advice idea", "lightbulb", "Tip", "Short, practical advice for learners.", "accentSoft", "accent"),
  callout("callout-note", "Note", "note info remember", "info", "Note", "Something worth remembering later.", "surface2", "muted"),
  callout("callout-warning", "Watch out", "warning caution mistake misconception", "triangle-alert", "Watch out", "A common mistake to avoid.", "surface", "warning", "warning"),
  kit("callout-definition", "Definition", "callouts", "definition term vocabulary glossary word", (k) => {
    k.shape([0, 0, 62, 20], "rounded", { fill: "surface", stroke: "border", strokeWidth: 0.3, radius: 2.2, role: "card" });
    k.shape([0, 0, 62, 1.1], "rect", { fill: "accent", role: "deco" });
    k.text([4, 3.2, 40, 6], "Photosynthesis", { role: "item-title", style: "heading", size: 4, font: "heading" });
    k.text([44, 3.2, 14, 6], "noun", { role: "caption", style: "caption", size: 2.1, color: "muted", italic: true, align: "right" });
    k.text([4, 10, 54, 8], "How plants turn light, water and carbon dioxide into food.", { style: "small", size: 2.5, verticalAlign: "top" });
  }),
  kit("callout-key-idea", "Key idea", "callouts", "key idea big idea main takeaway", (k) => {
    k.shape([0, 0, 60, 16], "rounded", { fill: "accent", radius: 2.2, role: "card" });
    k.icon([4, 4.5, 7, 7], "sparkles", "onAccent");
    k.text([14, 2.6, 42, 4.2], "Key idea", { role: "label", style: "label", size: 2.1, color: "onAccent", weight: 600, uppercase: true });
    k.text([14, 6.6, 43, 7], "Energy is never lost, only changed.", { role: "body", style: "subheading", size: 3.1, color: "onAccent", weight: 600 });
  }),
  kit("quote-block", "Quote", "callouts", "quote citation saying", (k) => {
    k.icon([0, 0, 7, 7], "quote", "accent");
    k.text([0, 8, 62, 14], "The more that you read, the more things you will know.", { role: "quote", style: "quote", size: 4.2, font: "heading", verticalAlign: "top" });
    k.text([0, 23, 40, 4], "— Dr. Seuss", { role: "author", style: "caption", size: 2.3, color: "muted" });
  }),
  kit("stat-card", "Stat card", "callouts", "stat number metric big number percent", (k) => {
    k.shape([0, 0, 30, 22], "rounded", { fill: "surface", stroke: "border", strokeWidth: 0.3, radius: 2.2, role: "card" });
    k.text([3, 2.5, 24, 11], "87%", { role: "stat-value", style: "stat", size: 9, color: "accent", font: "heading", weight: 700 });
    k.text([3, 14, 24, 5.5], "of students improved", { role: "stat-label", style: "small", size: 2.3, color: "muted", verticalAlign: "top" });
  }),

  kit("badge-new", "New badge", "badges", "badge new label pill", (k) => {
    k.shape([0, 0, 14, 5.6], "pill", { fill: "accent", role: "chip" });
    k.text([0, 0, 14, 5.6], "New", { role: "label", style: "label", size: 2.3, color: "onAccent", weight: 600, align: "center" });
  }),
  kit("chip-outline", "Outline chip", "badges", "chip tag outline chapter", (k) => {
    k.shape([0, 0, 20, 5.6], "pill", { fill: "transparent", stroke: "accent", strokeWidth: 0.3, role: "chip" });
    k.text([0, 0, 20, 5.6], "Chapter 3", { role: "label", style: "small", size: 2.3, color: "text", weight: 600, align: "center" });
  }),
  kit("badge-level", "Level badge", "badges", "level number badge circle", (k) => {
    k.shape([0, 0, 12, 12], "circle", { fill: "accent", role: "chip" });
    k.text([0, 0, 12, 12], "1", { role: "number", style: "heading", size: 5.4, color: "onAccent", weight: 700, align: "center", font: "heading" });
  }),
  kit("tag-row", "Subject tags", "badges", "tags chips subjects row", (k) => {
    ["Reading", "Writing", "Math"].forEach((label, index) => {
      k.shape([index * 17, 0, 15.5, 5.4], "pill", { fill: "surface2", role: "chip" });
      k.text([index * 17, 0, 15.5, 5.4], label, { role: "label", style: "small", size: 2.2, weight: 500, align: "center" });
    });
  }),
  kit("badge-award", "Award badge", "badges", "award medal achievement ribbon", (k) => {
    k.shape([0, 0, 14, 14], "circle", { fill: "accentSoft", stroke: "accent", strokeWidth: 0.4, role: "chip" });
    k.icon([3.5, 3.5, 7, 7], "award", "accent");
  }),

  kit("steps-3", "3 steps", "steps", "steps process sequence numbered horizontal", (k) => {
    const steps: [string, string][] = [
      ["Plan", "Set a goal"],
      ["Do", "Try it out"],
      ["Review", "Reflect and fix"],
    ];
    steps.forEach(([title, body], index) => {
      const x = index * 25;
      if (index > 0) k.shape([x - 15.5, 3.5, 14.5, 1], "line", { stroke: "border", strokeWidth: 0.35, role: "line" });
      k.shape([x, 0, 8, 8], "circle", { fill: "accent", role: "shape" });
      k.text([x, 0, 8, 8], String(index + 1), { role: "number", style: "subheading", size: 3.4, color: "onAccent", weight: 700, align: "center" });
      k.text([x, 10, 22, 4.4], title, { role: "item-title", style: "subheading", size: 3, weight: 600 });
      k.text([x, 14.6, 22, 5], body, { role: "item-body", style: "small", size: 2.3, color: "muted", verticalAlign: "top" });
    });
  }),
  kit("steps-4-vertical", "4 steps", "steps", "steps process numbered vertical list", (k) => {
    ["Read the question", "Underline key words", "Solve step by step", "Check your answer"].forEach((title, index) => {
      const y = index * 11;
      if (index < 3) k.shape([3.2, y + 7.6, 0.6, 3], "rect", { fill: "border", role: "line" });
      k.shape([0, y, 7, 7], "circle", { fill: "accent", role: "shape" });
      k.text([0, y, 7, 7], String(index + 1), { role: "number", style: "subheading", size: 3, color: "onAccent", weight: 700, align: "center" });
      k.text([10, y, 44, 7], title, { role: "item-title", style: "body", size: 2.8, weight: 500 });
    });
  }),
  kit("process-chevrons", "Process arrows", "steps", "process chevrons flow arrows stages", (k) => {
    ["Observe", "Question", "Test", "Conclude"].forEach((label, index) => {
      k.shape([index * 17, 0, 18, 8], "chevron", { fill: "accent", role: "shape" });
      k.text([index * 17 + 3, 0, 12, 8], label, { role: "label", style: "small", size: 2.2, color: "onAccent", weight: 600, align: "center" });
    });
  }),

  ...FRAMES.map(([id, name, mask, box, radius]) =>
    kit(id, name, "frames", `frame image photo ${mask} mask`, (k) => {
      k.image(box, mask, "classroom", radius);
    }),
  ),
  kit("frame-polaroid", "Photo card", "frames", "polaroid photo card caption", (k) => {
    k.shape([0, 0, 30, 35], "rect", { fill: "#FFFFFF", shadow: true, role: "card" });
    k.image([2, 2, 26, 24], "none", "field trip");
    k.text([2, 27.5, 26, 5], "Field trip", { role: "caption", style: "caption", size: 2.4, color: "#111418", align: "center", font: "Caveat" });
  }),

  kit("line-solid", "Line", "lines", "line divider rule", (k) => {
    k.shape([0, 0, 50, 2], "line", { stroke: "border", strokeWidth: 0.35, role: "line" });
  }),
  kit("line-dashed", "Dashed line", "lines", "dashed line divider blank", (k) => {
    k.shape([0, 0, 50, 2], "dashed-line", { stroke: "muted", strokeWidth: 0.35, dash: [1.4, 1.1], role: "line" });
  }),
  kit("line-arrow", "Arrow", "lines", "arrow connector pointer flow", (k) => {
    k.shape([0, 0, 36, 4], "arrow-line", { stroke: "accent", strokeWidth: 0.5, role: "line" });
  }),
  kit("divider-dots", "Dot divider", "lines", "dots divider separator", (k) => {
    [0, 1, 2].forEach((index) => k.shape([index * 4, 0, 1.6, 1.6], "circle", { fill: "accent", role: "deco" }));
  }),
  kit("divider-accent", "Accent bar", "lines", "accent bar underline title rule", (k) => {
    k.shape([0, 0, 10, 1], "pill", { fill: "accent", role: "deco" });
  }),

  ...STICKY_COLORS.map(([key, name, color]) =>
    kit(`sticky-${key}`, `${name} sticky`, "sticky", `sticky note post-it ${key} brainstorm`, (k) => {
      k.shape([0, 0, 24, 24], "rect", { fill: color, shadow: true, role: "card" });
      k.text([2.5, 2.5, 19, 19], "Write an idea…", { role: "body", style: "body", size: 2.8, color: "#1F2937", verticalAlign: "top" });
    }),
  ),

  kit("speech-bubble", "Speech bubble", "speech", "speech bubble talk dialog say", (k) => {
    k.shape([0, 0, 36, 24], "speech", { fill: "surface", stroke: "border", strokeWidth: 0.3, role: "shape" });
    k.text([3, 2.5, 30, 14], "What do you think?", { role: "body", style: "body", size: 2.9, align: "center" });
  }),
  kit("thought-bubble", "Thought bubble", "speech", "thought bubble think wonder", (k) => {
    k.shape([0, 0, 36, 20], "ellipse", { fill: "surface2", role: "shape" });
    k.shape([5, 20.5, 4.4, 4.4], "circle", { fill: "surface2", role: "deco" });
    k.shape([2, 25.6, 2.4, 2.4], "circle", { fill: "surface2", role: "deco" });
    k.text([4, 3, 28, 14], "I wonder why…", { role: "body", style: "body", size: 2.9, align: "center" });
  }),

  kit("quiz-choices", "Answer choices", "quiz", "quiz multiple choice answers options abcd", (k) => {
    ["Evaporation", "Condensation", "Precipitation", "Collection"].forEach((choice, index) => {
      const x = (index % 2) * 32;
      const y = Math.floor(index / 2) * 11;
      k.shape([x, y, 30, 9], "rounded", { fill: "surface", stroke: "border", strokeWidth: 0.3, radius: 1.6, role: "card" });
      k.shape([x + 1.6, y + 1.5, 6, 6], "circle", { fill: "accent", role: "shape" });
      k.text([x + 1.6, y + 1.5, 6, 6], "ABCD"[index], { role: "number", style: "small", size: 2.5, color: "onAccent", weight: 700, align: "center" });
      k.text([x + 9.5, y + 1, 19.5, 7], choice, { role: "answer", style: "small", size: 2.5 });
    });
  }),
  kit("quiz-true-false", "True or false", "quiz", "quiz true false yes no", (k) => {
    const options: [string, string, Paint][] = [
      ["True", "circle-check", "success"],
      ["False", "circle-x", "danger"],
    ];
    options.forEach(([label, icon, tone], index) => {
      const x = index * 28;
      k.shape([x, 0, 26, 9], "pill", { fill: "surface", stroke: tone, strokeWidth: 0.35, role: "card" });
      k.icon([x + 3, 2, 5, 5], icon, tone);
      k.text([x + 9.5, 0, 14, 9], label, { role: "answer", style: "body", size: 2.9, weight: 600 });
    });
  }),
  kit("quiz-fill-blank", "Fill in the blank", "quiz", "fill blank cloze gap sentence", (k) => {
    k.text([0, 0, 40, 4], "Fill in the blank", { role: "label", style: "label", size: 2, color: "muted", weight: 600, uppercase: true });
    k.text([0, 5, 26, 7], "Water freezes at", { role: "body", style: "body", size: 3 });
    k.shape([27, 9, 14, 1.4], "line", { stroke: "text", strokeWidth: 0.35, role: "line" });
    k.text([42, 5, 10, 7], "°C.", { role: "body", style: "body", size: 3 });
  }),
  kit("quiz-match", "Match pairs", "quiz", "match matching pairs connect", (k) => {
    const left = ["H₂O", "NaCl", "CO₂"];
    const right = ["Salt", "Carbon dioxide", "Water"];
    left.forEach((term, index) => {
      const y = index * 9;
      k.shape([0, y, 22, 7], "rounded", { fill: "accentSoft", radius: 1.4, role: "card" });
      k.text([0, y, 22, 7], term, { role: "item-title", style: "small", size: 2.6, weight: 600, align: "center" });
      k.shape([22.6, y + 2.8, 1.4, 1.4], "circle", { fill: "muted", role: "deco" });
      k.shape([36, y + 2.8, 1.4, 1.4], "circle", { fill: "muted", role: "deco" });
      k.shape([38, y, 26, 7], "rounded", { fill: "surface", stroke: "border", strokeWidth: 0.3, radius: 1.4, role: "card" });
      k.text([38, y, 26, 7], right[index], { role: "item-body", style: "small", size: 2.5, align: "center" });
    });
  }),

  kit("progress-bar", "Progress bar", "trackers", "progress bar percent completion", (k) => {
    k.shape([0, 0, 50, 3], "pill", { fill: "surface2", role: "shape" });
    k.shape([0, 0, 32.5, 3], "pill", { fill: "accent", role: "shape" });
    k.text([0, 4, 34, 4.5], "Unit progress", { role: "label", style: "small", size: 2.2, color: "muted" });
    k.text([36, 4, 14, 4.5], "65%", { role: "stat-value", style: "small", size: 2.2, weight: 600, align: "right" });
  }),
  kit("progress-ring", "Progress ring", "trackers", "progress ring circle percent goal", (k) => {
    k.chart([0, 0, 22, 22], "progress");
  }),
  kit("rating-stars", "Rating", "trackers", "rating stars review score", (k) => {
    [0, 1, 2, 3, 4].forEach((index) =>
      k.shape([index * 7, 0, 6, 5.7], "star", index < 4 ? { fill: "accent", role: "shape" } : { fill: "transparent", stroke: "accent", strokeWidth: 0.3, role: "shape" }),
    );
  }),
  kit("checklist", "Checklist", "trackers", "checklist todo tasks list done", (k) => {
    ["Read chapter 4", "Answer questions 1–5", "Review vocabulary"].forEach((item, index) => {
      k.icon([0, index * 7, 4.6, 4.6], index === 0 ? "square-check" : "square", "accent");
      k.text([6.5, index * 7, 42, 4.6], item, { role: "bullet", style: "body", size: 2.7 });
    });
  }),
  kit("timer-chip", "Timer", "trackers", "timer countdown minutes clock time", (k) => {
    k.shape([0, 0, 18, 6.6], "pill", { fill: "surface2", role: "chip" });
    k.icon([2, 1.3, 4, 4], "timer", "accent");
    k.text([7, 0, 9.5, 6.6], "5:00", { role: "label", style: "body", size: 2.8, weight: 600 });
  }),

  kit("table-3x3", "Table", "tables", "table grid rows columns 3x3", (k) => {
    k.table([0, 0, 64, 24], [
      ["Word", "Meaning", "Example"],
      ["Noun", "A person, place or thing", "river"],
      ["Verb", "An action word", "swim"],
    ]);
  }),

  kit("chart-column", "Column chart", "charts", "chart graph column bar scores", (k) => {
    k.chart([0, 0, 50, 30], "column");
  }),
  kit("chart-bar", "Bar chart", "charts", "chart graph bar horizontal", (k) => {
    k.chart([0, 0, 50, 26], "bar");
  }),
  kit("chart-line", "Line chart", "charts", "chart graph line trend", (k) => {
    k.chart([0, 0, 50, 30], "line");
  }),
  kit("chart-donut", "Donut chart", "charts", "chart graph donut pie share", (k) => {
    k.chart([0, 0, 46, 28], "donut");
  }),
];

export function getElementKit(id: string): ElementKit | undefined {
  return ELEMENT_KITS.find((entry) => entry.id === id);
}

export function searchElementKits(query: string): ElementKit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ELEMENT_KITS];
  return ELEMENT_KITS.filter(
    (entry) => entry.name.toLowerCase().includes(q) || entry.category.startsWith(q) || entry.keywords.some((keyword) => keyword.startsWith(q)),
  );
}
