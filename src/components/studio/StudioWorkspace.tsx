"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  Columns3,
  Copy,
  Download,
  FileText,
  FileUp,
  Grid3X3,
  History,
  ImageIcon,
  Layers3,
  MonitorPlay,
  PanelRight,
  PenLine,
  Plus,
  Presentation,
  RotateCcw,
  Save,
  Shapes,
  Sparkles,
  SplitSquareHorizontal,
  Table2,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  AI_PROMPT_CONTRACTS,
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  PRACTICE_MODES,
  SLIDE_THEMES,
  STUDIO_TABS,
} from "@/lib/studio/catalog";
import {
  archiveStudioItem,
  hardDeleteStudioItem,
  listStudioItems,
  saveStudioItem,
  updateStudioItem,
  type StudioServerItem,
} from "@/lib/studio/api";
import {
  createDebouncedDraftWriter,
  clearStudioDraft,
  readStudioDraft,
  writeStudioDraft,
} from "@/lib/studio/drafts";
import {
  addSheetColumn,
  addSheetRow,
  createSlide,
  csvToSheet,
  deleteSheetColumn,
  deleteSheetRow,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  sheetToCsv,
  updateSheetCell as updateSheetCellValue,
} from "@/lib/studio/workspace-actions";
import type { StudioItemKind } from "@/types";

const RichTextStudioEditor = dynamic(() => import("@/components/studio/RichTextStudioEditor"), {
  ssr: false,
  loading: () => <div className="h-[460px] animate-pulse rounded-lg bg-edsync-surface" />,
});

type StudioWorkspaceProps = {
  initialKind?: StudioItemKind;
};

type StudioDraftValue = {
  html: string;
  plainText: string;
  sheet: string[][];
  slides: Array<{ id: string; title: string; notes: string; accent: string }>;
};

const defaultDraft: StudioDraftValue = {
  html: "<h2>New Studio item</h2><p>Start writing, paste content, or use AI to create a draft.</p>",
  plainText: "New Studio item",
  sheet: [
    ["Criteria", "Developing", "Proficient", "Advanced"],
    ["Evidence", "Needs support", "Clear examples", "Detailed reasoning"],
    ["Accuracy", "Some errors", "Mostly accurate", "Precise and complete"],
  ],
  slides: [
    { id: "slide-1", title: "Lesson Title", notes: "Open with the learning goal.", accent: "#2563eb" },
    { id: "slide-2", title: "Key Idea", notes: "Explain the concept with one example.", accent: "#10b981" },
    { id: "slide-3", title: "Practice", notes: "Ask students to try, compare, and revise.", accent: "#f59e0b" },
  ],
};

const kindIcons: Record<string, typeof FileText> = {
  lesson: BookOpenCheck,
  note: PenLine,
  doc: FileText,
  sheet: Table2,
  slide: Presentation,
  practice: Timer,
  import: Download,
  design: Shapes,
};

function titleForKind(kind: StudioItemKind) {
  if (kind === "doc") return "Documents";
  if (kind === "note") return "Notes";
  if (kind === "sheet") return "Sheets";
  if (kind === "slide") return "Slides";
  if (kind === "practice") return "Practice Builder";
  return "Studio";
}

