import { splitTextToFit } from "../fit";
import type { LayoutDef, Paint } from "../scene";
import {
  choicesOf,
  clean,
  createKit,
  defineLayout,
  entriesOf,
  knownIcon,
  listSource,
  orientationOf,
  type Box,
  type Entry,
  type LayoutKit,
  type StackBlock,
} from "./kit";
import { textColumn } from "./lists";

/* ---------------- shared helpers ---------------- */

export function choiceEntries(choices: readonly string[]): Entry[] {
  return choices.map((title, i) => ({ index: i, key: `choice-${i}`, title, slotTitle: `choice-${i}`, slotBody: `choice-${i}-body` }));
}

/** Kicker, page title (as a label when a prompt exists) and the question prompt. Returns the bottom y. */
export function questionHeader(k: LayoutKit, area: Box, opts: { align?: "left" | "center"; promptMaxH?: number; hint?: boolean } = {}): number {
  const c = k.content;
  const align = opts.align ?? "left";
  const prompt = clean(c.question?.prompt);
  const title = clean(c.title);
  let y = area.y;
  if (clean(c.kicker)) {
    const m = k.text({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w: area.w, align, color: k.ink.accentSmall }, area.x, y);
    y += m.h + k.u * 1.5;
  }
  if (prompt && title && title.toLowerCase() !== prompt.toLowerCase()) {
    const m = k.text({ text: title, style: "subheading", role: "label", slot: "title", w: area.w, maxH: area.h * 0.12, weight: 600, align, ...k.mutedSpec() }, area.x, y);
    y += m.h + k.u * 1.5;
  }
  const main = prompt || title;
  const m = k.text(
    {
      text: main,
      style: "title",
      role: "title",
      slot: prompt ? "question" : "title",
      w: area.w,
      maxH: opts.promptMaxH ?? area.h * 0.34,
      minSize: k.style("subheading").minSize,
      align,
    },
    area.x,
    y,
  );
  y += m.h;
  if (clean(c.subtitle)) {
    const s = k.text({ text: clean(c.subtitle), style: "body", role: "subtitle", slot: "subtitle", w: area.w, maxH: area.h * 0.12, align, ...k.mutedSpec() }, area.x, y + k.u * 1.5);
    y += s.h + k.u * 1.5;
  }
  if ((opts.hint ?? true) && clean(c.body)) {
    y += k.u * 2;
    y = k.paragraph({ x: area.x, y, w: area.w, h: area.h * 0.16 }, { style: "body", align, muted: true });
  }
  k.use("title", "kicker", "subtitle", "question");
  return y;
}

/* ---------------- definition & glossary ---------------- */

