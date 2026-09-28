"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, Copy, FileText, Grid2X2, LayoutTemplate, List, Maximize2, MoreHorizontal, Pencil, Presentation, RefreshCw, SearchX, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Dialog, EmptyState, IconButton, Menu, SearchInput, Segmented, Skeleton, useConfirm } from "@/components/ui";
import { archiveStudioItem, hardDeleteStudioItem, listStudioItems, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import { readStudioDocument } from "@/lib/studio/document";
import { getFormat, TEMPLATE_CATEGORIES, TEMPLATES, type TemplateCategory, type TemplateDef } from "@/lib/studio/library";
import type { CreateDesignInput } from "../store";
import { studioId } from "../store";
import { LazyTemplateThumbnail, SceneThumbnail, templateDeck } from "./Preview";
import { duplicateInput, filterStudioItems, itemGroup, recentLabel, renameInput, type HubFilter } from "./model";

type HubProps = { onOpen(documentId: string): void; onCreate(input: CreateDesignInput): void };
type StartFormat = { label: string; formatId: string; icon: typeof Presentation; title?: string };

const START_FORMATS: StartFormat[] = [
  { label: "Presentation", formatId: "slides-16x9", icon: Presentation },
  { label: "Document", formatId: "doc-a4", icon: FileText },
  { label: "Worksheet", formatId: "doc-letter", icon: FileText, title: "Worksheet" },
  { label: "Social post", formatId: "ig-square", icon: Grid2X2 },
  { label: "Story", formatId: "ig-story", icon: Maximize2 },
  { label: "Poster", formatId: "poster", icon: LayoutTemplate },
  { label: "Whiteboard", formatId: "whiteboard", icon: Grid2X2 },
];

const FILTERS: { value: HubFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "slides", label: "Slides" }, { value: "docs", label: "Docs" },
  { value: "social", label: "Social" }, { value: "print", label: "Print" },
];

function miniFrame(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(86 / width, 58 / height);
  return { width: Math.max(12, width * scale), height: Math.max(12, height * scale) };
}

function StartCard({ format, onCreate }: { format: StartFormat; onCreate: HubProps["onCreate"] }) {
  const detail = getFormat(format.formatId);
  const Icon = format.icon;
  return <button type="button" onClick={() => onCreate({ formatId: format.formatId, title: format.title })} className="group flex w-32 shrink-0 flex-col gap-2 rounded-lg border border-line bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-36">
    <span className="flex h-24 items-center justify-center rounded-md bg-surface-2"><span className="flex items-center justify-center rounded-sm border border-line-strong bg-elevated shadow-sm transition group-hover:border-accent" style={miniFrame(detail.width, detail.height)}><Icon size={17} strokeWidth={1.5} className="text-fg-muted" /></span></span>
    <span className="truncate px-0.5 text-[13px] font-medium text-fg">{format.label}</span>
  </button>;
}