function downloadTextFile(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function extensionForKind(kind: StudioItemKind) {
  if (kind === "sheet") return "csv";
  if (kind === "slide") return "json";
  if (kind === "doc" || kind === "note" || kind === "lesson") return "html";
  return "json";
}

function draftToServerContent(draft: StudioDraftValue) {
  return {
    html: draft.html,
    plainText: draft.plainText,
    sheet: draft.sheet,
    slides: draft.slides,
  };
}

function serverItemToDraft(item: StudioServerItem): StudioDraftValue {
  return {
    html: typeof item.content.html === "string" ? item.content.html : defaultDraft.html,
    plainText: item.plainText || (typeof item.content.plainText === "string" ? item.content.plainText : defaultDraft.plainText),
    sheet: Array.isArray(item.content.sheet) ? (item.content.sheet as string[][]) : defaultDraft.sheet,
    slides: Array.isArray(item.content.slides)
      ? (item.content.slides as StudioDraftValue["slides"])
      : defaultDraft.slides,
  };
}

export default function StudioWorkspace({ initialKind = "lesson" }: StudioWorkspaceProps) {
  const [activeKind, setActiveKind] = useState<StudioItemKind>(initialKind);
  const [itemTitle, setItemTitle] = useState(titleForKind(initialKind));
  const [serverItems, setServerItems] = useState<StudioServerItem[]>([]);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [draft, setDraft] = useState<StudioDraftValue>(defaultDraft);
  const [draftStatus, setDraftStatus] = useState<"saved" | "local_draft" | "saving">("saved");
  const [selectedSlideId, setSelectedSlideId] = useState("slide-1");
  const [advancedSheetLoaded, setAdvancedSheetLoaded] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const activeKindRef = useRef<StudioItemKind>(initialKind);
  const itemTitleRef = useRef(titleForKind(initialKind));
  const writerRef = useRef(createDebouncedDraftWriter<StudioDraftValue>((value) => {
    const currentKind = activeKindRef.current;
    writeStudioDraft({
      kind: currentKind,
      itemId: "workspace",
      title: itemTitleRef.current,
      value,
      status: "local_draft",
    });
    setDraftStatus("local_draft");
  }));

  useEffect(() => {
    setActiveKind(initialKind);
    activeKindRef.current = initialKind;
    itemTitleRef.current = titleForKind(initialKind);
    setItemTitle(titleForKind(initialKind));
    setCurrentServerId(null);
    const stored = readStudioDraft<StudioDraftValue>(initialKind, "workspace");
    setDraft(stored?.value ?? defaultDraft);
    setDraftStatus(stored ? "local_draft" : "saved");
  }, [initialKind]);

  const selectKind = (kind: StudioItemKind) => {
    writerRef.current.flush(draft);
    activeKindRef.current = kind;
    setActiveKind(kind);
    itemTitleRef.current = titleForKind(kind);
    setItemTitle(titleForKind(kind));
    setCurrentServerId(null);
    const stored = readStudioDraft<StudioDraftValue>(kind, "workspace");
    setDraft(stored?.value ?? defaultDraft);
    setDraftStatus(stored ? "local_draft" : "saved");
    setStatusMessage(stored ? "Restored local draft" : "Ready");
  };

  useEffect(() => {
    let cancelled = false;

    listStudioItems(activeKind, includeArchived)
      .then((items) => {
        if (!cancelled) setServerItems(items);
      })
      .catch((error) => {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : "Could not load Studio items");
      });

    return () => {
      cancelled = true;
    };
  }, [activeKind, includeArchived]);

  useEffect(() => {
    const draftWriter = writerRef.current;
    const flush = () => {
      draftWriter.flush(draft);
      setStatusMessage("Draft saved locally");
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      draftWriter.flush(draft);
    };
  }, [draft]);

  const activeSlide = useMemo(
    () => draft.slides.find((slide) => slide.id === selectedSlideId) ?? draft.slides[0],
    [draft.slides, selectedSlideId],
  );
  const activeSlideIndex = useMemo(
    () => Math.max(draft.slides.findIndex((slide) => slide.id === selectedSlideId), 0),
    [draft.slides, selectedSlideId],
  );
  const sheetColumnCount = useMemo(
    () => Math.max(...draft.sheet.map((row) => row.length), 1),
    [draft.sheet],
  );

  const updateDraft = (next: StudioDraftValue) => {
    setDraft(next);
    setDraftStatus("saving");
    setStatusMessage("Saving local draft...");
    writerRef.current.schedule(next);
  };

  const loadUniverEngine = () => {
    setAdvancedSheetLoaded(true);
  };

  const addSlide = () => {
    const nextSlide = createSlide(draft.slides, SLIDE_THEMES[draft.slides.length % SLIDE_THEMES.length].colors.primary);
    updateDraft({ ...draft, slides: [...draft.slides, nextSlide] });
    setSelectedSlideId(nextSlide.id);
  };

  const updateSheetCell = (rowIndex: number, columnIndex: number, value: string) => {
    updateDraft({ ...draft, sheet: updateSheetCellValue(draft.sheet, rowIndex, columnIndex, value) });
  };

  const saveDraft = async () => {
    writerRef.current.cancel();
    writeStudioDraft({
      kind: activeKind,
      itemId: "workspace",
      title: itemTitle,
      value: draft,
      status: "saved",
    });
    setDraftStatus("saving");
    setStatusMessage("Saving to EdSync...");

    try {
      const item = await saveStudioItem({
        id: currentServerId ?? undefined,
        kind: activeKind,
        title: itemTitle,
        content: draftToServerContent(draft),
        plainText: draft.plainText,
        status: "draft",
        metadata: { slideCount: draft.slides.length, sheetRows: draft.sheet.length },
      });
      setCurrentServerId(item.id);
      setServerItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      setDraftStatus("saved");
      setStatusMessage("Saved to EdSync");
    } catch (error) {
      setDraftStatus("local_draft");
      setStatusMessage(error instanceof Error ? error.message : "Saved locally, server save failed");
    }
  };

  const resetDraft = () => {
    writerRef.current.cancel();
    clearStudioDraft(activeKind, "workspace");
    setDraft(defaultDraft);
    setSelectedSlideId(defaultDraft.slides[0].id);
    itemTitleRef.current = titleForKind(activeKind);
    setItemTitle(titleForKind(activeKind));
    setCurrentServerId(null);
    setDraftStatus("saved");
    setStatusMessage("Workspace reset");
  };

  const openServerItem = (item: StudioServerItem) => {
    const nextDraft = serverItemToDraft(item);
    activeKindRef.current = activeKind;
    itemTitleRef.current = item.title;
    setCurrentServerId(item.id);
    setItemTitle(item.title);
    setDraft(nextDraft);
    setSelectedSlideId(nextDraft.slides[0]?.id ?? defaultDraft.slides[0].id);
    setDraftStatus("saved");
    setStatusMessage("Loaded from EdSync");
  };

  const archiveCurrentItem = async () => {
    if (!currentServerId) {
      resetDraft();
      return;
    }

    setStatusMessage("Archiving item...");
    try {
      await archiveStudioItem(currentServerId);
      setServerItems((current) => current.filter((item) => item.id !== currentServerId));
      setCurrentServerId(null);
      resetDraft();
      setStatusMessage("Archived item");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not archive item");
    }
  };

  const publishCurrentItem = async () => {
    if (!currentServerId) {
      await saveDraft();
      setStatusMessage("Saved draft first. Click Publish again when ready.");
      return;
    }

    setStatusMessage("Publishing...");
    try {
      const item = await updateStudioItem({ id: currentServerId, status: "published" });
      setServerItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      setStatusMessage("Published");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not publish item");
    }
  };

  const restoreServerItem = async (item: StudioServerItem) => {
    setStatusMessage("Restoring...");
    try {
      const restored = await updateStudioItem({ id: item.id, status: "draft" });
      setServerItems((current) => [restored, ...current.filter((entry) => entry.id !== item.id)]);
      openServerItem(restored);
      setStatusMessage("Restored to drafts");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not restore item");
    }
  };

  const hardDeleteServerItem = async (item: StudioServerItem) => {
    setStatusMessage("Deleting permanently...");
    try {
      await hardDeleteStudioItem(item.id);
      setServerItems((current) => current.filter((entry) => entry.id !== item.id));
      if (currentServerId === item.id) resetDraft();
      setStatusMessage("Deleted permanently");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not delete item");
    }
  };

  const exportDraft = () => {
    const extension = extensionForKind(activeKind);
    const filename = `edsync-${activeKind}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    if (activeKind === "sheet") {
      downloadTextFile(filename, sheetToCsv(draft.sheet), "text/csv;charset=utf-8");
      return;
    }
    if (activeKind === "slide") {
      downloadTextFile(filename, JSON.stringify({ slides: draft.slides }, null, 2), "application/json");
      return;
    }
    downloadTextFile(filename, draft.html, "text/html;charset=utf-8");
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    updateDraft({ ...draft, sheet: csvToSheet(text) });
    activeKindRef.current = "sheet";
    setActiveKind("sheet");
    setStatusMessage(`Imported ${file.name}`);
  };

  const insertBlock = (label: string) => {
    const nextHtml = `${draft.html}<hr><h2>${label}</h2><p>Add details, examples, and checks for understanding.</p>`;
    updateDraft({ ...draft, html: nextHtml, plainText: `${draft.plainText}\n${label}` });
    activeKindRef.current = "lesson";
    setActiveKind("lesson");
  };

  const appendImagePrompt = () => {
    const url = window.prompt("Paste an HTTPS image URL");
    if (!url?.startsWith("https://")) {
      setStatusMessage("Only HTTPS image URLs are allowed");
      return;
    }
    updateDraft({
      ...draft,
      html: `${draft.html}<figure><img src="${url}" alt="Lesson visual"><figcaption>Image caption</figcaption></figure>`,
    });
    activeKindRef.current = "doc";
    setActiveKind("doc");
  };

  const duplicateSelectedSlide = () => {
    const nextSlides = duplicateSlide(draft.slides, selectedSlideId);
    updateDraft({ ...draft, slides: nextSlides });
    const selectedIndex = draft.slides.findIndex((slide) => slide.id === selectedSlideId);
    const duplicate = nextSlides[selectedIndex + 1];
    if (duplicate) setSelectedSlideId(duplicate.id);
  };

  const deleteSelectedSlide = () => {
    const nextSlides = deleteSlide(draft.slides, selectedSlideId);
    updateDraft({ ...draft, slides: nextSlides });
    setSelectedSlideId(nextSlides[0]?.id ?? defaultDraft.slides[0].id);
  };

  const moveSelectedSlide = (direction: "up" | "down") => {
    updateDraft({ ...draft, slides: moveSlide(draft.slides, selectedSlideId, direction) });
  };

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-edsync-border bg-edsync-card p-4 lg:border-b-0 lg:border-r">
          <Link href="/" className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald text-white">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold">EdSync Studio</p>
              <p className="text-xs text-edsync-subtle">Create, design, practice</p>
            </div>
          </Link>
          <nav className="grid gap-1">
            {STUDIO_TABS.map((tab) => {
              const Icon = kindIcons[tab.kind] ?? FileText;
              const active = activeKind === tab.kind;
              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => selectKind(tab.kind)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-edsync-blue text-white"
                      : "text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </span>
                  {draftStatus !== "saved" && active && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">1</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-6 rounded-lg border border-edsync-border bg-edsync-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-edsync-subtle">Draft</p>
            <p className="mt-1 text-sm font-semibold capitalize">{draftStatus.replace("_", " ")}</p>
            <p className="mt-2 text-xs leading-5 text-edsync-subtle">
              Unsaved work is kept locally first and flushed when you leave the page.
            </p>
          </div>
          <div className="mt-4 rounded-lg border border-edsync-border bg-edsync-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-edsync-subtle hover:text-edsync-text"
                onClick={() => setIncludeArchived((value) => !value)}
                title="Toggle archived items"
              >
                {includeArchived ? "All items" : "Saved"}
              </button>
              <span className="rounded-full bg-edsync-card px-2 py-0.5 text-xs font-bold text-edsync-subtle">
                {serverItems.length}
              </span>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {serverItems.length === 0 && (
                <p className="rounded-lg border border-dashed border-edsync-border p-3 text-xs leading-5 text-edsync-subtle">
                  Server-saved Studio items will appear here.
                </p>
              )}
              {serverItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openServerItem(item)}
                  className={`w-full rounded-lg border p-2 text-left text-sm transition ${
                    currentServerId === item.id
                      ? "border-edsync-blue bg-edsync-blue/10"
                      : "border-edsync-border bg-edsync-card hover:border-edsync-blue/40"
                  }`}
                >
                  <span className="block truncate font-semibold">{item.title}</span>
                  <span className="mt-1 block text-xs capitalize text-edsync-subtle">
                    {item.status} - {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                  {item.status === "archived" && (
                    <span className="mt-2 flex gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Restore ${item.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          restoreServerItem(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") restoreServerItem(item);
                        }}
                        className="rounded-full bg-edsync-blue/10 px-2 py-1 text-xs font-bold text-edsync-blue"
                      >
                        Restore
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Delete ${item.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          hardDeleteServerItem(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") hardDeleteServerItem(item);
                        }}
                        className="rounded-full bg-edsync-red/10 px-2 py-1 text-xs font-bold text-edsync-red"
                      >
                        Delete
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-edsync-border bg-edsync-card px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-edsync-blue">Comprehensive LMS authoring</p>
                <input
                  className="mt-1 w-full bg-transparent font-display text-3xl font-bold outline-none"
                  value={itemTitle}
                  onChange={(event) => {
                    itemTitleRef.current = event.target.value;
                    setItemTitle(event.target.value);
                    setDraftStatus("saving");
                  }}
                  aria-label="Studio item title"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveDraft} className="btn-secondary px-3 py-2 text-sm">
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <button type="button" onClick={publishCurrentItem} className="btn-secondary px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Publish
                </button>
                <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setStatusMessage("Split panes are ready for the next layout pass")}>
                  <SplitSquareHorizontal className="h-4 w-4" />
                  Split
                </button>
                <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setStatusMessage("History is tracked through local drafts and D1 events")}>
                  <History className="h-4 w-4" />
                  History
                </button>
                <button type="button" onClick={exportDraft} className="btn-secondary px-3 py-2 text-sm">
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button type="button" onClick={resetDraft} className="btn-secondary px-3 py-2 text-sm">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
                <Link href="/ai" className="btn-primary px-3 py-2 text-sm">
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </Link>
              </div>
            </div>
            <div className="mt-3 inline-flex rounded-full border border-edsync-border bg-edsync-surface px-3 py-1 text-xs font-semibold text-edsync-subtle">
              {statusMessage}
            </div>
          </header>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:p-6">
            <div className="min-w-0 space-y-4">
              {(activeKind === "lesson" || activeKind === "note" || activeKind === "doc") && (
                <RichTextStudioEditor
                  value={draft.html}
                  onChange={(value) => updateDraft({ ...draft, html: value.html, plainText: value.plainText })}
                />
              )}

              {activeKind === "sheet" && (
                <div className="rounded-lg border border-edsync-border bg-edsync-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edsync-border p-3">
                    <div>
                      <p className="font-semibold">Sheet Editor</p>
                      <p className="text-xs text-edsync-subtle">
                        Advanced sheet controls {advancedSheetLoaded ? "enabled" : "ready"} with native fallback grid.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={loadUniverEngine}>
                        <Grid3X3 className="h-4 w-4" />
                        Advanced tools
                      </button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => updateDraft({ ...draft, sheet: addSheetRow(draft.sheet) })}>
                        <Plus className="h-4 w-4" />
                        Row
                      </button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => updateDraft({ ...draft, sheet: addSheetColumn(draft.sheet) })}>
                        <Plus className="h-4 w-4" />
                        Column
                      </button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => csvInputRef.current?.click()}>
                        <FileUp className="h-4 w-4" />
                        CSV
                      </button>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(event) => importCsv(event.target.files?.[0])}
                      />
                    </div>
                  </div>
                  <div className="overflow-auto p-3">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="w-12 border border-edsync-border bg-edsync-surface px-2 py-1 text-xs text-edsync-subtle" />
                          {Array.from({ length: sheetColumnCount }, (_, columnIndex) => (
                            <th key={`column-${columnIndex}`} className="border border-edsync-border bg-edsync-surface px-2 py-1">
                              <div className="flex items-center justify-between gap-2 text-xs text-edsync-subtle">
                                <span>{String.fromCharCode(65 + columnIndex)}</span>
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-edsync-card"
                                  onClick={() => updateDraft({ ...draft, sheet: deleteSheetColumn(draft.sheet, columnIndex) })}
                                  aria-label={`Delete column ${columnIndex + 1}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {draft.sheet.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <th className="border border-edsync-border bg-edsync-surface px-2 py-1">
                              <div className="flex items-center justify-between gap-2 text-xs text-edsync-subtle">
                                <span>{rowIndex + 1}</span>
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-edsync-card"
                                  onClick={() => updateDraft({ ...draft, sheet: deleteSheetRow(draft.sheet, rowIndex) })}
                                  aria-label={`Delete row ${rowIndex + 1}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </th>
                            {Array.from({ length: sheetColumnCount }, (_, columnIndex) => row[columnIndex] ?? "").map((cell, columnIndex) => (
                              <td key={`${rowIndex}-${columnIndex}`} className="border border-edsync-border">
                                <input
                                  className="h-10 min-w-40 bg-transparent px-2 outline-none focus:bg-edsync-surface"
                                  value={cell}
                                  onChange={(event) => updateSheetCell(rowIndex, columnIndex, event.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeKind === "slide" && (
                <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {draft.slides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setSelectedSlideId(slide.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selectedSlideId === slide.id
                            ? "border-edsync-blue bg-edsync-blue/10"
                            : "border-edsync-border bg-edsync-card hover:border-edsync-blue/40"
                        }`}
                      >
                        <span className="text-xs font-semibold text-edsync-subtle">Slide {index + 1}</span>
                        <span className="mt-1 block truncate font-semibold">{slide.title}</span>
                      </button>
                    ))}
                    <button type="button" onClick={addSlide} className="btn-secondary w-full justify-center py-2 text-sm">
                      <Plus className="h-4 w-4" />
                      Add slide
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={duplicateSelectedSlide} className="btn-secondary justify-center py-2 text-sm">
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                      <button type="button" onClick={deleteSelectedSlide} className="btn-secondary justify-center py-2 text-sm">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                      <button type="button" onClick={() => moveSelectedSlide("up")} className="btn-secondary justify-center py-2 text-sm">
                        <ArrowUp className="h-4 w-4" />
                        Up
                      </button>
                      <button type="button" onClick={() => moveSelectedSlide("down")} className="btn-secondary justify-center py-2 text-sm">
                        <ArrowDown className="h-4 w-4" />
                        Down
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-edsync-border bg-edsync-card p-4">
                    <div className="aspect-video rounded-lg border border-edsync-border bg-edsync-surface p-8 shadow-inner">
                      <div className="flex h-full flex-col justify-between">
                        <div>
                          <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: activeSlide.accent }}>
                            EdSync slide
                          </span>
                          <input
                            className="mt-6 w-full bg-transparent font-display text-4xl font-bold outline-none"
                            value={activeSlide.title}
                            onChange={(event) =>
                              updateDraft({
                                ...draft,
                                slides: draft.slides.map((slide) =>
                                  slide.id === activeSlide.id ? { ...slide, title: event.target.value } : slide,
                                ),
                              })
                            }
                          />
                        </div>
                        <p className="text-sm text-edsync-subtle">Drag-ready canvas, objects, themes, transitions, and slideshow controls.</p>
                      </div>
                    </div>
                    <textarea
                      className="edsync-input mt-3 min-h-24"
                      value={activeSlide.notes}
                      onChange={(event) =>
                        updateDraft({
                          ...draft,
                          slides: draft.slides.map((slide) =>
                            slide.id === activeSlide.id ? { ...slide, notes: event.target.value } : slide,
                          ),
                        })
                      }
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SLIDE_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          className="rounded-lg border border-edsync-border px-3 py-2 text-sm font-semibold hover:border-edsync-blue/40"
                          onClick={() =>
                            updateDraft({
                              ...draft,
                              slides: draft.slides.map((slide) =>
                                slide.id === activeSlide.id ? { ...slide, accent: theme.colors.primary } : slide,
                              ),
                            })
                          }
                        >
                          {theme.name}
                        </button>
                      ))}
                      <button type="button" onClick={() => setPresenting(true)} className="btn-primary px-3 py-2 text-sm">
                        <MonitorPlay className="h-4 w-4" />
                        Present
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeKind === "practice" && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {PRACTICE_MODES.map((mode) => (
                    <Link key={mode.mode} href={`/practice?mode=${mode.mode}`} className="rounded-lg border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40">
                      <Timer className="mb-3 h-6 w-6 text-edsync-blue" />
                      <p className="font-semibold">{mode.label}</p>
                      <p className="mt-1 text-sm leading-6 text-edsync-subtle">{mode.description}</p>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                        Open mode <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <Panel title="Insert Tools" icon={Plus}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Text", icon: FileText, action: () => insertBlock("Text block") },
                    { label: "Image", icon: ImageIcon, action: appendImagePrompt },
                    { label: "Table", icon: Table2, action: () => selectKind("sheet") },
                    { label: "Shape", icon: Shapes, action: () => insertBlock("Design callout") },
                    { label: "Slides", icon: Presentation, action: () => selectKind("slide") },
                    { label: "Practice", icon: Timer, action: () => selectKind("practice") },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button key={tool.label} type="button" onClick={tool.action} className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left text-sm font-semibold hover:border-edsync-blue/40">
                        <Icon className="mb-2 h-4 w-4 text-edsync-blue" />
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Design Templates" icon={Shapes}>
                <div className="space-y-2">
                  {DESIGN_TEMPLATES.slice(0, 5).map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => insertBlock(template.title)}
                      className="w-full rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40"
                    >
                      <p className="text-sm font-semibold">{template.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-edsync-subtle">{template.description}</p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Section Blocks" icon={Columns3}>
                <div className="space-y-2">
                  {DESIGN_BLOCKS.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => insertBlock(block.title)}
                      className="flex w-full items-start gap-3 rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40"
                    >
                      <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-edsync-emerald" />
                      <span>
                        <span className="block text-sm font-semibold">{block.title}</span>
                        <span className="line-clamp-2 text-xs text-edsync-subtle">{block.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="AI Actions" icon={Sparkles}>
                <div className="space-y-2">
                  {AI_PROMPT_CONTRACTS.map((contract) => (
                    <Link key={contract.id} href={`/ai?task=${contract.id}`} className="block w-full rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40">
                      <p className="text-sm font-semibold">{contract.title}</p>
                      <p className="mt-1 text-xs text-edsync-subtle">{contract.description}</p>
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel title="Slide Show" icon={MonitorPlay}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <button type="button" onClick={() => setPresenting(true)} className="btn-secondary justify-center py-2">Present</button>
                  <button type="button" onClick={() => setStatusMessage("Fade transition selected")} className="btn-secondary justify-center py-2">Transitions</button>
                  <button type="button" onClick={() => setStatusMessage("Rise animation selected")} className="btn-secondary justify-center py-2">Animation</button>
                  <button type="button" onClick={() => selectKind("slide")} className="btn-secondary justify-center py-2">Notes</button>
                </div>
              </Panel>

              <Panel title="Inspector" icon={PanelRight}>
                <div className="space-y-2 text-sm text-edsync-subtle">
                  <p>Style, layout, references, navigation, accessibility, and export settings stay here instead of adding more top bars.</p>
                  <button type="button" onClick={archiveCurrentItem} className="btn-secondary w-full justify-center py-2 text-sm">
                    <Trash2 className="h-4 w-4" />
                    Archive item
                  </button>
                </div>
              </Panel>
            </aside>
          </div>
        </section>
      </div>
      {presenting && (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4 text-white">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/60">
                  Slide {activeSlideIndex + 1} of {draft.slides.length}
                </p>
                <h2 className="font-display text-xl font-bold">{activeSlide.title}</h2>
              </div>
              <button type="button" className="rounded-lg bg-white/10 p-2 hover:bg-white/20" onClick={() => setPresenting(false)} aria-label="Close slideshow">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex items-center justify-center rounded-2xl bg-white p-8 text-slate-950">
                <div className="aspect-video w-full max-w-5xl rounded-xl border border-slate-200 p-10 shadow-2xl">
                  <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: activeSlide.accent }}>
                    EdSync slideshow
                  </span>
                  <h3 className="mt-10 font-display text-6xl font-bold">{activeSlide.title}</h3>
                  <p className="mt-8 max-w-2xl text-lg text-slate-600">Use this native preview to rehearse pacing, notes, and slide flow before publishing.</p>
                </div>
              </div>
              <aside className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-semibold text-white/70">Speaker notes</p>
                <p className="mt-3 text-sm leading-6 text-white/85">{activeSlide.notes}</p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
                    onClick={() => setSelectedSlideId(draft.slides[Math.max(activeSlideIndex - 1, 0)].id)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
                    onClick={() => setSelectedSlideId(draft.slides[Math.min(activeSlideIndex + 1, draft.slides.length - 1)].id)}
                  >
                    Next
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-edsync-border bg-edsync-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-edsync-blue" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
