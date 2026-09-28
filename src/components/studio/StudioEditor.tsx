"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ChevronDown, Copy, Eye, EyeOff, Grid2X2, GripVertical, ImagePlus, Layers, LayoutTemplate, Lock, MoreHorizontal, Plus, Redo2, Save, Sparkles, Trash2, Type, Undo2, Upload, WandSparkles, X } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { getDeckTheme, resolvePaint, themeColors } from "@/lib/studio/library";
import { snapElementPosition, type SnapGuide } from "@/lib/studio/editor/snapping";
import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import { fabricObjectToScene, syncFabricPage, type StudioFabricObject } from "./fabric/adapter";
import ExportMenu from "./export/ExportMenu";
import { uploadStudioImage } from "./lib/upload";
import { placeDraggedElements } from "./lib/drop";
import { STUDIO_ELEMENT_DRAG_MIME } from "./panels/parts/insertion";
import DesignPanel from "./panels/DesignPanel";
import ElementsPanel from "./panels/ElementsPanel";
import LayersPanel from "./panels/LayersPanel";
import MagicPanel from "./panels/MagicPanel";
import TemplatesPanel from "./panels/TemplatesPanel";
import TextPanel from "./panels/TextPanel";
import UploadsPanel from "./panels/UploadsPanel";
import PresentMode from "./present/PresentMode";
import ScenePreview from "./preview/ScenePreview";
import { useStudio, type StudioPanel } from "./store";

const panels = [
  { id: "design", label: "Design", icon: WandSparkles, component: DesignPanel },
  { id: "templates", label: "Templates", icon: LayoutTemplate, component: TemplatesPanel },
  { id: "elements", label: "Elements", icon: Sparkles, component: ElementsPanel },
  { id: "text", label: "Text", icon: Type, component: TextPanel },
  { id: "uploads", label: "Uploads", icon: Upload, component: UploadsPanel },
  { id: "magic", label: "Magic", icon: Sparkles, component: MagicPanel },
  { id: "layers", label: "Layers", icon: Layers, component: LayersPanel },
] as const;

