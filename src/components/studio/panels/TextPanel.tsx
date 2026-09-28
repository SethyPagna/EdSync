"use client";

import { useEffect, useMemo, useState } from "react";
import { AlignLeft, Quote, Type } from "lucide-react";
import { FONT_PAIRS, TEXT_PRESETS, ensureFontPairLoaded, fontStack, getFontPair, resolveTextStyle } from "@/lib/studio/library";
import type { SceneDeck, SceneElement, TextElement, TextStyleToken } from "@/lib/studio/scene";
import { useStudio } from "../store";
import { PanelChips, PanelEmpty, PanelSearch, PanelSection } from "./parts/PanelControls";
import { centeredBox, insertElements, newElementId, writeElementDrag } from "./parts/insertion";
import { recentFontPairs, rememberFontPair } from "./parts/recent-fonts";

type Section = "styles" | "combinations" | "recent";
const SECTIONS: { id: Section; name: string }[] = [{ id: "styles", name: "Styles" }, { id: "combinations", name: "Combinations" }, { id: "recent", name: "Recent fonts" }];

function textElement(deck: SceneDeck, style: TextStyleToken, text: string, box?: { x: number; y: number; w: number; h: number }, fontFamily?: string): TextElement {
  const pair = getFontPair(deck.fontPairId);
  const resolved = resolveTextStyle(style, pair, deck);
  const geometry = box ?? centeredBox(deck, 0.7, style === "body" || style === "caption" ? 7 : 5);
  return { id: newElementId(), kind: "text", role: style === "title" || style === "heading" ? "title" : style === "quote" ? "quote" : "body", text, style, color: "text", fontFamily: fontFamily ?? (style === "title" || style === "heading" || style === "quote" ? "heading" : "body"), fontSize: resolved.fontSize, fontWeight: resolved.fontWeight, autoFit: true, verticalAlign: "middle", ...geometry };
}

function InsertText({ label, build, sample, className = "" }: { label: string; build(): SceneElement[]; sample: React.ReactNode; className?: string }) {
  return <button type="button" draggable aria-label={`Add ${label}`} title={`Click to add or drag ${label}`} onClick={() => insertElements(build())} onDragStart={(event) => writeElementDrag(event, build())} className={`w-full rounded-lg border border-line bg-elevated px-3 py-3 text-left hover:border-accent focus-visible:border-accent ${className}`}>{sample}</button>;
}

export default function TextPanel() {
  const deck = useStudio((state) => state.deck);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<Section>("styles");
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => setRecent(recentFontPairs());
    sync();
    window.addEventListener("edsync-studio-fonts-change", sync);
    return () => window.removeEventListener("edsync-studio-fonts-change", sync);
  }, []);

  useEffect(() => {
    if (deck?.fontPairId) rememberFontPair(deck.fontPairId);
  }, [deck?.fontPairId]);

  const presets = useMemo(() => TEXT_PRESETS.filter((preset) => `${preset.name} ${preset.style}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const recentPairs = FONT_PAIRS.filter((pair) => recent.includes(pair.id) && `${pair.name} ${pair.heading} ${pair.body}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  if (!deck) return null;
  const pair = getFontPair(deck.fontPairId);

  const insertPair = async (pairId: string) => {
    const target = FONT_PAIRS.find((entry) => entry.id === pairId);
    if (!target) return;
    setError("");
    try { await ensureFontPairLoaded(target); } catch { setError("Font could not load; using a fallback."); }
    insertElements([textElement(deck, "heading", target.name, undefined, target.heading)]);
    rememberFontPair(pairId);
  };

  const combination = (kind: "title" | "quote") => {
    const group = newElementId();
    if (kind === "title") return [
      { ...textElement(deck, "title", "Your title", { x: 0.16, y: 0.33, w: 0.68, h: 0.12 }), group },
      { ...textElement(deck, "body", "Add a supporting line", { x: 0.16, y: 0.47, w: 0.68, h: 0.07 }), group, color: "muted" },
    ];
    return [
      { ...textElement(deck, "quote", "“Your quote here”", { x: 0.18, y: 0.32, w: 0.64, h: 0.2 }), group },
      { ...textElement(deck, "caption", "— Author", { x: 0.18, y: 0.53, w: 0.64, h: 0.05 }), group, color: "muted" },
    ];
  };

  return <div role="tabpanel" aria-label="Text" className="pb-4">
    <PanelSearch value={query} onChange={setQuery} placeholder="Search text" />
    <PanelChips<Section> value={section} onChange={setSection} items={SECTIONS} label="Text sections" />
    {error && <p role="alert" className="px-3 pt-2 text-xs text-warning">{error}</p>}
    {section === "styles" && <><PanelSection title="Add text" /><div className="space-y-1.5 px-3">{presets.map((preset) => <InsertText key={preset.id} label={preset.name} build={() => [textElement(deck, preset.style, preset.sample)]} sample={<span className="block truncate text-fg" style={{ fontFamily: fontStack(["display", "title", "heading", "quote", "stat"].includes(preset.style) ? pair.heading : pair.body), fontSize: preset.style === "title" ? 20 : preset.style === "heading" || preset.style === "quote" ? 17 : preset.style === "body" ? 14 : 12, fontWeight: ["title", "heading"].includes(preset.style) ? 600 : 400 }}>{preset.sample}</span>} />)}</div>{!presets.length && <PanelEmpty>No text styles match.</PanelEmpty>}</>}
    {section === "combinations" && <><PanelSection title="Combinations" /><div className="space-y-2 px-3">{(!query || "title subtitle heading".includes(query.toLowerCase())) && <InsertText label="title and subtitle" build={() => combination("title")} sample={<><span className="block truncate text-lg font-semibold text-fg" style={{ fontFamily: fontStack(pair.heading) }}>Your title</span><span className="block truncate text-xs text-fg-muted" style={{ fontFamily: fontStack(pair.body) }}>A supporting line</span></>} />}{(!query || "quote attribution".includes(query.toLowerCase())) && <InsertText label="quote and attribution" build={() => combination("quote")} sample={<><span className="flex items-center gap-1 text-base text-fg" style={{ fontFamily: fontStack(pair.heading) }}><Quote size={15} /> Your quote here</span><span className="block pl-5 text-xs text-fg-muted">— Author</span></>} />}</div><PanelSection title="Current fonts" /><div className="mx-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3 text-xs"><Type size={16} className="text-fg-muted" /><span className="min-w-0 truncate">{pair.heading}</span><AlignLeft size={16} className="ml-auto shrink-0 text-fg-muted" /><span className="min-w-0 truncate">{pair.body}</span></div></>}
    {section === "recent" && <><PanelSection title="Recent fonts" /><div className="space-y-1.5 px-3">{recentPairs.map((fontPair) => <button key={fontPair.id} type="button" onClick={() => void insertPair(fontPair.id)} className="block w-full rounded-lg border border-line bg-elevated px-3 py-2 text-left hover:border-accent"><span className="block truncate text-base text-fg" style={{ fontFamily: fontStack(fontPair.heading) }}>{fontPair.name}</span><span className="block truncate text-[11px] text-fg-muted">{fontPair.heading} + {fontPair.body}</span></button>)}</div>{!recentPairs.length && <PanelEmpty>Choose a font in Design to see it here.</PanelEmpty>}</>}
  </div>;
}
