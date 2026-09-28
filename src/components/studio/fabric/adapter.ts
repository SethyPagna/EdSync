import type { Canvas, FabricObject, StaticCanvas } from "fabric";
import { backgroundStops, chartSvg, getDeckTheme, getFontPair, iconDataUrl, patternTileSize, patternTileSvg, resolvePaint, shapePath, svgDataUrl, themeColors } from "@/lib/studio/library";
import type { ColorToken, SceneDeck, SceneElement, ScenePage } from "@/lib/studio/scene";
import { resolveTextElementStyle } from "@/lib/studio/text-styles";

type FabricLibrary = typeof import("fabric");
export type FabricPageCanvas = Canvas | StaticCanvas;
export type StudioFabricObject = FabricObject & {
  esId?: string;
  esRole?: string;
  esSlot?: string;
  esKind?: SceneElement["kind"];
};

type RenderCache = {
  pageId: string;
  objects: Map<string, { fingerprint: string; object: StudioFabricObject }>;
  background: string;
  revision: number;
};

const caches = new WeakMap<FabricPageCanvas, RenderCache>();

export function elementFrame(element: SceneElement, deck: Pick<SceneDeck, "width" | "height">) {
  return {
    left: element.x * deck.width,
    top: element.y * deck.height,
    width: element.w * deck.width,
    height: element.h * deck.height,
    angle: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
    visible: !element.hidden,
  };
}

export function fabricFrameToElement(object: Pick<FabricObject, "left" | "top" | "angle" | "opacity" | "visible" | "getScaledWidth" | "getScaledHeight">, source: SceneElement, deck: Pick<SceneDeck, "width" | "height">): SceneElement {
  const w = Math.max(0, Math.min(1, object.getScaledWidth() / deck.width));
  const h = Math.max(0, Math.min(1, object.getScaledHeight() / deck.height));
  return {
    ...source,
    x: Math.max(0, Math.min(1 - w, (object.left ?? 0) / deck.width)),
    y: Math.max(0, Math.min(1 - h, (object.top ?? 0) / deck.height)),
    w,
    h,
    rotation: object.angle || undefined,
    opacity: object.opacity,
    hidden: !object.visible,
    edited: true,
  };
}

function tag<T extends FabricObject>(object: T, element: SceneElement): T & StudioFabricObject {
  const tagged = object as T & StudioFabricObject;
  tagged.esId = element.id;
  tagged.esRole = element.role;
  tagged.esSlot = element.slot;
  tagged.esKind = element.kind;
  tagged.set({ selectable: !element.locked, evented: !element.locked });
  return tagged;
}

function palette(deck: Pick<SceneDeck, "themeId" | "colorOverrides">) {
  return themeColors(getDeckTheme(deck.themeId), deck.colorOverrides);
}

function textObject(fabric: FabricLibrary, element: Extract<SceneElement, { kind: "text" }>, deck: SceneDeck) {
  const frame = elementFrame(element, deck);
  const theme = getDeckTheme(deck.themeId);
  const style = resolveTextElementStyle(element, getFontPair(deck.fontPairId ?? theme.fontPairId), deck);
  const colors = palette(deck);
  return new fabric.Textbox(element.text, {
    ...frame,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.italic ? "italic" : "normal",
    fill: resolvePaint(element.color, colors, colors.text),
    backgroundColor: resolvePaint(element.fill, colors, ""),
    textAlign: element.align ?? "left",
    underline: element.underline ?? false,
    charSpacing: style.letterSpacing ? style.letterSpacing * 1000 / style.fontSize : 0,
    lineHeight: style.lineHeight,
    padding: element.padding ?? 0,
    splitByGrapheme: false,
    lockScalingFlip: true,
  });
}

function shapeObject(fabric: FabricLibrary, element: Extract<SceneElement, { kind: "shape" }>, deck: SceneDeck) {
  const frame = elementFrame(element, deck);
  const colors = palette(deck);
  const isLine = element.shape.includes("line");
  const options = {
    ...frame,
    fill: isLine ? "transparent" : resolvePaint(element.fill, colors, colors.accent),
    stroke: resolvePaint(element.stroke, colors, isLine ? colors.accent : "transparent"),
    strokeWidth: element.strokeWidth ?? (isLine ? 2 : 0),
    strokeDashArray: element.dash,
    shadow: element.shadow ? new fabric.Shadow({ color: "rgba(0,0,0,0.18)", blur: 16, offsetY: 5 }) : undefined,
  };
  if (["rect", "rounded", "pill"].includes(element.shape)) {
    const radius = element.shape === "rect" ? 0 : element.shape === "pill" ? frame.height / 2 : element.radius ?? getDeckTheme(deck.themeId).radius;
    return new fabric.Rect({ ...options, rx: radius, ry: radius });
  }
  if (["circle", "ellipse"].includes(element.shape)) return new fabric.Ellipse({ ...options, rx: frame.width / 2, ry: frame.height / 2 });
  return new fabric.Path(shapePath(element.shape, frame.width, frame.height, element.radius), options);
}

