import { splitTextToFit } from "../fit";
import type { LayoutDef, Paint } from "../scene";
import { clean, createKit, defineLayout, listSource, orientationOf, quoteOf, type Ink, type LayoutKit, type StackBlock } from "./kit";
import { markerFor } from "./lists";

interface QuoteOptions {
  align: "left" | "center";
  maxH: number;
  /** Largest quote size as a multiple of the quote style size. */
  maxScale?: number;
  ink?: { text: Paint; muted: Ink; accent: Paint };
  /** Show the page title as a small label above the quote. */
  label?: boolean;
  markScale?: number;
}

/** Quote mark, quote text, author and supporting body as stack blocks. A long quote continues. */
function quoteBlocks(k: LayoutKit, w: number, opts: QuoteOptions): StackBlock[] {
  const c = k.content;
  const ink = opts.ink ?? { text: k.ink.text, muted: k.ink.muted, accent: k.ink.accent };
  const { text, author } = quoteOf(c);
  const source = clean(c.quote?.text) ? "quote" : clean(c.body) ? "body" : "title";
  const blocks: StackBlock[] = [];
  if (clean(c.kicker)) blocks.push({ m: k.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, align: opts.align, color: opts.ink ? ink.accent : k.ink.accentSmall }) });
  if (source !== "title" && (opts.label ?? true)) {
    blocks.push({
      m: k.measure({ text: clean(c.title), style: "subheading", role: "title", slot: "title", w, maxH: k.safe.h * 0.14, weight: 600, align: opts.align, color: ink.muted.color, opacity: ink.muted.opacity }),
      gap: k.u * 1.5,
    });
  }
  const style = k.style("quote");
  const markSize = Math.round(k.style("display").fontSize * (opts.markScale ?? 1.4));
  blocks.push({
    m: k.measure({ text: "“", style: "display", role: "deco", slot: "quote-mark", w: Math.min(w, markSize), size: markSize, lineHeight: 0.8, align: opts.align === "center" ? "center" : "left", color: ink.accent }),
    x: opts.align === "center" ? k.safe.x + (k.safe.w - Math.min(w, markSize)) / 2 : undefined,
    gap: k.u * 3,
  });
  const maxSize = Math.round(style.fontSize * (opts.maxScale ?? 1));
  const split = splitTextToFit(text, { ...style, fontSize: maxSize }, w, opts.maxH, k.ctx.measure);
  const slot = source === "quote" ? "quote" : source === "body" ? "body" : "title";
  blocks.push({
    m: k.measure({ text: split.fit, style: "quote", role: "quote", slot, w, size: split.fontSize, align: opts.align, color: ink.text }),
    gap: k.u,
  });
  if (source === "quote") {
    k.use("quote");
    if (split.rest) k.continueWith({ quote: { text: split.rest, ...(author ? { author } : {}) } });
  } else if (source === "body") {
    k.use("body");
    if (split.rest) k.continueWith({ body: split.rest });
  }
  if (author) {
    blocks.push({
      m: k.measure({ text: `— ${author}`, style: "subheading", role: "author", slot: "author", w, maxH: k.safe.h * 0.12, weight: 500, align: opts.align, color: ink.muted.color, opacity: ink.muted.opacity }),
      gap: k.u * 3,
    });
  }
  if (source === "quote" && clean(c.body)) {
    blocks.push({ m: k.bodyBlock(w, k.safe.h * 0.16, { style: "small", align: opts.align, ink: ink.muted }), gap: k.u * 3 });
  }
  k.use("title", "kicker");
  return blocks;
}

export const quoteCenter = defineLayout({
  id: "quote-center",
  name: "Quote",
  kinds: ["quote", "concept"],
  orientation: "any",
  fit: (s) => {
    if (s.hasQuote) return (s.quoteLen > 420 ? 62 : 86) - (s.listCount ? 30 : 0);
    return s.kind === "quote" && s.hasBody ? 56 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const x = k.safe.x + (k.safe.w - w) / 2;
    k.vstack(x, k.safe.y, k.safe.h, quoteBlocks(k, w, { align: "center", maxH: k.safe.h * 0.46 }), "middle", 0.45);
    return k.done();
  },
});

