import type PptxGenJS from "pptxgenjs";
import { getDeckTheme, getFontPair, resolvePaint, themeColors } from "@/lib/studio/library";
import type { ChartElement, SceneDeck, SceneElement, ShapeElement, TableElement, TextElement } from "@/lib/studio/scene";
import { resolveTextElementStyle } from "@/lib/studio/text-styles";

export interface SlideSize { width: number; height: number }

export function slideSize(deck: Pick<SceneDeck, "width" | "height">): SlideSize {
  if (deck.width <= 0 || deck.height <= 0) throw new Error("Design size is invalid.");
  const scale = 13.333 / Math.max(deck.width, deck.height);
  return { width: +(deck.width * scale).toFixed(4), height: +(deck.height * scale).toFixed(4) };
}

export function elementBox(element: SceneElement, size: SlideSize) {
  return { x: element.x * size.width, y: element.y * size.height, w: element.w * size.width, h: element.h * size.height };
}

export function pptxColor(value: string): string | null {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) return (hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1]).toUpperCase();
  const rgb = value.trim().match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
}

export function deckPaint(deck: SceneDeck, value: string | undefined, fallback: string): string {
  const theme = getDeckTheme(deck.themeId);
  const resolved = resolvePaint(value, themeColors(theme, deck.colorOverrides), fallback);
  return pptxColor(resolved) ?? pptxColor(fallback) ?? "000000";
}

export function mapText(element: TextElement, deck: SceneDeck, size = slideSize(deck)): PptxGenJS.TextPropsOptions {
  const theme = getDeckTheme(deck.themeId);
  const pair = getFontPair(deck.fontPairId ?? theme.fontPairId);
  const style = resolveTextElementStyle(element, pair, deck);
  const pxToPt = size.width * 72 / deck.width;
  return {
    ...elementBox(element, size),
    fontFace: style.fontFamily,
    fontSize: +(style.fontSize * pxToPt).toFixed(2),
    bold: style.fontWeight >= 600,
    italic: style.italic,
    color: deckPaint(deck, element.color, theme.colors.text),
    align: element.align ?? "left",
    valign: element.verticalAlign ?? "top",
    breakLine: false,
    margin: (element.padding ?? 0) * pxToPt,
    lineSpacingMultiple: Math.max(0.8, style.lineHeight),
    charSpacing: +(style.letterSpacing * style.fontSize * pxToPt).toFixed(2),
    rotate: element.rotation ?? 0,
    transparency: Math.round((1 - (element.opacity ?? 1)) * 100),
    underline: element.underline ? { style: "sng" } : undefined,
    bullet: element.list ? { type: element.list, indent: Math.max(8, style.fontSize * pxToPt) } : undefined,
    fill: element.fill ? { color: deckPaint(deck, element.fill, theme.colors.surface) } : undefined,
    fit: element.autoFit ? "shrink" : "none",
  };
}

const SHAPES: Partial<Record<ShapeElement["shape"], PptxGenJS.SHAPE_NAME>> = {
  rect: "rect", rounded: "roundRect", circle: "ellipse", ellipse: "ellipse", pill: "roundRect",
  triangle: "triangle", diamond: "diamond", pentagon: "pentagon", hexagon: "hexagon", star: "star5",
  arrow: "rightArrow", chevron: "chevron", speech: "wedgeRoundRectCallout", ring: "donut",
  line: "line", "arrow-line": "line", "dashed-line": "line",
};

export function mapShape(element: ShapeElement, deck: SceneDeck, size = slideSize(deck)): { type: PptxGenJS.SHAPE_NAME; options: PptxGenJS.ShapeProps } | null {
  const type = SHAPES[element.shape];
  if (!type) return null;
  const theme = getDeckTheme(deck.themeId);
  const isLine = element.shape.includes("line");
  const options: PptxGenJS.ShapeProps = {
    ...elementBox(element, size),
    rotate: element.rotation ?? 0,
    fill: isLine ? { color: "FFFFFF", transparency: 100 } : { color: deckPaint(deck, element.fill, theme.colors.accent), transparency: Math.round((1 - (element.opacity ?? 1)) * 100) },
    line: {
      color: deckPaint(deck, element.stroke, isLine ? theme.colors.accent : theme.colors.border),
      transparency: element.stroke || isLine ? Math.round((1 - (element.opacity ?? 1)) * 100) : 100,
      width: Math.max(0.1, (element.strokeWidth ?? (isLine ? 2 : 0)) * size.width * 72 / deck.width),
      dashType: element.dash?.length || element.shape === "dashed-line" ? "dash" : "solid",
      endArrowType: element.shape === "arrow-line" ? "triangle" : "none",
    },
  };
  if (element.shape === "rounded" || element.shape === "pill") options.rectRadius = element.shape === "pill" ? 0.5 : Math.min(0.5, (element.radius ?? theme.radius) / Math.max(1, element.w * deck.width));
  return { type, options };
}

export function mapChart(element: ChartElement, deck: SceneDeck, size = slideSize(deck)): { type: PptxGenJS.CHART_NAME; data: PptxGenJS.OptsChartData[]; options: PptxGenJS.IChartOpts } | null {
  if (!element.data.length) return null;
  const kind = element.chart;
  if (!["bar", "column", "line", "pie", "donut"].includes(kind)) return null;
  const theme = getDeckTheme(deck.themeId);
  const type: PptxGenJS.CHART_NAME = kind === "bar" || kind === "column" ? "bar" : kind === "donut" ? "doughnut" : kind === "pie" ? "pie" : "line";
  return {
    type,
    data: [{ name: element.name ?? "Data", labels: element.data.map((point) => point.label), values: element.data.map((point) => point.value) }],
    options: {
      ...elementBox(element, size),
      barDir: kind === "column" ? "col" : "bar",
      chartColors: [deckPaint(deck, element.color, theme.colors.accent), deckPaint(deck, "accent2", theme.colors.accent2)],
      showLegend: kind === "pie" || kind === "donut",
      showValue: element.showLabels ?? false,
      showTitle: false,
      holeSize: kind === "donut" ? 58 : undefined,
    },
  };
}

export function mapTable(element: TableElement, deck: SceneDeck, size = slideSize(deck)): { rows: PptxGenJS.TableRow[]; options: PptxGenJS.TableProps } {
  const theme = getDeckTheme(deck.themeId);
  const rows = element.rows.map((row, rowIndex) => row.map((text) => ({ text, options: element.header && rowIndex === 0 ? { bold: true } : undefined })));
  return {
    rows,
    options: {
      ...elementBox(element, size),
      border: { type: "solid", color: deckPaint(deck, element.stroke, theme.colors.border), pt: 0.5 },
      fill: { color: deckPaint(deck, element.fill, theme.colors.surface) },
      color: deckPaint(deck, element.color, theme.colors.text),
      fontFace: getFontPair(deck.fontPairId ?? theme.fontPairId).body,
      fontSize: Math.max(8, Math.min(18, element.h * size.height * 72 / Math.max(1, rows.length * 2))),
      margin: 3,
      autoPage: false,
    },
  };
}