function SortablePageCard({ entry, index, deck, activePageId, editingPageId, setEditingPageId, setNotesOpen }: {
  entry: ScenePage;
  index: number;
  deck: SceneDeck;
  activePageId: string | null;
  editingPageId: string | null;
  setEditingPageId(value: string | null): void;
  setNotesOpen(value: boolean): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative w-[120px] shrink-0 rounded-lg border p-1 ${entry.id === activePageId ? "border-accent" : "border-line"} ${entry.hidden ? "opacity-50" : ""} ${isDragging ? "z-10 shadow-xl" : ""}`}>
    <button type="button" onClick={() => useStudio.getState().setActivePage(entry.id)} className="block w-full" aria-label={`Open page ${index + 1}`} aria-current={entry.id === activePageId ? "page" : undefined}><ScenePreview page={entry} deck={deck} width={110} /></button>
    <div className="flex items-center gap-0.5">
      <button type="button" {...attributes} {...listeners} aria-label={`Reorder page ${index + 1}`} className="touch-none rounded p-0.5 text-fg-muted hover:bg-surface-2" title="Drag to reorder"><GripVertical size={13} /></button>
      {editingPageId === entry.id ? <input autoFocus aria-label={`Rename page ${index + 1}`} value={entry.name ?? ""} onChange={(event) => useStudio.getState().renamePage(entry.id, event.target.value)} onBlur={() => setEditingPageId(null)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setEditingPageId(null); }} className="min-w-0 flex-1 rounded border border-line bg-bg px-1 text-center text-[11px] outline-none" /> : <button type="button" onDoubleClick={() => setEditingPageId(entry.id)} onClick={() => useStudio.getState().setActivePage(entry.id)} className="min-w-0 flex-1 truncate pt-1 text-center text-[11px] text-fg-muted">{entry.name || `Page ${index + 1}`}</button>}
    </div>
    <Menu label={`Page ${index + 1} actions`} side="top" trigger={<button type="button" aria-label={`Page ${index + 1} actions`} className="absolute right-1 top-1 rounded bg-surface/90 p-1 text-fg shadow-sm"><MoreHorizontal size={14} /></button>} items={[
      { label: "Duplicate page", icon: Copy, onSelect: () => useStudio.getState().duplicatePage(entry.id) },
      { label: "Rename page", onSelect: () => setEditingPageId(entry.id) },
      { label: entry.hidden ? "Show page" : "Hide page", icon: entry.hidden ? Eye : EyeOff, onSelect: () => useStudio.getState().hidePage(entry.id, !entry.hidden) },
      { label: "Move left", disabled: index === 0, onSelect: () => useStudio.getState().movePage(entry.id, index - 1) },
      { label: "Move right", disabled: index === deck.pages.length - 1, onSelect: () => useStudio.getState().movePage(entry.id, index + 1) },
      { label: "Speaker notes", onSelect: () => { useStudio.getState().setActivePage(entry.id); setNotesOpen(true); } },
      { separator: true },
      { label: "Delete page", icon: Trash2, danger: true, disabled: deck.pages.length === 1, onSelect: () => useStudio.getState().deletePage(entry.id) },
    ]} />
  </div>;
}

export default function StudioEditor({ onBack, onSave }: { onBack(): void; onSave(): Promise<void> }) {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const selectionIds = useStudio((state) => state.selectionIds);
  const zoom = useStudio((state) => state.zoom);
  const pan = useStudio((state) => state.pan);
  const activePanel = useStudio((state) => state.activePanel);
  const savingState = useStudio((state) => state.savingState);
  const history = useStudio((state) => state.history);
  const setPanel = useStudio((state) => state.setPanel);
  const setZoom = useStudio((state) => state.setZoom);
  const setPan = useStudio((state) => state.setPan);
  const pageSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [gridView, setGridView] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const canvasRef = useRef<Canvas | null>(null);
  const activeSelectionRef = useRef<typeof import("fabric")["ActiveSelection"] | null>(null);
  const rendering = useRef(0);
  const restoringSelection = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const spaceDown = useRef(false);
  const dragPoint = useRef<{ x: number; y: number } | null>(null);
  const page = deck?.pages.find((entry) => entry.id === activePageId) ?? null;
  const selected = page?.elements.find((element) => element.id === selectionIds[0]);
  const scale = deck ? Math.max(0.1, Math.min((stageSize.width - 64) / deck.width, (stageSize.height - 64) / deck.height)) * zoom : 1;
  const palette = useMemo(() => deck ? themeColors(getDeckTheme(deck.themeId), deck.colorOverrides) : null, [deck]);

  const syncSelection = useCallback((canvas: Canvas) => {
    const ids = useStudio.getState().selectionIds;
    const selectedObjects = ids.map((id) => canvas.getObjects().find((object) => (object as StudioFabricObject).esId === id)).filter((object): object is StudioFabricObject => Boolean(object));
    const activeIds = canvas.getActiveObjects().map((object) => (object as StudioFabricObject).esId);
    if (selectedObjects.length === activeIds.length && selectedObjects.every((object, index) => object.esId === activeIds[index])) return;
    restoringSelection.current = true;
    try {
      if (!selectedObjects.length) canvas.discardActiveObject();
      else if (selectedObjects.length === 1) canvas.setActiveObject(selectedObjects[0]);
      else if (activeSelectionRef.current) canvas.setActiveObject(new activeSelectionRef.current(selectedObjects, { canvas }));
      canvas.requestRenderAll();
    } finally {
      restoringSelection.current = false;
    }
  }, []);

  useEffect(() => {
    if (!canvasElement) return;
    let cancelled = false;
    let canvas: Canvas | null = null;
    void import("fabric").then(({ Canvas: FabricCanvas, ActiveSelection }) => {
      if (cancelled) return;
      activeSelectionRef.current = ActiveSelection;
      canvas = new FabricCanvas(canvasElement, { preserveObjectStacking: true, selection: true, renderOnAddRemove: false });
      canvasRef.current = canvas;
      canvas.on("selection:created", (event) => { if (!rendering.current && !restoringSelection.current) useStudio.getState().selectElements(event.selected?.map((object) => (object as StudioFabricObject).esId).filter((id): id is string => Boolean(id)) ?? []); });
      canvas.on("selection:updated", (event) => { if (!rendering.current && !restoringSelection.current) useStudio.getState().selectElements(event.selected?.map((object) => (object as StudioFabricObject).esId).filter((id): id is string => Boolean(id)) ?? []); });
      canvas.on("selection:cleared", () => { if (!rendering.current && !restoringSelection.current) useStudio.getState().selectElements([]); });
      canvas.on("object:moving", (event) => {
        const object = event.target as StudioFabricObject | undefined;
        if (!object?.esId) return;
        const state = useStudio.getState();
        const current = state.deck?.pages.find((entry) => entry.id === state.activePageId);
        const source = current?.elements.find((element) => element.id === object.esId);
        if (!state.deck || !current || !source) return;
        const moving = fabricObjectToScene(object, source, state.deck);
        const snapped = snapElementPosition(moving, current.elements, { threshold: 0.008 });
        object.set({ left: snapped.x * state.deck.width, top: snapped.y * state.deck.height });
        setGuides(snapped.guides);
        canvas?.requestRenderAll();
      });
      canvas.on("object:modified", (event) => {
        setGuides([]);
        const object = event.target as StudioFabricObject | undefined;
        if (!object?.esId) return;
        const state = useStudio.getState();
        const source = state.deck?.pages.find((entry) => entry.id === state.activePageId)?.elements.find((element) => element.id === object.esId);
        if (state.deck && source) state.updateElement(source.id, fabricObjectToScene(object, source, state.deck));
      });
      canvas.on("text:editing:exited", (event) => {
        const object = event.target as StudioFabricObject & { text?: string };
        if (!object.esId) return;
        const state = useStudio.getState();
        const source = state.deck?.pages.find((entry) => entry.id === state.activePageId)?.elements.find((element) => element.id === object.esId);
        if (state.deck && source?.kind === "text") state.updateElement(source.id, { ...fabricObjectToScene(object, source, state.deck), text: object.text ?? "" } as typeof source);
      });
      setCanvasReady(true);
    });
    return () => { cancelled = true; setCanvasReady(false); canvasRef.current = null; activeSelectionRef.current = null; if (canvas) void canvas.dispose(); };
  }, [canvasElement]);

  useEffect(() => {
    if (!canvasReady || !canvasRef.current || !deck || !page) return;
    const canvas = canvasRef.current;
    canvas.setDimensions({ width: deck.width, height: deck.height });
    rendering.current += 1;
    void syncFabricPage(canvas, page, deck).catch((cause) => setError(cause instanceof Error ? cause.message : "Canvas could not render.")).finally(() => {
      rendering.current -= 1;
      if (rendering.current === 0 && canvasRef.current === canvas) syncSelection(canvas);
    });
  }, [canvasReady, deck, page, syncSelection]);

  useEffect(() => {
    if (canvasReady && canvasRef.current && !rendering.current) syncSelection(canvasRef.current);
  }, [canvasReady, selectionIds, syncSelection]);

  useEffect(() => {
    const target = stageRef.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const state = useStudio.getState();
    if (!state.deck) return;
    const targetDeckId = state.deck.id;
    const targetPageId = state.activePageId;
    const targetSelectionId = state.selectionIds[0];
    setError("");
    try {
      const uploaded = await uploadStudioImage(file);
      const current = useStudio.getState();
      if (!current.deck || current.deck.id !== targetDeckId || !targetPageId) return;
      const source = current.deck.pages.find((entry) => entry.id === targetPageId)?.elements.find((element) => element.id === targetSelectionId);
      if (source?.kind === "image") current.updateElement(source.id, { src: uploaded.url, placeholder: false }, targetPageId);
      else current.addElement({ id: crypto.randomUUID(), kind: "image", role: "media", src: uploaded.url, fit: "cover", x: 0.2, y: 0.2, w: 0.6, h: Math.min(0.6, 0.6 * uploaded.height / uploaded.width * current.deck.width / current.deck.height) }, targetPageId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed.");
    }
  }, []);

  const handleStageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData(STUDIO_ELEMENT_DRAG_MIME);
    if (raw) {
      const bounds = pageSurfaceRef.current?.getBoundingClientRect();
      if (!bounds || !bounds.width || !bounds.height) return;
      const placed = placeDraggedElements(raw, {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
      });
      if (!placed.length) { setError("This item could not be added."); return; }
      const state = useStudio.getState();
      if (!state.activePageId) return;
      const groupIds = new Map<string, string>();
      const inserted = placed.map((element) => {
        let group: string | undefined;
        if (element.group) {
          group = groupIds.get(element.group);
          if (!group) {
            group = crypto.randomUUID();
            groupIds.set(element.group, group);
          }
        }
        return { ...element, id: crypto.randomUUID(), group };
      });
      state.addElements(inserted, state.activePageId);
      setError("");
      return;
    }
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) void handleUpload(file);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) spaceDown.current = true;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable=true],[role=textbox]")) return;
      const state = useStudio.getState();
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "k") return;
      if (command && event.key.toLowerCase() === "s") { event.preventDefault(); void onSave(); }
      else if (command && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) state.redo(); else state.undo(); }
      else if (command && event.key.toLowerCase() === "c") { event.preventDefault(); state.copySelection(); }
      else if (command && event.key.toLowerCase() === "v") { event.preventDefault(); state.pasteClipboard(); }
      else if (command && event.key.toLowerCase() === "d") { event.preventDefault(); state.duplicateElements(); }
      else if (command && event.key.toLowerCase() === "g") { event.preventDefault(); if (event.shiftKey) state.ungroupElements(); else state.groupElements(); }
      else if (command && event.key.toLowerCase() === "a") { event.preventDefault(); state.selectElements(state.deck?.pages.find((entry) => entry.id === state.activePageId)?.elements.map((element) => element.id) ?? []); }
      else if (command && ["+", "="].includes(event.key)) { event.preventDefault(); state.setZoom(state.zoom + 0.1); }
      else if (command && event.key === "-") { event.preventDefault(); state.setZoom(state.zoom - 0.1); }
      else if (command && event.key === "0") { event.preventDefault(); state.setZoom(1); state.setPan({ x: 0, y: 0 }); }
      else if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); state.removeElements(); }
      else if (event.key === "Escape") { state.selectElements([]); state.setPanel(null); }
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && state.selectionIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const current = state.deck?.pages.find((entry) => entry.id === state.activePageId);
        for (const element of current?.elements.filter((candidate) => state.selectionIds.includes(candidate.id)) ?? []) {
          state.updateElement(element.id, { x: element.x + (event.key === "ArrowRight" ? step / state.deck!.width : event.key === "ArrowLeft" ? -step / state.deck!.width : 0), y: element.y + (event.key === "ArrowDown" ? step / state.deck!.height : event.key === "ArrowUp" ? -step / state.deck!.height : 0) }, undefined, `nudge-${element.id}`);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") spaceDown.current = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [onSave]);

  if (!deck || !page) return null;
  const ActivePanel = panels.find((panel) => panel.id === activePanel)?.component;
  const resolvedColor = selected && "color" in selected && typeof selected.color === "string" && palette ? resolvePaint(selected.color, palette, palette.text) : palette?.accent;

  return (
    <div data-hotkeys="studio" className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <button type="button" onClick={onBack} aria-label="Back to Studio" className="icon-btn"><ArrowLeft size={18} /></button>
        <input aria-label="Design title" value={deck.title} maxLength={160} onChange={(event) => useStudio.getState().renameDeck(event.target.value)} onBlur={() => { if (!useStudio.getState().deck?.title.trim()) useStudio.getState().renameDeck("Untitled design"); }} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none sm:max-w-56" />
        <span className="hidden text-xs text-fg-muted sm:inline">{savingState === "saving" ? "Saving…" : savingState === "offline" ? "Offline" : savingState === "error" ? "Save failed" : "Saved"}</span>
        <button type="button" aria-label="Undo" disabled={!history.past.length} onClick={() => useStudio.getState().undo()} className="icon-btn"><Undo2 size={17} /></button>
        <button type="button" aria-label="Redo" disabled={!history.future.length} onClick={() => useStudio.getState().redo()} className="icon-btn"><Redo2 size={17} /></button>
        <button type="button" onClick={() => setZoom(zoom >= 2 ? 0.5 : Math.round((zoom + 0.25) * 100) / 100)} className="hidden rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 sm:inline">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => void onSave()} className="icon-btn" aria-label="Save"><Save size={17} /></button>
        <button type="button" onClick={() => setPresenting(true)} className="btn btn-secondary btn-sm hidden sm:inline-flex">Present</button>
        <ExportMenu />
      </header>

      <div className="relative flex min-h-0 flex-1">
        <nav aria-label="Studio tools" className="flex w-14 shrink-0 flex-col gap-1 border-r border-line bg-surface p-1.5">
          {panels.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} aria-pressed={activePanel === id} title={label} onClick={() => setPanel(activePanel === id ? null : id as StudioPanel)} className="flex h-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 aria-pressed:bg-accent-soft aria-pressed:text-accent"><Icon size={18} /></button>)}
        </nav>
        {ActivePanel && <aside className="absolute inset-y-0 left-14 z-20 w-[min(20rem,calc(100vw-3.5rem))] overflow-y-auto border-r border-line bg-surface shadow-lg sm:static sm:w-72 sm:shrink-0 sm:shadow-none lg:w-80"><div className="flex h-11 items-center justify-between border-b border-line px-4 text-sm font-semibold">{panels.find((panel) => panel.id === activePanel)?.label}<button type="button" onClick={() => setPanel(null)} aria-label="Close panel" className="icon-btn"><X size={16} /></button></div><ActivePanel /></aside>}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-11 items-center gap-2 overflow-x-auto border-b border-line bg-surface px-3 text-xs">
            {selected ? <>
              <span className="rounded bg-surface-2 px-2 py-1 capitalize">{selected.kind}</span>
              {selected.kind === "text" && <><input aria-label="Text content" value={selected.text} onChange={(event) => useStudio.getState().updateElement(selected.id, { text: event.target.value })} className="w-36 rounded border border-line bg-bg px-2 py-1 text-xs outline-none sm:w-48" /><label className="flex items-center gap-1">Size <input type="number" min="8" max="240" value={selected.fontSize ?? 24} onChange={(event) => useStudio.getState().updateElement(selected.id, { fontSize: Number(event.target.value) })} className="w-14 rounded border border-line bg-bg px-1 py-1" /></label></>}
              {(selected.kind === "text" || selected.kind === "shape") && palette && <div className="flex items-center gap-1" aria-label="Theme colors">{(["text", "accent", "accent2", "muted"] as const).map((token) => <button key={token} type="button" aria-label={`Use ${token} color`} title={token} onClick={() => useStudio.getState().updateElement(selected.id, selected.kind === "shape" ? { fill: token } : { color: token })} className="h-5 w-5 rounded-full border border-line" style={{ background: palette[token] }} />)}</div>}
              {selected.kind === "image" && <button type="button" onClick={() => uploadRef.current?.click()} className="btn btn-ghost btn-sm">Replace image</button>}
              <button type="button" onClick={() => useStudio.getState().duplicateElements()} aria-label="Duplicate" className="icon-btn"><Copy size={16} /></button>
              <button type="button" onClick={() => useStudio.getState().lockElements(!selected.locked)} aria-label={selected.locked ? "Unlock" : "Lock"} className="icon-btn"><Lock size={16} /></button>
              <button type="button" onClick={() => useStudio.getState().reorderElements("front")} aria-label="Bring to front" className="icon-btn"><Layers size={16} /></button>
              <button type="button" onClick={() => useStudio.getState().removeElements()} aria-label="Delete" className="icon-btn text-danger"><X size={16} /></button>
            </> : <><span className="shrink-0 text-fg-muted">{page.name || `Page ${deck.pages.indexOf(page) + 1}`}</span><button type="button" onClick={() => useStudio.getState().addElement({ id: crypto.randomUUID(), kind: "text", role: "title", style: "title", text: "Your heading", color: "text", x: 0.15, y: 0.2, w: 0.7, h: 0.16 })} className="btn btn-ghost btn-sm inline-flex shrink-0 items-center gap-1"><Type size={15} /> Text</button><button type="button" onClick={() => useStudio.getState().addElement({ id: crypto.randomUUID(), kind: "shape", role: "shape", shape: "rounded", fill: "accent", x: 0.35, y: 0.35, w: 0.3, h: 0.3 })} className="btn btn-ghost btn-sm shrink-0">Shape</button><button type="button" onClick={() => uploadRef.current?.click()} className="btn btn-ghost btn-sm inline-flex shrink-0 items-center gap-1"><ImagePlus size={15} /> Image</button><button type="button" onClick={() => useStudio.getState().relayoutCurrentPage()} className="btn btn-ghost btn-sm shrink-0">Layout</button></>}
            {resolvedColor && <span className="sr-only">Selected color {resolvedColor}</span>}
          </div>
          <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-surface-2" onWheel={(event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)); } }} onPointerDown={(event) => { if (spaceDown.current || event.button === 1) { dragPoint.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMove={(event) => { if (dragPoint.current) { setPan({ x: pan.x + event.clientX - dragPoint.current.x, y: pan.y + event.clientY - dragPoint.current.y }); dragPoint.current = { x: event.clientX, y: event.clientY }; } }} onPointerUp={() => { dragPoint.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={handleStageDrop}>
            <div ref={pageSurfaceRef} className="absolute left-1/2 top-1/2 shadow-lg" style={{ width: deck.width, height: deck.height, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`, transformOrigin: "center" }}><canvas ref={setCanvasElement} /><svg className="pointer-events-none absolute inset-0" width={deck.width} height={deck.height} aria-hidden="true">{guides.map((guide, index) => guide.kind === "alignment" ? guide.axis === "x" ? <line key={index} x1={guide.at * deck.width} x2={guide.at * deck.width} y1={0} y2={deck.height} stroke={palette?.accent} strokeWidth={1 / scale} /> : <line key={index} y1={guide.at * deck.height} y2={guide.at * deck.height} x1={0} x2={deck.width} stroke={palette?.accent} strokeWidth={1 / scale} /> : null)}</svg></div>
            {error && <div role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-danger bg-surface px-3 py-2 text-sm text-danger">{error}</div>}
          </div>
          <div className={`flex shrink-0 gap-2 overflow-auto border-t border-line bg-surface px-3 py-2 ${gridView ? "h-64 flex-wrap content-start" : "h-28 items-center"}`}>
            <DndContext sensors={pageSensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              const targetIndex = deck.pages.findIndex((candidate) => candidate.id === over.id);
              if (targetIndex >= 0) useStudio.getState().movePage(String(active.id), targetIndex);
            }}>
              <SortableContext items={deck.pages.map((entry) => entry.id)} strategy={rectSortingStrategy}>
                {deck.pages.map((entry, index) => <SortablePageCard key={entry.id} entry={entry} index={index} deck={deck} activePageId={activePageId} editingPageId={editingPageId} setEditingPageId={setEditingPageId} setNotesOpen={setNotesOpen} />)}
              </SortableContext>
            </DndContext>
            <button type="button" onClick={() => useStudio.getState().addPage()} aria-label="Add page" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-fg-muted"><Plus size={20} /></button>
            <div className="ml-auto flex shrink-0 items-center gap-1"><button type="button" onClick={() => setGridView(!gridView)} aria-label={gridView ? "Show page strip" : "Show page grid"} aria-pressed={gridView} className="icon-btn"><Grid2X2 size={16} /></button><button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen} className="btn btn-ghost btn-sm">Notes <ChevronDown size={15} /></button></div>
          </div>
          {notesOpen && <div className="border-t border-line bg-surface p-3"><textarea aria-label="Speaker notes" value={page.notes ?? ""} onChange={(event) => useStudio.getState().setPageNotes(page.id, event.target.value)} className="min-h-20 w-full rounded-md border border-line bg-bg p-2 text-sm outline-none" placeholder="Speaker notes" /></div>}
        </div>
      </div>
      <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ""; }} />
      {presenting && <PresentMode startPageId={activePageId ?? undefined} onExit={() => setPresenting(false)} />}
    </div>
  );
}
