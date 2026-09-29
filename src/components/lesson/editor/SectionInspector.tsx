"use client";

import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { LessonSection } from "@/types";

export function SectionInspector({ section, onRequiredChange, onDuplicate, onDelete }: {
  section: LessonSection | null;
  onRequiredChange: (required: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!section) return <p className="text-sm text-fg-muted">Choose a block to inspect its settings.</p>;
  return <div className="space-y-4">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Selected block</p><h2 className="mt-1 truncate text-sm font-semibold text-fg">{section.title}</h2><p className="mt-1 text-xs capitalize text-fg-muted">{section.content_type} · {section.duration_minutes} min</p></div>
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-xs font-medium text-fg"><span>Required for completion</span><input type="checkbox" checked={section.is_required} onChange={(event) => onRequiredChange(event.target.checked)} className="accent-accent" /></label>
    <div className="flex flex-wrap gap-2"><Button size="sm" icon={Copy} onClick={onDuplicate}>Duplicate</Button><Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>Delete</Button></div>
  </div>;
}
