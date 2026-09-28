"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, Download, FileImage, FileText, Presentation, Printer } from "lucide-react";
import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import { buildImagePdf } from "@/lib/studio/export/pdf";
import { buildNativePptx } from "@/lib/studio/export/pptx";
import { renderPageImage } from "../fabric/render";
import ScenePreview from "../preview/ScenePreview";
import { useStudio } from "../store";

function fileStem(title: string): string {
  return title.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "EdSync-design";
}

function download(url: string, name: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  download(url, name);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function jpegBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",", 2)[1];
  if (!dataUrl.startsWith("data:image/jpeg;base64,") || !encoded) throw new Error("Page image is not a JPEG.");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default function ExportMenu() {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [printDeck, setPrintDeck] = useState<SceneDeck | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  useEffect(() => {
    if (!printDeck) return;
    const clear = () => setPrintDeck(null);
    window.addEventListener("afterprint", clear);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", clear); };
  }, [printDeck]);

  const run = async (label: string, action: (current: SceneDeck, pages: ScenePage[]) => Promise<void>) => {
    if (!deck || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    setProgress(label);
    setOpen(false);
    try {
      const pages = deck.pages.filter((page) => !page.hidden);
      if (!pages.length) throw new Error("No visible pages to export.");
      await action(deck, pages);
      setProgress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed. Please retry.");
      setProgress("");
    } finally { setBusy(false); }
  };

  const exportCurrent = () => void run("Rendering PNG…", async (current, pages) => {
    const page = pages.find((entry) => entry.id === activePageId) ?? pages[0];
    const image = await renderPageImage(page, current, { scale: 2, format: "png" });
    download(image, `${fileStem(current.title)}-${pages.indexOf(page) + 1}.png`);
  });

  const exportAll = () => void run("Rendering PNGs…", async (current, pages) => {
    for (const [index, page] of pages.entries()) {
      setProgress(`PNG ${index + 1}/${pages.length}`);
      const image = await renderPageImage(page, current, { scale: 2, format: "png" });
      download(image, `${fileStem(current.title)}-${index + 1}.png`);
      if (index < pages.length - 1) await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    }
  });

  const exportPdf = () => void run("Building PDF…", async (current, pages) => {
    const images = [];
    for (const [index, page] of pages.entries()) {
      setProgress(`PDF ${index + 1}/${pages.length}`);
      const data = await renderPageImage(page, current, { scale: 1.5, format: "jpeg" });
      images.push({ bytes: jpegBytes(data), pixelWidth: Math.round(current.width * 1.5), pixelHeight: Math.round(current.height * 1.5) });
    }
    const bytes = buildImagePdf(images);
    downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileStem(current.title)}.pdf`);
  });

  const exportPptx = () => void run("Building PowerPoint…", async (current, pages) => {
    const blob = await buildNativePptx(current, (done) => setProgress(`PowerPoint ${done}/${pages.length}`));
    downloadBlob(blob, `${fileStem(current.title)}.pptx`);
  });

  const copyLink = () => void run("Copying link…", async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  });

  const print = () => void run("Preparing print…", async (current) => { setPrintDeck(current); });

  const actions = [
    { label: "Current page · PNG", icon: FileImage, onClick: exportCurrent },
    { label: "All pages · PNG", icon: FileImage, onClick: exportAll },
    { label: "PDF", icon: FileText, onClick: exportPdf },
    { label: "PowerPoint", icon: Presentation, onClick: exportPptx },
    { label: "Print", icon: Printer, onClick: print },
    { label: "Copy link", icon: Clipboard, onClick: copyLink },
  ];

  return (
    <div ref={menuRef} className="relative flex min-w-0 items-center gap-2">
      <button type="button" disabled={!deck || busy} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="btn btn-secondary btn-sm inline-flex shrink-0 items-center gap-1.5"><Download size={16} />Export <ChevronDown size={13} /></button>
      {open && <div role="menu" aria-label="Export options" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-line bg-elevated p-1 shadow-lg">{actions.map(({ label, icon: Icon, onClick }) => <button key={label} type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-fg hover:bg-surface-2 focus-visible:bg-surface-2"><Icon size={16} className="text-fg-muted" />{label}</button>)}</div>}
      <span role="status" aria-live="polite" className="hidden max-w-40 truncate text-xs text-fg-muted sm:inline">{busy ? progress : copied ? <><Check size={12} className="mr-1 inline" />Copied</> : ""}</span>
      {error && <span role="alert" title={error} className="max-w-32 truncate text-xs text-danger sm:max-w-48">{error}</span>}
      {printDeck && <><style>{`@media print { body * { visibility: hidden !important; } .studio-print-root, .studio-print-root * { visibility: visible !important; } .studio-print-root { display: block !important; position: absolute; inset: 0; background: white; } .studio-print-page { break-after: page; page-break-after: always; } .studio-print-page:last-child { break-after: auto; page-break-after: auto; } }`}</style><div className="studio-print-root hidden">{printDeck.pages.filter((page) => !page.hidden).map((page) => <div key={page.id} className="studio-print-page"><ScenePreview page={page} deck={printDeck} width={printDeck.width} /></div>)}</div></>}
    </div>
  );
}
