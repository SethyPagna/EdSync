"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { isEditableTarget, useIsMac } from "@/components/ui";
import { rankCommands, type ShellCommand } from "@/components/shell/commands";

const RECENT_KEY = "edsync-command-recent";

function readRecent(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

export default function CommandMenu({ items }: { items: ShellCommand[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();
  const isMac = useIsMac();
  const results = useMemo(() => rankCommands(items, query, recent).slice(0, 14), [items, query, recent]);

  const open = () => {
    setQuery("");
    setSelected(0);
    setRecent(readRecent());
    if (!dialog.current?.open) dialog.current?.showModal();
    window.requestAnimationFrame(() => input.current?.focus());
  };

  const choose = (item: ShellCommand) => {
    const next = [item.id, ...readRecent().filter((id) => id !== item.id)].slice(0, 8);
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Private storage may be unavailable. */ }
    setRecent(next);
    dialog.current?.close();
    if (item.href) router.push(item.href);
    else item.onSelect?.();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (isEditableTarget(target)) return;
      if (target instanceof Element && target.closest('[data-hotkeys="studio"]')) return;
      event.preventDefault();
      if (dialog.current?.open) dialog.current.close();
      else open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dialog.current?.open) return;
    dialog.current.querySelector(`#command-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, query]);

  return (
    <>
      <button type="button" className="workspace-search" onClick={open} aria-label="Search pages and actions">
        <Search size={16} aria-hidden />
        <span>Search</span>
        <kbd>{isMac ? "⌘ K" : "Ctrl K"}</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label="Search pages and actions"
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      >
        <div className="command-content">
          <div className="command-input-row">
            <Search size={18} aria-hidden />
            <label htmlFor="command-query" className="sr-only">Search pages and actions</label>
            <input
              ref={input}
              id="command-query"
              placeholder="Where to?"
              value={query}
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-autocomplete="list"
              aria-activedescendant={results[selected] ? `command-${selected}` : undefined}
              onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelected((index) => results.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
                }
                if (event.key === "Enter" && results[selected]) { event.preventDefault(); choose(results[selected]); }
              }}
            />
            <button type="button" onClick={() => dialog.current?.close()} className="workspace-icon" aria-label="Close search"><X size={17} /></button>
          </div>
          <div id="command-results" role="listbox" aria-label="Pages and actions" className="command-results">
            {results.map((item, index) => {
              const group = !query && recent.includes(item.id) ? "Recent" : item.group;
              const previous = results[index - 1];
              const previousGroup = previous && !query && recent.includes(previous.id) ? "Recent" : previous?.group;
              const showGroup = group !== previousGroup;
              return (
                <div key={item.id}>
                  {showGroup && <p className="command-group-label">{group}</p>}
                  <button id={`command-${index}`} role="option" aria-selected={selected === index} type="button" tabIndex={-1} onClick={() => choose(item)} onMouseEnter={() => setSelected(index)}>
                    <item.icon size={17} aria-hidden />
                    <span>{item.label}</span>
                    {item.href && <ArrowUpRight size={14} aria-hidden />}
                  </button>
                </div>
              );
            })}
            {results.length === 0 && <p className="p-6 text-center text-sm text-fg-muted">No matching pages or actions.</p>}
          </div>
          <div className="command-footer">↑ ↓ Navigate <span>Enter Select · Esc Close</span></div>
        </div>
      </dialog>
    </>
  );
}