export const quoteImage = defineLayout({
  id: "quote-image",
  name: "Quote with image",
  kinds: ["quote"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasQuote && !(s.kind === "quote" && s.hasBody)) return 0;
    return (s.hasImage ? 82 : 40) - (s.quoteLen > 360 ? 20 : 0) - (s.listCount ? 30 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    if (k.landscape) {
      const imgW = Math.round(k.W * 0.4);
      k.image({ x: 0, y: 0, w: imgW, h: k.H });
      const x = imgW + k.gutter * 2.5;
      const w = k.right - x;
      k.vstack(x, k.safe.y, k.safe.h, quoteBlocks(k, w, { align: "left", maxH: k.safe.h * 0.5, markScale: 1.1 }), "middle", 0.5);
    } else {
      const imgH = Math.round(k.H * 0.38);
      k.image({ x: 0, y: 0, w: k.W, h: imgH });
      const top = imgH + k.u * 4;
      k.vstack(k.safe.x, top, k.bottom - top, quoteBlocks(k, k.safe.w, { align: "left", maxH: (k.bottom - top) * 0.55, markScale: 1 }), "middle", 0.4);
    }
    return k.done();
  },
});

export const socialQuote = defineLayout({
  id: "social-quote",
  name: "Quote post",
  kinds: ["quote", "concept"],
  orientation: "any",
  deckKinds: { social: 1.5, slides: 0.8, doc: 0.4, worksheet: 0.4 },
  fit: (s, _c, ctx) => {
    if (!s.hasQuote && !(s.kind === "quote" && s.hasBody)) return 0;
    const base = s.quoteLen <= 240 ? 70 : 40;
    return orientationOf(ctx.width, ctx.height) === "landscape" ? base * 0.45 : base;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    k.vstack(k.safe.x, k.safe.y, k.safe.h, quoteBlocks(k, k.safe.w, { align: "left", maxH: k.safe.h * 0.56, maxScale: 1.3, markScale: 1.8 }), "middle", 0.5);
    return k.done();
  },
});

export const imageFull = defineLayout({
  id: "image-full",
  name: "Full-bleed image",
  kinds: ["image", "title", "section", "closing"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasImage) return s.kind === "image" ? 30 : 0;
    if (s.listCount) return 6;
    const base = s.kind === "image" ? 84 : 36;
    return base - (s.bodyLen > 260 ? 30 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.image({ x: 0, y: 0, w: k.W, h: k.H });
    const cardW = k.landscape ? k.col(0, 6).w : k.safe.w;
    const pad = Math.round(k.pad * 1.2);
    const w = cardW - pad * 2;
    const ink = { text: "text" as Paint, muted: { color: "muted" as Paint }, accent: k.accentSmallOn("surface") };
    const blocks = k.headerBlocks(w, { titleStyle: "title", titleMaxH: k.safe.h * 0.3, body: true, bodyMaxH: k.safe.h * 0.2, bodyStyle: "small", ink });
    const height = k.stackHeight(blocks) + pad * 2;
    const box = { x: k.safe.x, y: k.bottom - height, w: cardW, h: height };
    k.card(box, { slot: "caption-card", tone: k.ctx.theme.cardStyle === "glass" ? "plain" : "default" });
    k.vstack(box.x + pad, box.y + pad, height - pad * 2, blocks, "top");
    return k.done();
  },
});

export const imageCaption = defineLayout({
  id: "image-caption",
  name: "Image with caption",
  kinds: ["image", "concept"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasImage) return 0;
    const base = s.kind === "image" ? 76 : 40;
    return base - (s.listCount > 3 ? 26 : 0) - (s.bodyLen > 320 ? 16 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { titleStyle: "heading", titleMaxH: k.safe.h * 0.2 });
    const area = k.below(k.safe, bottom, k.u * 4);
    const capW = k.landscape ? k.col(0, 9).w : area.w;
    const caption = k.bodyBlock(capW, area.h * 0.18, { style: "small", muted: true });
    const source = listSource(content);
    const listH = source ? area.h * 0.24 : 0;
    const capH = caption.h ? caption.h + k.u * 2.5 : 0;
    const imgH = Math.max(area.h * 0.4, area.h - capH - (listH ? listH + k.u * 2 : 0));
    k.image({ x: area.x, y: area.y, w: area.w, h: imgH }, { radius: k.radius });
    let y = area.y + imgH + k.u * 2.5;
    if (caption.h) {
      k.place(caption, area.x, y);
      y += caption.h + k.u * 2;
    }
    if (source) k.list({ x: area.x, y, w: area.w, h: Math.max(0, k.bottom - y) }, source, { marker: markerFor(source), style: "small" });
    return k.done();
  },
});

export const MEDIA_LAYOUTS: LayoutDef[] = [quoteCenter, quoteImage, imageFull, imageCaption, socialQuote];
