"use client";

import { useState } from "react";
import type { GlossaryTerm } from "@/types";

// Inline glossary edit card
export function GlossaryEditCard({
  term,
  onSave,
  onCancel,
}: {
  term: GlossaryTerm;
  onSave: (id: string, u: Partial<GlossaryTerm>) => Promise<void>;
  onCancel: () => void;
}) {
  const [t, setT] = useState(term.term);
  const [d, setD] = useState(term.definition);
  const [e, setE] = useState(term.example || "");
  return (
    <div className="edsync-card border-2 border-edsync-blue/40 space-y-2">
      <input
        value={t}
        onChange={(ev) => setT(ev.target.value)}
        className="edsync-input py-1.5 font-bold text-sm"
        placeholder="Term"
      />
      <textarea
        value={d}
        onChange={(ev) => setD(ev.target.value)}
        rows={2}
        className="edsync-textarea text-sm"
        placeholder="Definition..."
      />
      <input
        value={e}
        onChange={(ev) => setE(ev.target.value)}
        className="edsync-input py-1.5 text-xs"
        placeholder="Example..."
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost text-xs py-1">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave(term.id, { term: t, definition: d, example: e })
          }
          className="btn-primary text-xs py-1"
        >
          Save
        </button>
      </div>
    </div>
  );
}