async function svgImage(fabric: FabricLibrary, src: string, element: SceneElement, deck: SceneDeck) {
  const frame = elementFrame(element, deck);
  const image = await fabric.FabricImage.fromURL(src, { crossOrigin: "anonymous" });
  image.set({
    left: frame.left,
    top: frame.top,
    scaleX: frame.width / Math.max(1, image.width),
    scaleY: frame.height / Math.max(1, image.height),
    angle: frame.angle,
    opacity: frame.opacity,
    visible: frame.visible,
  });
  return image;
}

async function imageObject(fabric: FabricLibrary, element: Extract<SceneElement, { kind: "image" }>, deck: SceneDeck) {
  const frame = elementFrame(element, deck);
  const colors = palette(deck);
  if (element.placeholder || !element.src) {
    return new fabric.Group([
      new fabric.Rect({ left: 0, top: 0, width: frame.width, height: frame.height, fill: colors.surface2, stroke: colors.border, strokeWidth: 1, rx: element.radius ?? 12, ry: element.radius ?? 12 }),
      new fabric.Textbox(element.query || "Image", { left: 8, top: frame.height / 2 - 12, width: Math.max(1, frame.width - 16), fontSize: Math.max(12, Math.min(frame.width, frame.height) * 0.07), fill: colors.muted, textAlign: "center" }),
    ], { left: frame.left, top: frame.top, angle: frame.angle, opacity: frame.opacity, visible: frame.visible });
  }
  const image = await fabric.FabricImage.fromURL(element.src, { crossOrigin: "anonymous" });
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  if (element.fit === "contain") {
    const scale = Math.min(frame.width / sourceWidth, frame.height / sourceHeight);
    image.set({ left: frame.left + (frame.width - sourceWidth * scale) / 2, top: frame.top + (frame.height - sourceHeight * scale) / 2, scaleX: scale, scaleY: scale });
  } else {
    const ratio = frame.width / Math.max(1, frame.height);
    const cropWidth = Math.min(sourceWidth, sourceHeight * ratio);
    const cropHeight = Math.min(sourceHeight, sourceWidth / ratio);
    image.set({ cropX: (sourceWidth - cropWidth) / 2, cropY: (sourceHeight - cropHeight) / 2, width: cropWidth, height: cropHeight, left: frame.left, top: frame.top, scaleX: frame.width / cropWidth, scaleY: frame.height / cropHeight });
  }
  image.set({ angle: frame.angle, opacity: frame.opacity, visible: frame.visible });
  if (element.radius || (element.mask && element.mask !== "none")) {
    const clipWidth = image.width;
    const clipHeight = image.height;
    image.clipPath = element.mask === "circle"
      ? new fabric.Ellipse({ rx: clipWidth / 2, ry: clipHeight / 2, originX: "center", originY: "center" })
      : new fabric.Rect({ width: clipWidth, height: clipHeight, rx: element.radius ?? (element.mask === "rounded" ? 24 : 0), ry: element.radius ?? (element.mask === "rounded" ? 24 : 0), originX: "center", originY: "center" });
  }
  return image;
}

function tableObject(fabric: FabricLibrary, element: Extract<SceneElement, { kind: "table" }>, deck: SceneDeck) {
  const frame = elementFrame(element, deck);
  const colors = palette(deck);
  const rows = Math.max(1, element.rows.length);
  const cols = Math.max(1, ...element.rows.map((row) => row.length));
  const cellWidth = frame.width / cols;
  const cellHeight = frame.height / rows;
  const objects: FabricObject[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * cellWidth;
      const top = row * cellHeight;
      objects.push(new fabric.Rect({ left, top, width: cellWidth, height: cellHeight, fill: resolvePaint(element.fill, colors, colors.surface), stroke: resolvePaint(element.stroke, colors, colors.border), strokeWidth: 1 }));
      objects.push(new fabric.Textbox(element.rows[row]?.[col] ?? "", { left: left + 4, top: top + 4, width: Math.max(1, cellWidth - 8), fontFamily: getFontPair(deck.fontPairId ?? getDeckTheme(deck.themeId).fontPairId).body, fontSize: Math.max(10, Math.min(cellWidth, cellHeight) * 0.2), fontWeight: element.header && row === 0 ? 600 : 400, fill: resolvePaint(element.color, colors, colors.text) }));
    }
  }
  return new fabric.Group(objects, { left: frame.left, top: frame.top, angle: frame.angle, opacity: frame.opacity, visible: frame.visible });
}

