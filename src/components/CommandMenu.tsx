"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X, type LucideIcon } from "lucide-react";

export type CommandItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: string;
};

export default function CommandMenu({ items }: { items: CommandItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const results = items
    .filter((item) =>
      `${item.label} ${item.group ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 12);
  const open = () => {
    setQuery("");
    setSelected(0);
    dialog.current?.showModal();
  };
  const navigate = (href: string) => {
    dialog.current?.close();
    router.push(href);
  };

  useEffect(() => {
    if (dialog.current?.open)
      dialog.current
        .querySelector(`#command-${selected}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [selected, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="workspace-search"
        onClick={open}
        aria-label="Search pages and actions"
      >
        <Search size={16} />
        <span>Jump to…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-labelledby="command-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="command-content">
          <div className="command-input-row">
            <Search size={20} />
            <label
              id="command-title"
              htmlFor="command-query"
              className="sr-only"
            >
              Find a page or action
            </label>
            <input
              id="command-query"
              placeholder="Where would you like to go?"
              value={query}
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-autocomplete="list"
              aria-activedescendant={
                results[selected] ? `command-${selected}` : undefined
              }
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelected((index) =>
                    results.length
                      ? (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          results.length) %
                        results.length
                      : 0,
                  );
                }
                if (event.key === "Enter" && results[selected]) {
                  event.preventDefault();
                  navigate(results[selected].href);
                }
              }}
            />
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="workspace-icon"
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </div>
          <div
            id="command-results"
            role="listbox"
            aria-label="Pages and actions"
            className="command-results"
          >
            {results.map((item, index) => (
              <button
                key={`${item.href}-${item.label}`}
                id={`command-${index}`}
                role="option"
                aria-selected={selected === index}
                type="button"
                tabIndex={-1}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelected(index)}
              >
                <item.icon size={18} />
                <span>
                  {item.label}
                  <small>{item.group}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!results.length && (
              <p className="p-6 text-center text-sm text-edsync-subtle">
                No pages found. Try “courses”, “notes”, or “settings”.
              </p>
            )}
          </div>
          <div className="command-footer">
            ↑ ↓ to explore <span>Enter to open · Esc to close</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
