"use client";

import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/content/section-library";
import type { LessonSection } from "@/types";

function SortableSection({ section, index, selected, onSelect }: {
  section: LessonSection; index: number; selected: boolean; onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex min-w-0 items-center rounded-lg border ${isDragging ? "z-10 opacity-70" : ""} ${selected ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2"}`}>
    <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${section.title}`} className="shrink-0 touch-none rounded-md p-2 text-fg-faint hover:text-fg"><GripVertical size={15} /></button>
    <button type="button" onClick={onSelect} aria-current={selected ? "step" : undefined} className="min-w-0 flex-1 px-1 py-2 text-left"><span className="mr-2 text-xs tabular-nums text-fg-faint">{index + 1}</span><span className="truncate text-sm font-medium text-fg">{section.title || "Untitled block"}</span><span className="ml-2 text-[11px] capitalize text-fg-muted">{section.content_type}</span></button>
  </div>;
}

export function SectionOutline({ sections, selectedId, onSelect, onReorder, onAdd }: {
  sections: LessonSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (sections: LessonSection[]) => void;
  onAdd: (template: SectionTemplate) => void;
}) {
  const [templateId, setTemplateId] = useState(SECTION_TEMPLATES[0].id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.id === active.id);
    const to = sections.findIndex((section) => section.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(sections, from, to));
  };
  return <div className="min-w-0 space-y-3">
    <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Outline <span className="text-fg-faint">{sections.length}</span></h2></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">{sections.map((section, index) => <SortableSection key={section.id} section={section} index={index} selected={section.id === selectedId} onSelect={() => onSelect(section.id)} />)}</div>
      </SortableContext>
    </DndContext>
    <div className="flex gap-1.5"><select aria-label="Block template" className="select min-w-0 flex-1 text-xs" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{SECTION_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select><button type="button" aria-label="Add selected block" onClick={() => onAdd(SECTION_TEMPLATES.find((template) => template.id === templateId) || SECTION_TEMPLATES[0])} className="btn btn-secondary btn-sm"><Plus size={15} /></button></div>
  </div>;
}