export default function StudioHub({ onOpen, onCreate }: HubProps) {
  const confirm = useConfirm();
  const [items, setItems] = useState<StudioServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HubFilter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<TemplateCategory | "All">("All");
  const [preview, setPreview] = useState<TemplateDef | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFormat, setCustomFormat] = useState("slides-16x9");
  const [customWidth, setCustomWidth] = useState("1280");
  const [customHeight, setCustomHeight] = useState("720");
  const [customError, setCustomError] = useState("");
  const [renameItem, setRenameItem] = useState<StudioServerItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const found = await listStudioItems();
      setItems(found.filter((item) => item.content.app === "EdSync Studio"));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Designs could not be loaded.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleItems = useMemo(() => filterStudioItems(items, filter, query), [items, filter, query]);
  const visibleTemplates = useMemo(() => TEMPLATES.filter((template) => (category === "All" || template.category === category) && (!query.trim() || `${template.name} ${template.description} ${template.tags.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [category, query]);
  const previewDeck = preview ? templateDeck(preview) : null;

  const startCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const width = Number(customWidth);
    const height = Number(customHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 320 || width > 5000 || height > 5000) {
      setCustomError("Use 320–5000 px for each side.");
      return;
    }
    setCustomOpen(false);
    setCustomError("");
    onCreate({ formatId: customFormat, width, height });
  };

  const perform = async (id: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    try { await action(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Action failed. Please retry."); }
    finally { setBusyId(null); }
  };

  const duplicate = (item: StudioServerItem) => void perform(item.id, async () => {
    const created = await saveStudioItem(duplicateInput(item, studioId("deck")));
    setItems((current) => [created, ...current]);
  });

  const archive = (item: StudioServerItem) => void perform(item.id, async () => {
    await archiveStudioItem(item.id);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  });

  const deleteForever = (item: StudioServerItem) => void perform(item.id, async () => {
    if (!await confirm({ title: `Delete “${item.title}”?`, body: "This design will be removed permanently.", confirmLabel: "Delete permanently", danger: true })) return;
    await hardDeleteStudioItem(item.id);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  });

  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameItem || busyId) return;
    const title = renameTitle.trim();
    if (!title) { setRenameError("Enter a design name."); return; }
    setBusyId(renameItem.id);
    setRenameError("");
    try {
      const updated = await updateStudioItem(renameInput(renameItem, title));
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setRenameItem(null);
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : "Rename failed.");
    } finally { setBusyId(null); }
  };

  const openRename = (item: StudioServerItem) => { setRenameItem(item); setRenameTitle(item.title); setRenameError(""); };
  const itemActions = (item: StudioServerItem) => [
    { label: "Open", icon: Presentation, onSelect: () => onOpen(item.id) },
    { label: "Rename", icon: Pencil, onSelect: () => openRename(item) },
    { label: "Duplicate", icon: Copy, onSelect: () => duplicate(item) },
    { label: "Archive", icon: Archive, onSelect: () => archive(item) },
    { separator: true as const },
    { label: "Delete permanently", icon: Trash2, danger: true, onSelect: () => deleteForever(item) },
  ];

  return <main className="page max-w-7xl space-y-7 py-5 sm:py-7">
    <div className="flex flex-wrap items-center gap-3"><h1 className="mr-auto text-[22px] font-semibold tracking-tight text-fg sm:text-2xl">Studio</h1><SearchInput value={query} onChange={setQuery} placeholder="Search designs" label="Search designs" className="order-3 w-full sm:order-none sm:w-auto" /></div>

    <section aria-labelledby="studio-start" className="space-y-3">
      <h2 id="studio-start" className="text-base font-semibold text-fg">Start</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {START_FORMATS.map((format) => <StartCard key={format.label} format={format} onCreate={onCreate} />)}
        <button type="button" onClick={() => setCustomOpen(true)} className="group flex w-32 shrink-0 flex-col gap-2 rounded-lg border border-line bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-36"><span className="flex h-24 items-center justify-center rounded-md bg-surface-2"><span className="flex h-14 w-20 items-center justify-center rounded-sm border border-dashed border-line-strong text-fg-muted"><Maximize2 size={18} strokeWidth={1.5} /></span></span><span className="px-0.5 text-[13px] font-medium">Custom size</span></button>
        <button type="button" onClick={() => onCreate({ formatId: "slides-16x9", magic: true })} className="group flex w-32 shrink-0 flex-col gap-2 rounded-lg border border-accent/25 bg-accent-soft p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-36"><span className="flex h-24 items-center justify-center rounded-md bg-surface/75 text-accent"><Sparkles size={25} strokeWidth={1.5} /></span><span className="px-0.5 text-[13px] font-medium text-accent">Magic design</span></button>
      </div>
    </section>

    <section aria-labelledby="studio-templates" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3"><h2 id="studio-templates" className="text-base font-semibold text-fg">Templates</h2><span className="text-xs text-fg-muted">{visibleTemplates.length}</span></div>
      <div aria-label="Template categories" className="flex gap-1.5 overflow-x-auto pb-1">{(["All", ...TEMPLATE_CATEGORIES] as const).map((entry) => <button key={entry} type="button" aria-pressed={category === entry} onClick={() => setCategory(entry)} className="chip shrink-0" data-active={category === entry}>{entry}</button>)}</div>
      {visibleTemplates.length ? <div className="flex gap-3 overflow-x-auto pb-2">{visibleTemplates.map((template) => <button key={template.id} type="button" onClick={() => setPreview(template)} className="w-56 shrink-0 rounded-lg border border-line bg-surface p-2 text-left transition hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><LazyTemplateThumbnail template={template} /><span className="mt-2 block truncate text-[13px] font-medium text-fg">{template.name}</span><span className="block truncate text-xs text-fg-muted">{template.pages.length} pages · {template.category}</span></button>)}</div>
        : <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-fg-muted">No templates match.</p>}
    </section>

    <section aria-labelledby="studio-recent" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><h2 id="studio-recent" className="mr-auto text-base font-semibold text-fg">Recent designs</h2><IconButton icon={RefreshCw} label="Refresh designs" onClick={() => void load()} /><IconButton icon={Grid2X2} label="Grid view" active={view === "grid"} onClick={() => setView("grid")} /><IconButton icon={List} label="List view" active={view === "list"} onClick={() => setView("list")} /></div>
      <div className="overflow-x-auto pb-1"><Segmented value={filter} onChange={setFilter} options={FILTERS} ariaLabel="Filter designs" size="sm" /></div>
      {actionError && <div role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">{actionError}</div>}
      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading designs">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-48 rounded-lg" />)}</div>
        : loadError ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"><span>{loadError}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>
          : visibleItems.length ? <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>{visibleItems.map((item) => {
            const loaded = item.content.version === 2 ? readStudioDocument(item.content) : null;
            const kind = itemGroup(item);
            return <article key={item.id} className={`group relative overflow-hidden rounded-lg border border-line bg-surface transition hover:border-line-strong hover:shadow-sm ${view === "list" ? "flex items-center" : ""}`}>
              <button type="button" onClick={() => onOpen(item.id)} className={`min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${view === "list" ? "flex items-center gap-3 p-2 pr-12" : "block w-full p-2 pb-3"}`}>
                <span className={`block overflow-hidden rounded-md bg-surface-2 ${view === "list" ? "h-14 w-20 shrink-0" : "mb-2 h-36"}`}>{loaded?.deck.pages[0] ? <SceneThumbnail deck={loaded.deck} page={loaded.deck.pages[0]} /> : <span className="flex h-full items-center justify-center text-fg-faint"><FileText size={22} strokeWidth={1.4} /></span>}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-fg">{item.title}</span><span className="mt-1 flex items-center gap-2 text-xs text-fg-muted"><Badge tone="neutral">{kind === "docs" ? "Doc" : kind === "slides" ? "Slides" : kind === "social" ? "Social" : "Print"}</Badge><span>{recentLabel(item.updatedAt)}</span></span></span>
              </button>
              <div className="absolute right-2 top-2"><Menu label={`Actions for ${item.title}`} trigger={<button type="button" aria-label={`Actions for ${item.title}`} disabled={busyId === item.id} className="icon-btn bg-elevated/90 shadow-sm"><MoreHorizontal size={16} /></button>} items={itemActions(item)} /></div>
            </article>;
          })}</div>
            : <EmptyState icon={query ? SearchX : LayoutTemplate} title={query ? "No matching designs" : "No designs yet"} action={!query ? <Button size="sm" onClick={() => onCreate({ formatId: "slides-16x9" })}>Create a design</Button> : undefined} compact />}
    </section>

    <Dialog open={customOpen} onClose={() => setCustomOpen(false)} onSubmit={startCustom} title="Custom size" size="sm" footer={<><Button type="button" onClick={() => setCustomOpen(false)}>Cancel</Button><Button type="submit" variant="primary">Create</Button></>}>
      <div className="space-y-3"><label className="block text-sm text-fg">Type<select value={customFormat} onChange={(event) => setCustomFormat(event.target.value)} className="select mt-1 w-full"><option value="slides-16x9">Presentation</option><option value="doc-a4">Document</option><option value="ig-square">Social</option><option value="poster">Print</option><option value="whiteboard">Whiteboard</option></select></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm text-fg">Width <span className="text-fg-muted">px</span><input type="number" min="320" max="5000" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} className="input mt-1 w-full" /></label><label className="block text-sm text-fg">Height <span className="text-fg-muted">px</span><input type="number" min="320" max="5000" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} className="input mt-1 w-full" /></label></div>{customError && <p role="alert" className="text-xs text-danger">{customError}</p>}</div>
    </Dialog>

    <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name ?? "Template"} description={preview?.description} size="lg" footer={<><Button onClick={() => setPreview(null)}>Close</Button><Button variant="primary" onClick={() => { if (preview) onCreate({ formatId: preview.formatId, templateId: preview.id }); setPreview(null); }}>Use template</Button></>}>
      {previewDeck && <div className="grid gap-3 sm:grid-cols-2">{previewDeck.pages.map((page, index) => <div key={page.id} className="space-y-1"><SceneThumbnail deck={previewDeck} page={page} className="rounded-md border border-line" /><p className="text-xs text-fg-muted">{index + 1}. {page.name ?? page.content?.title ?? "Page"}</p></div>)}</div>}
    </Dialog>

    <Dialog open={Boolean(renameItem)} onClose={() => setRenameItem(null)} onSubmit={(event) => void rename(event)} title="Rename design" size="sm" footer={<><Button type="button" onClick={() => setRenameItem(null)}>Cancel</Button><Button type="submit" variant="primary" loading={Boolean(busyId)}>Save</Button></>}><label className="block text-sm text-fg">Name<input value={renameTitle} maxLength={160} onChange={(event) => setRenameTitle(event.target.value)} className="input mt-1 w-full" data-autofocus /></label>{renameError && <p role="alert" className="mt-2 text-xs text-danger">{renameError}</p>}</Dialog>
  </main>;
}