export const definitionCard = defineLayout({
  id: "definition-card",
  name: "Definition",
  kinds: ["definition", "glossary", "concept"],
  orientation: "any",
  fit: (s) => {
    if (s.terms === 1) return 88;
    if (s.kind === "definition") return s.terms ? 50 : s.hasBody ? 72 : 20;
    if (s.terms === 2) return 34;
    return 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const terms = entriesOf(content, "terms");
    const term = terms[0];
    const title = clean(content.title);
    const titleIsTerm = !term || title.toLowerCase() === term.title.toLowerCase();
    let top = k.safe.y;
    if (!titleIsTerm) {
      top = k.header(k.safe, { titleStyle: "heading", titleMaxH: k.safe.h * 0.2 }) + k.u * 4;
    } else {
      const blocks: StackBlock[] = [];
      if (clean(content.kicker)) blocks.push({ m: k.measure({ text: clean(content.kicker), style: "label", role: "kicker", slot: "kicker", w: k.safe.w, color: k.ink.accentSmall }) });
      if (clean(content.subtitle)) blocks.push({ m: k.measure({ text: clean(content.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w: k.safe.w, maxH: k.safe.h * 0.14, ...k.mutedSpec() }), gap: k.u * 1.5 });
      if (blocks.length) top = k.vstack(k.safe.x, k.safe.y, k.safe.h, blocks, "top").bottom + k.u * 4;
      k.use("title", "kicker", "subtitle");
    }
    const cardW = k.landscape ? k.col(1, 10).w : k.safe.w;
    const area = { x: k.safe.x + (k.safe.w - cardW) / 2, y: top, w: cardW, h: k.bottom - top };
    const pad = Math.round(k.pad * 1.6);
    const w = area.w - pad * 2;
    const termText = term ? term.title : title;
    const defText = term ? term.body ?? "" : clean(content.body);
    const blocks: StackBlock[] = [];
    const termM = k.measure({ text: termText, style: "title", role: "item-title", slot: term ? term.slotTitle : "title", w, maxH: area.h * 0.3, color: "accent" });
    blocks.push({ m: termM });
    const barW = Math.round(48 * k.s);
    const barH = Math.max(3, Math.round(4 * k.s));
    blocks.push({ h: barH, gap: k.u * 2.5, draw: (y) => k.shape({ x: area.x + pad, y, w: barW, h: barH }, { shape: "pill", fill: "accent", slot: "definition-bar" }) });
    const extra = term && clean(content.body);
    const defMaxH = area.h - pad * 2 - termM.h - barH - k.u * 5 - (extra ? area.h * 0.22 : 0);
    if (term) {
      const style = k.style("subheading");
      const split = splitTextToFit(defText, style, w, Math.max(style.minSize * 3, defMaxH), k.ctx.measure);
      blocks.push({ m: k.measure({ text: split.fit, style: "subheading", role: "item-body", slot: term.slotBody, w, size: split.fontSize, color: "text" }), gap: k.u * 2.5 });
      const rest = terms.slice(1);
      if (split.rest) rest.unshift({ ...term, body: split.rest });
      k.use("terms");
      k.continueList("terms", rest);
      if (extra) blocks.push({ m: k.bodyBlock(w, area.h * 0.2, { style: "small", ink: { color: "muted" } }), gap: k.u * 3 });
    } else {
      blocks.push({ m: k.bodyBlock(w, Math.max(k.style("subheading").minSize * 3, defMaxH), { style: "subheading", ink: { color: "text" } }), gap: k.u * 2.5 });
    }
    const h = Math.min(area.h, Math.max(k.stackHeight(blocks) + pad * 2, area.h * 0.5));
    const box = { x: area.x, y: area.y + (area.h - h) * 0.4, w: area.w, h };
    k.card(box, { slot: "definition-card" });
    k.vstack(box.x + pad, box.y + pad, box.h - pad * 2, blocks, "middle", 0.5);
    return k.done();
  },
});

export const glossaryGrid = defineLayout({
  id: "glossary-grid",
  name: "Glossary",
  kinds: ["glossary", "definition", "concept"],
  orientation: "any",
  fit: (s) => {
    if (s.terms >= 3) return 86;
    if (s.terms === 2) return 62;
    if (s.kind === "glossary" && s.itemBodies >= 2) return 60;
    return 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.14, titleMaxH: k.safe.h * 0.26 });
    const source = listSource(content, ["terms", "items", "bullets"]);
    if (source) {
      const n = source.entries.length;
      const capacity = k.portrait ? 8 : 6;
      const shown = Math.min(n, capacity);
      const cols = k.landscape ? (shown <= 4 ? 2 : 3) : k.square ? 2 : shown <= 4 ? 1 : 2;
      const res = k.cards(k.below(k.safe, bottom, k.u * 5), source.entries, {
        cols,
        capacity,
        badge: "none",
        titleStyle: "subheading",
        bodyStyle: "small",
        accentTitles: true,
        fill: 0.5,
        horizontal: false,
      });
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

/* ---------------- questions ---------------- */

export const questionChoices = defineLayout({
  id: "question-choices",
  name: "Multiple choice",
  kinds: ["question", "quiz"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasQuestion || s.trueFalse) return 0;
    if (s.choices >= 3) return 92;
    return s.choices === 2 ? 72 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const choices = choicesOf(content);
    if (!clean(content.question?.prompt) && !choices.length) {
      textColumn(k, k.safe);
      return k.done();
    }
    const bottom = questionHeader(k, k.safe, { promptMaxH: k.safe.h * 0.3 });
    const entries = choiceEntries(choices);
    if (entries.length) {
      const per = entries.length <= 6 ? entries.length : Math.ceil(entries.length / Math.ceil(entries.length / 6));
      const cols = k.landscape ? (per <= 3 ? per : per === 4 ? 2 : 3) : k.square && per === 4 ? 2 : 1;
      const res = k.cards(k.below(k.safe, bottom, k.u * 5), entries, {
        cols,
        capacity: per,
        badge: "letter",
        horizontal: true,
        titleStyle: "subheading",
        plainTitles: true,
        fill: 0.4,
        gapY: k.u * 2,
      });
      if (res.rest.length) {
        const start = (content.listStart ?? 0) + res.rest[0].index;
        k.continueWith({ question: { ...content.question, prompt: clean(content.question?.prompt), choices: res.rest.map((e) => e.title) }, listStart: start });
      }
    }
    return k.done();
  },
});

export const questionTrueFalse = defineLayout({
  id: "question-true-false",
  name: "True or false",
  kinds: ["question", "quiz"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasQuestion) return 0;
    if (s.trueFalse) return 94;
    return s.choices === 2 ? 44 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const choices = choicesOf(content);
    const labels = choices.length === 2 ? choices : ["True", "False"];
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const area = { x: k.safe.x + (k.safe.w - w) / 2, y: k.safe.y, w, h: k.safe.h };
    const bottom = questionHeader(k, area, { align: "center", promptMaxH: k.safe.h * 0.36 });
    const entries: Entry[] = labels.map((title, i) => ({
      index: i,
      key: `choice-${i}`,
      title,
      icon: i === 0 ? "circle-check" : "circle-x",
      slotTitle: `choice-${i}`,
      slotBody: `choice-${i}-body`,
    }));
    const stacked = k.portrait;
    const cardsArea = k.below(area, bottom, k.u * 6);
    const gridW = stacked ? cardsArea.w : Math.min(cardsArea.w, Math.round(620 * k.s));
    k.cards({ ...cardsArea, x: cardsArea.x + (cardsArea.w - gridW) / 2, w: gridW }, entries, {
      cols: stacked ? 1 : 2,
      capacity: 2,
      badge: "icon",
      badgeTone: "soft",
      align: stacked ? "left" : "center",
      horizontal: stacked,
      titleStyle: "heading",
      fill: stacked ? 0.35 : 0.55,
      tone: (i) => (i === 0 ? "soft" : "muted"),
    });
    return k.done();
  },
});

export const questionOpen = defineLayout({
  id: "question-open",
  name: "Open question",
  kinds: ["question", "quiz", "activity"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasQuestion) return s.kind === "question" && s.titleLen > 0 && !s.listCount ? 40 : 0;
    return s.choices === 0 && !s.trueFalse ? 86 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const w = k.landscape ? k.col(0, 10).w : k.safe.w;
    const bottom = questionHeader(k, { ...k.safe, w }, { promptMaxH: k.safe.h * 0.36 });
    const choices = choiceEntries(choicesOf(content));
    let y = bottom + k.u * 4;
    if (choices.length) {
      const res = k.list({ x: k.safe.x, y, w, h: k.bottom - y }, { field: "bullets", entries: choices }, { marker: "letter", grow: false, onRest: (rest) => k.continueWith({ question: { ...content.question, prompt: clean(content.question?.prompt), choices: rest.map((e) => e.title) } }) });
      y = res.bottom + k.u * 3;
    }
    const box = { x: k.safe.x, y, w: k.safe.w, h: k.bottom - y };
    if (box.h >= k.u * 8) {
      k.card(box, { slot: "answer-box", tone: "plain" });
      const gap = Math.round(44 * k.s);
      const pad = k.pad;
      const lines = Math.max(1, Math.min(8, Math.floor((box.h - pad) / gap)));
      for (let i = 0; i < lines; i += 1) {
        k.rule({ x: box.x + pad, y: box.y + pad + (i + 1) * gap - gap * 0.35, w: box.w - pad * 2, h: k.hairline() }, "border", `answer-line-${i}`);
      }
    }
    return k.done();
  },
});

