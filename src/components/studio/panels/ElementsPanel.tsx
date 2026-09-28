"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BarChart3, Frame, Grid2X2, Shapes, Sparkles } from "lucide-react";
import { CHART_KINDS, ELEMENT_CATEGORIES, ICONS, SAMPLE_CHART_DATA, SHAPES, getDeckTheme, iconSvg, searchElementKits, searchIcons, shapeSvg, type ChartKind } from "@/lib/studio/library";
import type { ChartElement, SceneDeck, SceneElement, ShapeElement } from "@/lib/studio/scene";
import { useStudio } from "../store";
import ChartDataEditor from "./parts/ChartDataEditor";
import { PanelChips, PanelEmpty, PanelSearch, PanelSection } from "./parts/PanelControls";
import { centeredBox, insertElements, newElementId, writeElementDrag } from "./parts/insertion";

type Category = "all" | "shapes" | "icons" | "kits" | "charts" | "tables";
const CATEGORIES: { id: Category; name: string }[] = [{ id: "all", name: "All" }, { id: "shapes", name: "Shapes" }, { id: "icons", name: "Icons" }, { id: "kits", name: "Kits" }, { id: "charts", name: "Charts" }, { id: "tables", name: "Tables" }];

function InsertTile({ label, build, children, className = "" }: { label: string; build(): SceneElement[]; children: ReactNode; className?: string }) {
  return <button type="button" draggable aria-label={`Add ${label}`} title={`Click to add or drag ${label}`} onClick={() => insertElements(build())} onDragStart={(event) => writeElementDrag(event, build())} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-elevated p-2 text-center text-xs text-fg transition-colors hover:border-accent focus-visible:border-accent ${className}`}>{children}<span className="block w-full truncate">{label}</span></button>;
}

function IconGrid({ icons, deck }: { icons: typeof ICONS; deck: SceneDeck }) {
  const parent = useRef<HTMLDivElement>(null);
  const rows = Math.ceil(icons.length / 4);
  // TanStack Virtual owns its memoization and updates through its scroll observer.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: rows, getScrollElement: () => parent.current, estimateSize: () => 68, overscan: 3 });
  return <div ref={parent} tabIndex={0} className="max-h-[min(55vh,470px)] overflow-y-auto px-3" role="region" aria-label="Icons" onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.currentTarget.scrollBy({ top: event.key === "ArrowDown" ? 68 : -68 }); } }}><div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>{virtualizer.getVirtualItems().map((row) => <div key={row.key} className="absolute left-0 grid w-full grid-cols-4 gap-1" style={{ transform: `translateY(${row.start}px)` }}>{icons.slice(row.index * 4, row.index * 4 + 4).map((icon) => <InsertTile key={icon.id} label={icon.name} build={() => [{ id: newElementId(), kind: "icon", role: "icon", icon: icon.id, color: "accent", ...centeredBox(deck, 0.17) }]} className="h-16" ><span aria-hidden className="flex h-6 items-center justify-center [&_svg]:h-5 [&_svg]:w-5" dangerouslySetInnerHTML={{ __html: iconSvg(icon.id, { color: deck.colorOverrides?.accent ?? getDeckTheme(deck.themeId).colors.accent, size: 22 }) ?? "" }} /></InsertTile>)}</div>)}</div></div>;
}

export default function ElementsPanel() {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const selectionIds = useStudio((state) => state.selectionIds);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [kitCategory, setKitCategory] = useState<string>("all");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const page = deck?.pages.find((entry) => entry.id === activePageId);
  const selected = page?.elements.find((element) => element.id === selectionIds[0]);
  const chart = selected?.kind === "chart" ? selected : null;
  const q = query.trim().toLowerCase();
  const shapes = useMemo(() => SHAPES.filter((shape) => !q || [shape.name, shape.category, ...shape.keywords].some((value) => value.toLowerCase().includes(q))), [q]);
  const icons = useMemo(() => searchIcons(q), [q]);
  const kits = useMemo(() => searchElementKits(q).filter((kit) => kitCategory === "all" || kit.category === kitCategory), [q, kitCategory]);
  const charts = CHART_KINDS.filter((kind) => !q || `${kind.name} chart graph data`.toLowerCase().includes(q));
  const show = (section: Category) => category === "all" || category === section;

  if (!deck) return null;

  const addShape = (shape: (typeof SHAPES)[number]): ShapeElement[] => {
    const box = centeredBox(deck, shape.line ? 0.48 : 0.3, shape.aspect);
    if (shape.line) { box.h = 0.012; box.y = (1 - box.h) / 2; }
    return [{ id: newElementId(), kind: "shape", role: shape.line ? "line" : "shape", shape: shape.kind, fill: shape.line ? "transparent" : "accent", stroke: shape.line ? "accent" : undefined, strokeWidth: shape.line ? 4 : undefined, dash: shape.dash ? [...shape.dash] : undefined, radius: shape.radius, ...box }];
  };
  const addChart = (kind: ChartKind): ChartElement[] => [{ id: newElementId(), kind: "chart", role: "chart", chart: kind, data: SAMPLE_CHART_DATA[kind].map((datum) => ({ ...datum })), color: "accent", showLabels: true, ...centeredBox(deck, 0.58, 1.6) }];
  const addTable = (): SceneElement[] => [{ id: newElementId(), kind: "table", role: "table", rows: Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => row === 0 ? `Heading ${col + 1}` : "")), header: true, fill: "surface", color: "text", stroke: "border", ...centeredBox(deck, 0.6, cols / Math.max(1, rows) * 1.4) }];

  return <div role="tabpanel" aria-label="Elements" className="pb-4">
    <PanelSearch value={query} onChange={setQuery} placeholder="Search elements" />
    <PanelChips<Category> value={category} onChange={setCategory} items={CATEGORIES} label="Element categories" />
    {chart && <><PanelSection title="Selected chart" /><div className="px-3"><ChartDataEditor key={chart.id} chart={chart} /></div></>}
    {show("shapes") && shapes.length > 0 && <><PanelSection title="Shapes & lines" /><div className="grid grid-cols-3 gap-1.5 px-3">{shapes.slice(0, category === "all" && !q ? 9 : undefined).map((shape) => <InsertTile key={shape.kind} label={shape.name} build={() => addShape(shape)} className="h-20"><span aria-hidden className="flex h-8 items-center justify-center [&_svg]:h-7 [&_svg]:w-9" dangerouslySetInnerHTML={{ __html: shapeSvg(shape.kind, 36, 28, { fill: "currentColor", stroke: "currentColor", strokeWidth: 2 }) }} /></InsertTile>)}</div></>}
    {show("kits") && kits.length > 0 && <><PanelSection title="Element kits" /><div className="flex gap-1 overflow-x-auto px-3 pb-2" role="radiogroup" aria-label="Kit categories"><button type="button" role="radio" aria-checked={kitCategory === "all"} data-active={kitCategory === "all"} onClick={() => setKitCategory("all")} className="chip shrink-0 text-xs">All</button>{ELEMENT_CATEGORIES.map((entry) => <button key={entry.id} type="button" role="radio" aria-checked={kitCategory === entry.id} data-active={kitCategory === entry.id} onClick={() => setKitCategory(entry.id)} className="chip shrink-0 text-xs">{entry.name}</button>)}</div><div className="grid grid-cols-2 gap-1.5 px-3">{kits.slice(0, category === "all" && !q ? 8 : undefined).map((kit) => <InsertTile key={kit.id} label={kit.name} build={() => kit.build({ x: 0.22, y: 0.26, width: deck.width, height: deck.height, newId: newElementId })} className="h-[72px]"><span aria-hidden className="flex h-6 items-center text-accent">{kit.category === "frames" ? <Frame size={22} /> : kit.category === "charts" ? <BarChart3 size={22} /> : kit.category === "tables" ? <Grid2X2 size={22} /> : kit.category === "callouts" ? <Sparkles size={22} /> : <Shapes size={22} />}</span></InsertTile>)}</div></>}
    {show("charts") && charts.length > 0 && <><PanelSection title="Charts" /><div className="grid grid-cols-2 gap-1.5 px-3">{charts.map((kind) => <InsertTile key={kind.id} label={`${kind.name} chart`} build={() => addChart(kind.id)} className="h-20"><BarChart3 aria-hidden size={23} className="text-accent" /></InsertTile>)}</div></>}
    {show("tables") && <><PanelSection title="Table" /><div className="flex items-end gap-2 px-3"><label className="min-w-0 flex-1 text-[11px] text-fg-muted">Rows<input aria-label="Table rows" className="input mt-1 w-full" type="number" min={1} max={12} value={rows} onChange={(event) => setRows(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} /></label><label className="min-w-0 flex-1 text-[11px] text-fg-muted">Columns<input aria-label="Table columns" className="input mt-1 w-full" type="number" min={1} max={12} value={cols} onChange={(event) => setCols(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} /></label><InsertTile label="table" build={addTable} className="h-[34px] flex-1 flex-row gap-1 p-1"><Grid2X2 size={15} /></InsertTile></div></>}
    {show("icons") && icons.length > 0 && <><PanelSection title={`Icons · ${icons.length}`} /><IconGrid icons={category === "all" && !q ? icons.slice(0, 32) : icons} deck={deck} />{category === "all" && !q && ICONS.length > 32 && <button type="button" className="btn btn-ghost btn-sm mx-3 mt-2" onClick={() => setCategory("icons")}>See all icons</button>}</>}
    {!shapes.length && !icons.length && !kits.length && !charts.length && <PanelEmpty>No elements match.</PanelEmpty>}
  </div>;
}
