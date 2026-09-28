"use client";

import { useStudio } from "../store";

export default function LayersPanel() {
  const elements = useStudio((state) => state.deck?.pages.find((page) => page.id === state.activePageId)?.elements ?? []);
  const selectionIds = useStudio((state) => state.selectionIds);
  const selectElements = useStudio((state) => state.selectElements);
  return (
    <div className="space-y-1 p-3" role="tabpanel" aria-label="Layers">
      {elements.length ? [...elements].reverse().map((element) => (
        <button key={element.id} type="button" aria-pressed={selectionIds.includes(element.id)} onClick={() => selectElements([element.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2 aria-pressed:bg-accent-soft">
          <span className="truncate">{element.name || (element.kind === "text" ? element.text.slice(0, 32) : element.kind)}</span>
        </button>
      )) : <p className="px-2 py-3 text-sm text-fg-muted">No layers yet</p>}
    </div>
  );
}