export async function createFabricObject(element: SceneElement, deck: SceneDeck, fabric: FabricLibrary): Promise<StudioFabricObject> {
  let object: FabricObject;
  if (element.kind === "text") object = textObject(fabric, element, deck);
  else if (element.kind === "shape") object = shapeObject(fabric, element, deck);
  else if (element.kind === "image") object = await imageObject(fabric, element, deck);
  else if (element.kind === "icon") {
    const colors = palette(deck);
    const src = iconDataUrl(element.icon, { color: resolvePaint(element.color, colors, colors.accent), fill: resolvePaint(element.fill, colors, "none"), strokeWidth: element.strokeWidth, size: 128 });
    object = src ? await svgImage(fabric, src, element, deck) : new fabric.Rect({ ...elementFrame(element, deck), fill: colors.accentSoft });
  } else if (element.kind === "chart") {
    const colors = palette(deck);
    const src = svgDataUrl(chartSvg(element, { accent: resolvePaint(element.color, colors, colors.accent), accent2: colors.accent2, text: colors.text, muted: colors.muted, surface2: colors.surface2 }, element.w * deck.width, element.h * deck.height));
    object = await svgImage(fabric, src, element, deck);
  } else object = tableObject(fabric, element, deck);
  return tag(object, element);
}

async function applyBackground(canvas: FabricPageCanvas, page: ScenePage, deck: SceneDeck, fabric: FabricLibrary, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  const colors = palette(deck);
  const paint = (value: string) => resolvePaint(value, colors);
  canvas.backgroundImage = undefined;
  const background = page.background;
  if (background.kind === "solid") canvas.backgroundColor = paint(background.color);
  else if (background.kind === "gradient") {
    const angle = background.angle * Math.PI / 180;
    const dx = Math.cos(angle) * deck.width / 2;
    const dy = Math.sin(angle) * deck.height / 2;
    const stops = backgroundStops(background);
    canvas.backgroundColor = new fabric.Gradient({ type: "linear", coords: { x1: deck.width / 2 - dx, y1: deck.height / 2 - dy, x2: deck.width / 2 + dx, y2: deck.height / 2 + dy }, colorStops: stops.map((value, index) => ({ offset: index / (stops.length - 1), color: paint(value) })) });
  } else if (background.kind === "pattern") {
    const size = patternTileSize(background.pattern);
    const tile = document.createElement("canvas");
    tile.width = size.width;
    tile.height = size.height;
    const context = tile.getContext("2d");
    if (context) {
      context.fillStyle = paint(background.on);
      context.fillRect(0, 0, tile.width, tile.height);
      const image = await fabric.FabricImage.fromURL(svgDataUrl(patternTileSvg(background.pattern, paint(background.color))));
      context.drawImage(image.getElement() as HTMLImageElement, 0, 0, tile.width, tile.height);
    }
    if (!isCurrent()) return;
    canvas.backgroundColor = new fabric.Pattern({ source: tile, repeat: "repeat" });
  } else {
    const image = await fabric.FabricImage.fromURL(background.src, { crossOrigin: "anonymous" });
    if (!isCurrent()) return;
    canvas.backgroundColor = background.overlay ? paint(background.overlay) : "transparent";
    const scale = Math.max(deck.width / Math.max(1, image.width), deck.height / Math.max(1, image.height));
    image.set({ left: (deck.width - image.width * scale) / 2, top: (deck.height - image.height * scale) / 2, scaleX: scale, scaleY: scale, selectable: false, evented: false });
    canvas.backgroundImage = image;
  }
}

export async function syncFabricPage(canvas: FabricPageCanvas, page: ScenePage, deck: SceneDeck): Promise<void> {
  const fabric = await import("fabric");
  let cache = caches.get(canvas);
  if (!cache || cache.pageId !== page.id) {
    canvas.clear();
    cache = { pageId: page.id, objects: new Map(), background: "", revision: 0 };
    caches.set(canvas, cache);
  }
  const revision = ++cache.revision;
  const isCurrent = () => revision === cache.revision && caches.get(canvas) === cache;
  const background = JSON.stringify([page.background, deck.themeId, deck.colorOverrides, deck.width, deck.height]);
  if (cache.background !== background) {
    await applyBackground(canvas, page, deck, fabric, isCurrent);
    if (!isCurrent()) return;
    cache.background = background;
  }
  const ids = new Set(page.elements.map((element) => element.id));
  for (const [id, record] of cache.objects) {
    if (!ids.has(id)) { canvas.remove(record.object); cache.objects.delete(id); }
  }
  for (const [index, element] of page.elements.entries()) {
    const fingerprint = JSON.stringify([element, deck.width, deck.height, deck.themeId, deck.fontPairId, deck.colorOverrides]);
    let record = cache.objects.get(element.id);
    if (!record || record.fingerprint !== fingerprint) {
      const object = await createFabricObject(element, deck, fabric);
      if (!isCurrent()) return;
      if (record) canvas.remove(record.object);
      canvas.insertAt(index, object);
      record = { fingerprint, object };
      cache.objects.set(element.id, record);
    } else canvas.moveObjectTo(record.object, index);
  }
  if (!isCurrent()) return;
  canvas.requestRenderAll();
}

export function fabricObjectToScene(object: StudioFabricObject, source: SceneElement, deck: SceneDeck): SceneElement {
  const frame = fabricFrameToElement(object, source, deck);
  if (source.kind === "text" && "text" in object && typeof object.text === "string") return { ...frame, text: object.text } as SceneElement;
  return frame;
}

export function resolveSceneColor(token: ColorToken, deck: SceneDeck): string {
  return palette(deck)[token];
}
