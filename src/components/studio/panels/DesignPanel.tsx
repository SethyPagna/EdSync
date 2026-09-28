"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { applyDeckTheme } from "@/lib/studio/theme-apply";
import { BACKGROUND_GROUPS, BACKGROUND_PRESETS, BRAND_PALETTES, DECK_THEMES, ensureFontPairLoaded, FONT_PAIRS, FORMAT_GROUPS, backgroundCss, getDeckTheme, readableOn, resolvePaint, themeColors, type BackgroundGroup } from "@/lib/studio/library";
import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import ScenePreview from "../preview/ScenePreview";
import { useStudio } from "../store";
import { PanelChips, PanelEmpty, PanelSearch, PanelSection } from "./parts/PanelControls";
import { rememberFontPair } from "./parts/recent-fonts";

type Section = "themes" | "fonts" | "colors" | "backgrounds" | "resize";
const SECTIONS: { id: Section; name: string }[] = [{ id: "themes", name: "Themes" }, { id: "fonts", name: "Fonts" }, { id: "colors", name: "Colors" }, { id: "backgrounds", name: "Backgrounds" }, { id: "resize", name: "Resize" }];

function themeScene(deck: SceneDeck, page: ScenePage, themeId: string) {
  const theme = getDeckTheme(themeId);
  const preview = applyDeckTheme({ ...deck, colorOverrides: undefined, pages: [page] }, theme);
  return { page: preview.pages[0], deck: preview };
}

