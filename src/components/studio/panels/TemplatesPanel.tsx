"use client";

import { useMemo, useState } from "react";
import { LayoutTemplate, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useConfirm } from "@/components/ui/Confirm";
import { candidateLayouts, composeTemplate, createLayoutContext, pageFromContent, syncContentFromElements } from "@/lib/studio/auto-layout";
import { getDeckTheme, getFontPair, searchTemplates, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDef } from "@/lib/studio/library";
import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import ScenePreview from "../preview/ScenePreview";
import { studioId, useStudio } from "../store";
import { PanelChips, PanelEmpty, PanelSearch, PanelSection } from "./parts/PanelControls";

const previews = new Map<string, SceneDeck>();

export function previewTemplate(template: TemplateDef): SceneDeck {
  let preview = previews.get(template.id);
  if (!preview) {
    preview = composeTemplate(template);
    previews.set(template.id, preview);
  }
  return preview;
}

function layoutPreviews(deck: SceneDeck, page: ScenePage) {
  const content = syncContentFromElements(page) ?? page.content;
  if (!content) return [];
  const theme = getDeckTheme(deck.themeId);
  const context = createLayoutContext({ width: deck.width, height: deck.height, theme, fontPair: getFontPair(deck.fontPairId ?? theme.fontPairId), seed: deck.seed ?? 0, deckKind: deck.kind, newId: () => studioId("preview") });
  return candidateLayouts(content, context).slice(0, 6).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    page: pageFromContent(content, context, candidate.id).page,
  }));
}

export default function TemplatesPanel() {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const replaceDeck = useStudio((state) => state.replaceDeck);
  const appendPages = useStudio((state) => state.appendPages);
  const setLayout = useStudio((state) => state.setLayout);
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [selected, setSelected] = useState<TemplateDef | null>(null);
  const templates = useMemo(() => searchTemplates(query, category === "all" ? undefined : category), [query, category]);
  const page = deck?.pages.find((entry) => entry.id === activePageId);
  const layouts = useMemo(() => deck && page ? layoutPreviews(deck, page) : [], [deck, page]);

  const applyTemplate = async (mode: "replace" | "append") => {
    if (!selected || !deck) return;
    if (mode === "replace" && deck.pages.some((entry) => entry.elements.length)) {
      if (!await confirm({ title: "Replace this design?", body: "The current pages will be replaced.", confirmLabel: "Replace design" })) return;
    }
    const next = composeTemplate(selected, { id: deck.id, newId: () => studioId("scene") });
    if (mode === "replace") replaceDeck({ ...next, title: deck.title }, { recordHistory: true });
    else appendPages(next.pages);
    setSelected(null);
  };

  return <div role="tabpanel" aria-label="Templates" className="pb-4">
    <PanelSearch value={query} onChange={setQuery} placeholder="Search templates" />
    <PanelChips<TemplateCategory | "all"> value={category} onChange={setCategory} label="Template categories" items={[{ id: "all", name: "All" }, ...TEMPLATE_CATEGORIES.map((name) => ({ id: name, name }))]} />
    {templates.length ? <div className="grid grid-cols-2 gap-2 p-3">{templates.map((template) => {
      const preview = previewTemplate(template);
      return <button key={template.id} type="button" onClick={() => setSelected(template)} className="group min-w-0 overflow-hidden rounded-lg border border-line bg-elevated text-left transition-colors hover:border-accent focus-visible:border-accent" aria-label={`Preview ${template.name} template, ${preview.pages.length} pages`}>
        <div className="relative overflow-hidden bg-surface-2"><ScenePreview page={preview.pages[0]} deck={preview} width={128} className="mx-auto" /><span className="absolute bottom-1 right-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] text-fg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{preview.pages.length} pages</span></div>
        <span className="block truncate px-2 py-1.5 text-xs font-medium text-fg">{template.name}</span>
      </button>;
    })}</div> : <PanelEmpty>No templates match.</PanelEmpty>}
    <PanelSection title="Layouts" />
    {layouts.length ? <div className="grid grid-cols-2 gap-2 px-3">{layouts.map((layout) => <button key={layout.id} type="button" onClick={() => setLayout(layout.id)} aria-label={`Use ${layout.name} layout`} aria-pressed={page?.layoutId === layout.id} className="min-w-0 overflow-hidden rounded-lg border border-line bg-elevated text-left hover:border-accent aria-pressed:border-accent"><ScenePreview page={layout.page} deck={deck!} width={128} className="mx-auto" /><span className="block truncate px-2 py-1.5 text-xs text-fg">{layout.name}</span></button>)}</div> : <PanelEmpty>Add content to see layouts.</PanelEmpty>}
    <Dialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? "Template"} size="lg" footer={<><button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyTemplate("append")}><Plus size={15} /> Add pages</button><button type="button" className="btn btn-primary btn-sm" onClick={() => void applyTemplate("replace")}><LayoutTemplate size={15} /> Replace design</button></>}>
      {selected && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{previewTemplate(selected).pages.map((entry, index) => <div key={entry.id} className="overflow-hidden rounded-lg border border-line bg-surface"><ScenePreview page={entry} deck={previewTemplate(selected)} width={240} className="mx-auto max-w-full" /><div className="border-t border-line px-2 py-1.5 text-xs text-fg-muted">{index + 1}. {entry.name ?? `Page ${index + 1}`}</div></div>)}</div>}
    </Dialog>
  </div>;
}
