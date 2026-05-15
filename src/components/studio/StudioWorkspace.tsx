"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Columns3,
  Download,
  FileText,
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
  createDebouncedDraftWriter,
  readStudioDraft,
  writeStudioDraft,
} from "@/lib/studio/drafts";
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

export default function StudioWorkspace({ initialKind = "lesson" }: StudioWorkspaceProps) {
  const [activeKind, setActiveKind] = useState<StudioItemKind>(initialKind);
  const [draft, setDraft] = useState<StudioDraftValue>(defaultDraft);
  const [draftStatus, setDraftStatus] = useState<"saved" | "local_draft" | "saving">("saved");
  const [selectedSlideId, setSelectedSlideId] = useState("slide-1");
  const [advancedSheetLoaded, setAdvancedSheetLoaded] = useState(false);
  const writerRef = useRef(createDebouncedDraftWriter<StudioDraftValue>((value) => {
    writeStudioDraft({
      kind: activeKind,
      itemId: "workspace",
      title: titleForKind(activeKind),
      value,
      status: "local_draft",
    });
    setDraftStatus("local_draft");
  }));

  useEffect(() => {
    setActiveKind(initialKind);
    const stored = readStudioDraft<StudioDraftValue>(initialKind, "workspace");
    setDraft(stored?.value ?? defaultDraft);
    setDraftStatus(stored ? "local_draft" : "saved");
  }, [initialKind]);

  useEffect(() => {
    const draftWriter = writerRef.current;
    const flush = () => draftWriter.flush(draft);
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

  const updateDraft = (next: StudioDraftValue) => {
    setDraft(next);
    setDraftStatus("saving");
    writerRef.current.schedule(next);
  };

  const loadUniverEngine = () => {
    setAdvancedSheetLoaded(true);
  };

  const addSlide = () => {
    const nextSlide = {
      id: `slide-${draft.slides.length + 1}`,
      title: "New Slide",
      notes: "Add speaker notes or teaching guidance.",
      accent: SLIDE_THEMES[draft.slides.length % SLIDE_THEMES.length].colors.primary,
    };
    updateDraft({ ...draft, slides: [...draft.slides, nextSlide] });
    setSelectedSlideId(nextSlide.id);
  };

  const updateSheetCell = (rowIndex: number, columnIndex: number, value: string) => {
    const sheet = draft.sheet.map((row, currentRow) =>
      currentRow === rowIndex
        ? row.map((cell, currentColumn) => (currentColumn === columnIndex ? value : cell))
        : row,
    );
    updateDraft({ ...draft, sheet });
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
                  onClick={() => setActiveKind(tab.kind)}
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
        </aside>

        <section className="min-w-0">
          <header className="border-b border-edsync-border bg-edsync-card px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-edsync-blue">Comprehensive LMS authoring</p>
                <h1 className="font-display text-3xl font-bold">{titleForKind(activeKind)}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Save", icon: Save },
                  { label: "Split", icon: SplitSquareHorizontal },
                  { label: "History", icon: History },
                  { label: "Export", icon: Download },
                  { label: "Reset", icon: RotateCcw },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button key={action.label} type="button" className="btn-secondary px-3 py-2 text-sm">
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </button>
                  );
                })}
                <button type="button" className="btn-primary px-3 py-2 text-sm">
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </button>
              </div>
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
                    <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={loadUniverEngine}>
                      <Grid3X3 className="h-4 w-4" />
                      Enable advanced sheet tools
                    </button>
                  </div>
                  <div className="overflow-auto p-3">
                    <table className="min-w-full border-collapse text-sm">
                      <tbody>
                        {draft.sheet.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, columnIndex) => (
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
                    { label: "Text", icon: FileText },
                    { label: "Image", icon: ImageIcon },
                    { label: "Table", icon: Table2 },
                    { label: "Shape", icon: Shapes },
                    { label: "Slides", icon: Presentation },
                    { label: "Practice", icon: Timer },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button key={tool.label} type="button" className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left text-sm font-semibold hover:border-edsync-blue/40">
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
                    <button key={template.id} type="button" className="w-full rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40">
                      <p className="text-sm font-semibold">{template.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-edsync-subtle">{template.description}</p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Section Blocks" icon={Columns3}>
                <div className="space-y-2">
                  {DESIGN_BLOCKS.map((block) => (
                    <button key={block.id} type="button" className="flex w-full items-start gap-3 rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40">
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
                    <button key={contract.id} type="button" className="w-full rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left hover:border-edsync-blue/40">
                      <p className="text-sm font-semibold">{contract.title}</p>
                      <p className="mt-1 text-xs text-edsync-subtle">{contract.description}</p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Slide Show" icon={MonitorPlay}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <button type="button" className="btn-secondary justify-center py-2">Present</button>
                  <button type="button" className="btn-secondary justify-center py-2">Transitions</button>
                  <button type="button" className="btn-secondary justify-center py-2">Animation</button>
                  <button type="button" className="btn-secondary justify-center py-2">Notes</button>
                </div>
              </Panel>

              <Panel title="Inspector" icon={PanelRight}>
                <div className="space-y-2 text-sm text-edsync-subtle">
                  <p>Style, layout, references, navigation, accessibility, and export settings stay here instead of adding more top bars.</p>
                  <button type="button" className="btn-secondary w-full justify-center py-2 text-sm">
                    <Trash2 className="h-4 w-4" />
                    Archive item
                  </button>
                </div>
              </Panel>
            </aside>
          </div>
        </section>
      </div>
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