export default function DesignPanel() {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const applyTheme = useStudio((state) => state.applyTheme);
  const setFontPair = useStudio((state) => state.setFontPair);
  const setColorOverrides = useStudio((state) => state.setColorOverrides);
  const setBackground = useStudio((state) => state.setBackground);
  const setFormat = useStudio((state) => state.setFormat);
  const [section, setSection] = useState<Section>("themes");
  const [query, setQuery] = useState("");
  const [backgroundGroup, setBackgroundGroup] = useState<BackgroundGroup>("theme");
  const [backgroundScope, setBackgroundScope] = useState<"page" | "all">("page");
  const [resizeOpen, setResizeOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [error, setError] = useState("");
  const page = deck?.pages.find((entry) => entry.id === activePageId);
  const colors = useMemo(() => deck ? themeColors(getDeckTheme(deck.themeId), deck.colorOverrides) : null, [deck]);
  const matches = (name: string, tags: readonly string[] = []) => !query || [name, ...tags].some((value) => value.toLowerCase().includes(query.toLowerCase()));
  const themes = DECK_THEMES.filter((theme) => matches(theme.name, theme.tags));
  const fonts = FONT_PAIRS.filter((pair) => matches(pair.name, [pair.heading, pair.body, ...pair.mood]));
  const palettes = BRAND_PALETTES.filter((palette) => matches(palette.name, palette.tags));
  const backgrounds = BACKGROUND_PRESETS.filter((preset) => preset.group === backgroundGroup && matches(preset.name));
  const formats = FORMAT_GROUPS.map((group) => ({ ...group, formats: group.formats.filter((format) => matches(format.name, [format.description])) })).filter((group) => group.formats.length);

  const changeFont = async (id: string) => {
    const pair = FONT_PAIRS.find((entry) => entry.id === id);
    if (!pair) return;
    setError("");
    try { await ensureFontPairLoaded(pair); } catch { setError("Font could not load; using a fallback."); }
    setFontPair(id);
    rememberFontPair(id);
  };

  const applyBackground = (preset: (typeof BACKGROUND_PRESETS)[number]) => {
    if (!deck) return;
    if (backgroundScope === "all") for (const entry of deck.pages) setBackground(preset.background, entry.id);
    else setBackground(preset.background);
  };

  if (!deck || !page || !colors) return null;
  return <div role="tabpanel" aria-label="Design" className="pb-4">
    <PanelSearch value={query} onChange={setQuery} placeholder="Search design" />
    <PanelChips<Section> value={section} onChange={setSection} items={SECTIONS} label="Design sections" />
    {error && <p role="alert" className="px-3 pt-2 text-xs text-warning">{error}</p>}
    {section === "themes" && <><PanelSection title="Themes" /><div className="grid grid-cols-2 gap-2 px-3">{themes.map((theme) => {
      const preview = themeScene(deck, page, theme.id);
      return <button key={theme.id} type="button" onClick={() => applyTheme(theme.id)} aria-label={`Apply ${theme.name} theme`} aria-pressed={deck.themeId === theme.id} className="min-w-0 overflow-hidden rounded-lg border border-line text-left hover:border-accent aria-pressed:border-accent"><ScenePreview page={preview.page} deck={preview.deck} width={128} className="mx-auto" /><span className="flex items-center justify-between px-2 py-1.5 text-xs text-fg">{theme.name}{deck.themeId === theme.id && <Check size={13} />}</span></button>;
    })}</div>{!themes.length && <PanelEmpty>No themes match.</PanelEmpty>}</>}
    {section === "fonts" && <><PanelSection title="Font pairs" /><div className="space-y-1.5 px-3">{fonts.map((pair) => <button key={pair.id} type="button" onClick={() => void changeFont(pair.id)} aria-pressed={deck.fontPairId === pair.id} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-elevated px-3 py-2.5 text-left hover:border-accent aria-pressed:border-accent"><span className="min-w-0"><span className="block truncate text-base text-fg" style={{ fontFamily: `"${pair.heading}", serif` }}>{pair.name}</span><span className="block truncate text-[11px] text-fg-muted" style={{ fontFamily: `"${pair.body}", sans-serif` }}>{pair.heading} + {pair.body}</span></span>{deck.fontPairId === pair.id && <Check size={15} className="shrink-0 text-accent" />}</button>)}</div>{!fonts.length && <PanelEmpty>No fonts match.</PanelEmpty>}</>}
    {section === "colors" && <><PanelSection title="Brand palettes" action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setColorOverrides({})} aria-label="Reset brand palette"><RotateCcw size={14} /> Reset</button>} /><div className="space-y-2 px-3">{palettes.map((palette) => <button key={palette.id} type="button" onClick={() => setColorOverrides({ accent: palette.colors[0], accent2: palette.colors[1], onAccent: readableOn(palette.colors[0]) })} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-elevated p-2 text-left hover:border-accent"><span className="min-w-0 truncate text-xs text-fg">{palette.name}</span><span className="flex shrink-0 overflow-hidden rounded-md border border-line">{palette.colors.map((color, index) => <span key={index} className="h-6 w-5" style={{ backgroundColor: color }} />)}</span></button>)}</div>{!palettes.length && <PanelEmpty>No palettes match.</PanelEmpty>}</>}
    {section === "backgrounds" && <><PanelSection title="Background" /><div className="mx-3 mb-3 segmented" role="radiogroup" aria-label="Apply background to"><button type="button" role="radio" aria-checked={backgroundScope === "page"} data-active={backgroundScope === "page"} className="segmented-item" onClick={() => setBackgroundScope("page")}>This page</button><button type="button" role="radio" aria-checked={backgroundScope === "all"} data-active={backgroundScope === "all"} className="segmented-item" onClick={() => setBackgroundScope("all")}>All pages</button></div><div className="flex gap-1 overflow-x-auto px-3 pb-2" role="radiogroup" aria-label="Background styles">{BACKGROUND_GROUPS.map((group) => <button key={group.id} type="button" role="radio" aria-checked={backgroundGroup === group.id} data-active={backgroundGroup === group.id} onClick={() => setBackgroundGroup(group.id)} className="chip shrink-0 text-xs">{group.name}</button>)}</div><div className="grid grid-cols-3 gap-2 px-3">{backgrounds.map((preset) => <button key={preset.id} type="button" onClick={() => applyBackground(preset)} aria-label={`Apply ${preset.name} background to ${backgroundScope === "page" ? "this page" : "all pages"}`} className="min-w-0 rounded-lg border border-line bg-elevated p-1 hover:border-accent"><span className="block h-12 rounded-md border border-line" style={{ background: backgroundCss(preset.background, (paint) => resolvePaint(paint, colors)) }} /><span className="block truncate pt-1 text-[11px] text-fg">{preset.name}</span></button>)}</div>{!backgrounds.length && <PanelEmpty>No backgrounds match.</PanelEmpty>}</>}
    {section === "resize" && <><PanelSection title="Resize design" /><div className="space-y-3 px-3">{formats.map((group) => <div key={group.id}><h4 className="mb-1 text-[11px] font-medium text-fg-muted">{group.name}</h4><div className="space-y-1">{group.formats.map((format) => <button key={format.id} type="button" onClick={() => { setSelectedFormat(format.id); setResizeOpen(true); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-fg hover:bg-surface-2"><span>{format.name}</span><span className="text-[11px] text-fg-faint">{format.size}</span></button>)}</div></div>)}</div>{!formats.length && <PanelEmpty>No formats match.</PanelEmpty>}</>}
    <Dialog open={resizeOpen} onClose={() => setResizeOpen(false)} title="Resize design" size="sm" footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setResizeOpen(false)}>Cancel</button><button type="button" className="btn btn-primary btn-sm" onClick={() => { setFormat(selectedFormat); setResizeOpen(false); }}>Resize</button></>}><p className="text-xs text-fg-muted">Pages and elements will reflow to the new size.</p></Dialog>
  </div>;
}
