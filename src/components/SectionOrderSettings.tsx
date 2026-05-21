"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";

type SectionOrderSettingsProps = {
  storageKey: string;
  sections: string[];
  title?: string;
};

export const SECTION_ORDER_EVENT = "edsync-section-order-updated";

export type SectionOrderEventDetail = {
  storageKey: string;
  order: string[];
};

function normalizeOrder(saved: string[] | null, sections: string[]) {
  if (!saved) return sections;
  const known = new Set(sections);
  const ordered = saved.filter((section) => known.has(section));
  const missing = sections.filter((section) => !ordered.includes(section));
  return [...ordered, ...missing];
}

export default function SectionOrderSettings({
  storageKey,
  sections,
  title = "Section order",
}: SectionOrderSettingsProps) {
  const defaultOrder = useMemo(() => sections, [sections]);
  const [order, setOrder] = useState(defaultOrder);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null") as
        | string[]
        | null;
      setOrder(normalizeOrder(saved, sections));
    } catch {
      setOrder(sections);
    }
  }, [sections, storageKey]);

  const persist = (next: string[]) => {
    setOrder(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent<SectionOrderEventDetail>(SECTION_ORDER_EVENT, {
        detail: { storageKey, order: next },
      }),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  return (
    <section className="edsync-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-edsync-text">{title}</h2>
          <p className="text-sm text-edsync-subtle">
            Reorder how this workspace should feel on your next visits.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-2 text-sm"
          onClick={() => persist(defaultOrder)}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {order.map((section, index) => (
          <div
            key={section}
            className="flex items-center justify-between gap-3 rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-edsync-text">{section}</p>
              <p className="text-xs text-edsync-subtle">Position {index + 1}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${section} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${section} down`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
