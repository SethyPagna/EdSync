import { chartSvg, getDeckTheme, getFontPair, iconSvg, resolvePaint, shapeSvg, themeColors } from "@/lib/studio/library";
import type { SceneDeck, SceneElement } from "@/lib/studio/scene";
import { renderPageImage } from "@/components/studio/fabric/render";
import { deckPaint, elementBox, mapChart, mapShape, mapTable, mapText, slideSize } from "./pptx-map";
import { loadBrowserPptx } from "./pptx-browser";

function canvasImage(source: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is unavailable for image export."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL("image/png")); } catch { reject(new Error("An image cannot be exported. Check its sharing settings.")); }
    };
    image.onerror = () => reject(new Error("An image could not be loaded for PowerPoint."));
    image.src = source;
  });
}

async function imageData(source: string): Promise<string> {
  if (source.startsWith("data:image/")) {
    if (source.startsWith("data:image/svg+xml")) return canvasImage(source, 512, 512);
    return source;
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Image fetch failed (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("An image has an unsupported format.");
  const url = URL.createObjectURL(blob);
  try {
    if (blob.type === "image/svg+xml") return await canvasImage(url, 512, 512);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("An image could not be read."));
      reader.readAsDataURL(blob);
    });
  } finally { URL.revokeObjectURL(url); }
}

async function rasterElement(element: SceneElement, deck: SceneDeck): Promise<string> {
  const theme = getDeckTheme(deck.themeId);
  const colors = themeColors(theme, deck.colorOverrides);
  const width = Math.max(48, Math.round(element.w * deck.width));
  const height = Math.max(48, Math.round(element.h * deck.height));
  if (element.kind === "icon") {
    const svg = iconSvg(element.icon, { color: resolvePaint(element.color, colors, colors.accent), fill: resolvePaint(element.fill, colors, "none"), size: 512, strokeWidth: element.strokeWidth });
    if (!svg) throw new Error(`Unknown icon: ${element.icon}`);
    return canvasImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height);
  }
  if (element.kind === "shape") {
    const svg = shapeSvg(element.shape, width, height, { fill: resolvePaint(element.fill, colors, colors.accent), stroke: resolvePaint(element.stroke, colors, "none"), strokeWidth: element.strokeWidth });
    return canvasImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height);
  }
  if (element.kind === "chart") {
    const svg = chartSvg(element, { accent: resolvePaint(element.color, colors, colors.accent), accent2: colors.accent2, text: colors.text, muted: colors.muted, surface2: colors.surface2 }, width, height, { fontFamily: getFontPair(deck.fontPairId ?? theme.fontPairId).body });
    return canvasImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height);
  }
  throw new Error("Element cannot be rasterized.");
}

export async function buildNativePptx(deck: SceneDeck, onProgress?: (current: number, total: number) => void): Promise<Blob> {
  const PptxGenJS = await loadBrowserPptx();
  const pptx = new PptxGenJS();
  const size = slideSize(deck);
  pptx.defineLayout({ name: "EDSYNC", width: size.width, height: size.height });
  pptx.layout = "EDSYNC";
  pptx.author = "EdSync";
  pptx.subject = "Studio design";
  pptx.title = deck.title;
  const pages = deck.pages.filter((page) => !page.hidden);
  if (!pages.length) throw new Error("No visible pages to export.");

  for (const [index, page] of pages.entries()) {
    const slide = pptx.addSlide();
    const theme = getDeckTheme(deck.themeId);
    if (page.background.kind === "solid") slide.background = { color: deckPaint(deck, page.background.color, theme.colors.bg) };
    else {
      const background = await renderPageImage({ ...page, elements: [] }, deck, { format: "png" });
      slide.addImage({ data: background, x: 0, y: 0, w: size.width, h: size.height });
    }

    for (const element of page.elements) {
      if (element.hidden) continue;
      const box = elementBox(element, size);
      if (element.kind === "text") {
        const style = mapText(element, deck, size);
        const text = element.uppercase ? element.text.toUpperCase() : element.text;
        slide.addText(text, style);
      } else if (element.kind === "shape") {
        const mapped = mapShape(element, deck, size);
        if (mapped) slide.addShape(mapped.type, mapped.options);
        else slide.addImage({ data: await rasterElement(element, deck), ...box, rotate: element.rotation ?? 0 });
      } else if (element.kind === "image") {
        if (!element.src || element.placeholder) continue;
        const data = await imageData(element.src);
        slide.addImage({ data, ...box, rotate: element.rotation ?? 0, sizing: { type: element.fit ?? "cover", w: box.w, h: box.h }, rounding: element.mask === "circle" });
      } else if (element.kind === "icon") {
        slide.addImage({ data: await rasterElement(element, deck), ...box, rotate: element.rotation ?? 0 });
      } else if (element.kind === "chart") {
        const mapped = mapChart(element, deck, size);
        if (mapped) slide.addChart(mapped.type, mapped.data, mapped.options);
        else slide.addImage({ data: await rasterElement(element, deck), ...box });
      } else if (element.kind === "table" && element.rows.length) {
        const mapped = mapTable(element, deck, size);
        slide.addTable(mapped.rows, mapped.options);
      }
    }
    const notes = page.notes ?? page.content?.notes;
    if (notes?.trim()) slide.addNotes(notes);
    onProgress?.(index + 1, pages.length);
  }

  const result = await pptx.write({ outputType: "blob", compression: true });
  return result instanceof Blob ? result : new Blob([result as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}
