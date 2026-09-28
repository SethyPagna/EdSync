"use client";

import { SearchInput } from "@/components/ui/SearchInput";

export function PanelSearch({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) {
  return <div className="sticky top-0 z-10 bg-surface px-3 pb-2 pt-3"><SearchInput value={value} onChange={onChange} placeholder={placeholder} className="max-w-none sm:max-w-none" /></div>;
}

export function PanelChips<T extends string>({ value, onChange, items, label }: { value: T; onChange(value: T): void; items: readonly { id: T; name: string }[]; label: string }) {
  return <div className="sticky top-[58px] z-10 flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 pb-2" role="radiogroup" aria-label={label}>
    {items.map((item) => <button key={item.id} type="button" role="radio" aria-checked={value === item.id} onClick={() => onChange(item.id)} className="chip shrink-0 text-xs" data-active={value === item.id}>{item.name}</button>)}
  </div>;
}

export function PanelSection({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4"><h3 className="text-xs font-semibold text-fg">{title}</h3>{action}</div>;
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-6 text-center text-xs text-fg-muted">{children}</p>;
}