/* ---------------- activity & flashcard ---------------- */

export const activityCard = defineLayout({
  id: "activity-card",
  name: "Activity",
  kinds: ["activity", "steps"],
  orientation: "any",
  fit: (s) => {
    if (s.kind === "activity") return 82;
    return s.steps && s.hasBody ? 26 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const on = { text: "onAccent" as Paint, muted: { color: "onAccent" as Paint, opacity: 0.85 }, accent: "onAccent" as Paint };
    const d = Math.round(56 * k.s);
    const icon = knownIcon(content.icon) ?? "puzzle";
    const source = listSource(content, ["steps", "items", "bullets"]);
    const iconBlock = (x: number): StackBlock => ({
      h: d,
      draw: (y) => k.badge(x + d / 2, y + d / 2, d, { slot: "activity", icon, tone: "surface" }),
    });
    if (k.landscape) {
      const panelW = k.col(0, 5).w;
      const panel = { x: k.safe.x, y: k.safe.y, w: panelW, h: k.safe.h };
      k.card(panel, { slot: "activity-card", tone: "accent" });
      const pad = Math.round(k.pad * 1.5);
      const blocks = [iconBlock(panel.x + pad), ...k.headerBlocks(panel.w - pad * 2, { titleStyle: "title", titleMaxH: panel.h * 0.45, ink: on })];
      if (blocks[1]) blocks[1].gap = k.u * 3;
      k.vstack(panel.x + pad, panel.y + pad, panel.h - pad * 2, blocks, "middle", 0.45);
      const right = k.col(6, 6);
      const area = { x: right.x, y: k.safe.y, w: right.w, h: k.safe.h };
      let y = area.y;
      if (clean(content.body)) y = k.paragraph({ x: area.x, y, w: area.w, h: area.h * (source ? 0.34 : 1) }, { style: "body" }) + k.u * 3;
      if (source) k.list({ x: area.x, y, w: area.w, h: k.bottom - y }, source, { marker: source.field === "bullets" ? "dot" : "number" });
    } else {
      const pad = Math.round(k.pad * 1.3);
      const w = k.safe.w - pad * 2;
      const blocks = [iconBlock(k.safe.x + pad), ...k.headerBlocks(w, { titleStyle: "title", titleMaxH: k.safe.h * 0.24, ink: on })];
      if (blocks[1]) blocks[1].gap = k.u * 2;
      const h = k.stackHeight(blocks) + pad * 2;
      const panel = { x: k.safe.x, y: k.safe.y, w: k.safe.w, h };
      k.card(panel, { slot: "activity-card", tone: "accent" });
      k.vstack(panel.x + pad, panel.y + pad, h - pad * 2, blocks, "top");
      let y = panel.y + h + k.u * 4;
      if (clean(content.body)) y = k.paragraph({ x: k.safe.x, y, w: k.safe.w, h: (k.bottom - y) * (source ? 0.35 : 1) }, { style: "body" }) + k.u * 3;
      if (source) k.list({ x: k.safe.x, y, w: k.safe.w, h: Math.max(0, k.bottom - y) }, source, { marker: source.field === "bullets" ? "dot" : "number" });
    }
    return k.done();
  },
});

function answerText(content: LayoutKit["content"]): string {
  const q = content.question;
  if (!q) return "";
  if (typeof q.answer === "string" && clean(q.answer)) return clean(q.answer);
  const choices = choicesOf(content);
  if (typeof q.answer === "number" && choices[q.answer]) return choices[q.answer];
  return clean(q.explanation);
}

export const flashcard = defineLayout({
  id: "flashcard",
  name: "Flashcard",
  kinds: ["definition", "glossary", "question", "quiz"],
  orientation: "any",
  deckKinds: { social: 1.2, design: 1.2 },
  fit: (s, content, ctx) => {
    const square = orientationOf(ctx.width, ctx.height) !== "landscape";
    let base = 0;
    if (s.terms === 1) base = 62;
    else if (s.hasQuestion && s.choices === 0 && !s.trueFalse && answerText(content)) base = 58;
    return base + (base && square ? 10 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const terms = entriesOf(content, "terms");
    const term = terms[0];
    const prompt = clean(content.question?.prompt);
    let front: { text: string; slot: string };
    let back: { text: string; slot: string };
    if (term) {
      front = { text: term.title, slot: term.slotTitle };
      back = { text: term.body ?? "", slot: term.slotBody };
    } else if (prompt) {
      front = { text: prompt, slot: "question" };
      back = { text: answerText(content), slot: "answer" };
    } else {
      front = { text: clean(content.title), slot: "title" };
      back = { text: clean(content.body), slot: "body" };
    }
    let top = k.safe.y;
    const showTitle = front.slot !== "title" && clean(content.title).toLowerCase() !== front.text.toLowerCase();
    const head: StackBlock[] = [];
    if (clean(content.kicker)) head.push({ m: k.measure({ text: clean(content.kicker), style: "label", role: "kicker", slot: "kicker", w: k.safe.w, align: "center", color: k.ink.accentSmall }) });
    if (showTitle) head.push({ m: k.measure({ text: clean(content.title), style: "subheading", role: "title", slot: "title", w: k.safe.w, maxH: k.safe.h * 0.12, weight: 600, align: "center", ...k.mutedSpec() }), gap: k.u });
    if (clean(content.subtitle)) head.push({ m: k.measure({ text: clean(content.subtitle), style: "body", role: "subtitle", slot: "subtitle", w: k.safe.w, maxH: k.safe.h * 0.1, align: "center", ...k.mutedSpec() }), gap: k.u });
    if (head.length) top = k.vstack(k.safe.x, k.safe.y, k.safe.h, head, "top").bottom + k.u * 4;
    k.use("title", "kicker", "subtitle");
    const cardW = k.landscape ? k.col(1, 10).w : k.safe.w;
    const box = { x: k.safe.x + (k.safe.w - cardW) / 2, y: top, w: cardW, h: k.bottom - top };
    k.card(box, { slot: "flashcard" });
    const pad = Math.round(k.pad * 1.5);
    const half = (box.h - pad * 2) / 2;
    const w = box.w - pad * 2;
    k.rule({ x: box.x + pad, y: box.y + box.h / 2, w, h: k.hairline() }, "border", "fold");
    const f = k.measure({ text: front.text, style: "title", role: front.slot === "question" ? "title" : "item-title", slot: front.slot, w, maxH: half - k.u * 2, align: "center", color: "text" });
    k.place(f, box.x + pad, box.y + pad + (half - f.h) / 2);
    let backRest = "";
    if (back.text) {
      const style = k.style("subheading");
      const split = splitTextToFit(back.text, style, w, half - k.u * 3, k.ctx.measure);
      const b = k.measure({ text: split.fit, style: "subheading", role: back.slot === "answer" ? "answer" : "item-body", slot: back.slot, w, size: split.fontSize, align: "center", color: "muted" });
      k.place(b, box.x + pad, box.y + box.h / 2 + k.u * 2 + (half - k.u * 2 - b.h) / 2);
      backRest = split.rest;
    }
    if (term) {
      k.use("terms");
      k.continueList("terms", backRest ? [{ ...term, body: backRest }, ...terms.slice(1)] : terms.slice(1));
    } else if (prompt) {
      k.use("question");
      if (backRest && content.question) k.continueWith({ question: { ...content.question, answer: backRest } });
    } else {
      k.use("body");
      if (backRest) k.continueWith({ body: backRest });
    }
    return k.done();
  },
});

export const LEARNING_LAYOUTS: LayoutDef[] = [definitionCard, glossaryGrid, questionChoices, questionTrueFalse, questionOpen, activityCard, flashcard];
