"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Upload } from "lucide-react";
import { uploadStudioImage } from "../lib/upload";
import { useStudio } from "../store";
import { PanelEmpty, PanelSection } from "./parts/PanelControls";
import { centeredBox, insertElements, newElementId, writeElementDrag } from "./parts/insertion";

type UploadItem = { url: string; name: string; width: number; height: number };
const storageKey = (userId: string) => `edsync-studio-uploads:${userId}`;

function validUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch { return false; }
}

function readItems(userId: string): UploadItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is UploadItem => typeof item === "object" && item !== null && "url" in item && typeof item.url === "string" && validUrl(item.url) && "name" in item && typeof item.name === "string" && "width" in item && typeof item.width === "number" && "height" in item && typeof item.height === "number").slice(0, 100) : [];
  } catch { return []; }
}

export default function UploadsPanel() {
  const deck = useStudio((state) => state.deck);
  const activePageId = useStudio((state) => state.activePageId);
  const selectionIds = useStudio((state) => state.selectionIds);
  const updateElement = useStudio((state) => state.updateElement);
  const input = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [sessionError, setSessionError] = useState("");
  const page = deck?.pages.find((entry) => entry.id === activePageId);
  const selected = page?.elements.find((element) => element.id === selectionIds[0]);
  const image = selected?.kind === "image" ? selected : null;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { credentials: "include" }).then(async (response) => {
      const payload = await response.json() as { data?: { user?: { id?: string } | null } };
      if (!response.ok || !payload.data?.user?.id) throw new Error("Sign in to use uploads.");
      if (!cancelled) { setUserId(payload.data.user.id); setItems(readItems(payload.data.user.id)); }
    }).catch((cause) => { if (!cancelled) setSessionError(cause instanceof Error ? cause.message : "Uploads are unavailable."); });
    return () => { cancelled = true; };
  }, []);

  const remember = (added: UploadItem[]) => {
    if (!userId || !added.length) return;
    const next = [...added, ...items.filter((item) => !added.some((entry) => entry.url === item.url))].slice(0, 100);
    setItems(next);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(next)); } catch {}
  };

  const insertImage = (item: UploadItem) => {
    if (!deck) return;
    if (image) { updateElement(image.id, { src: item.url, placeholder: false }); return; }
    insertElements([{ id: newElementId(), kind: "image", role: "media", src: item.url, fit: "cover", ...centeredBox(deck, 0.58, item.width / Math.max(1, item.height)) }]);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length || !userId) return;
    setBusy(true);
    setErrors([]);
    const saved: UploadItem[] = [];
    const failures: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(`${index + 1} of ${files.length}`);
      try {
        const result = await uploadStudioImage(file);
        saved.push({ url: result.url, name: file.name, width: result.width, height: result.height });
      } catch (cause) { failures.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`); }
    }
    remember(saved);
    if (saved.length === 1 && files.length === 1) insertImage(saved[0]);
    setErrors(failures);
    setProgress("");
    setBusy(false);
  };

  const addFromUrl = async () => {
    if (!validUrl(imageUrl)) { setErrors(["Enter a valid HTTP or HTTPS image URL."]); return; }
    setBusy(true);
    setErrors([]);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Image could not be fetched.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
      if (blob.size > 25 * 1024 * 1024) throw new Error("Images must be 25 MB or smaller.");
      const name = new URL(imageUrl, window.location.origin).pathname.split("/").pop() || "image.png";
      const result = await uploadStudioImage(new File([blob], name, { type: blob.type }));
      const item = { url: result.url, name, width: result.width, height: result.height };
      remember([item]);
      insertImage(item);
      setImageUrl("");
    } catch (cause) { setErrors([cause instanceof Error ? cause.message : "Image URL could not be added."]); }
    finally { setBusy(false); }
  };

  return <div role="tabpanel" aria-label="Uploads" className="pb-4">
    <div className="p-3"><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><button type="button" onClick={() => input.current?.click()} disabled={busy || !userId} className="btn btn-primary w-full"><Upload size={16} /> {busy ? `Uploading ${progress}` : "Upload images"}</button></div>
    <div className="px-3"><label className="block text-xs font-medium text-fg">Image URL</label><div className="mt-1 flex gap-1"><input type="url" className="input min-w-0 flex-1" aria-label="Image URL" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /><button type="button" className="btn btn-secondary btn-sm" onClick={() => void addFromUrl()} disabled={busy || !userId || !imageUrl.trim()} aria-label="Add image from URL"><Link2 size={16} /></button></div></div>
    {sessionError && <p role="alert" className="px-3 pt-2 text-xs text-danger">{sessionError}</p>}
    {errors.map((error, index) => <p key={index} role="alert" className="px-3 pt-2 text-xs text-danger">{error}</p>)}
    <PanelSection title={image ? "Replace selected image" : "Your images"} />
    {items.length ? <div className="grid grid-cols-3 gap-2 px-3">{items.map((item) => <button key={item.url} type="button" draggable onClick={() => insertImage(item)} onDragStart={(event) => { if (deck) writeElementDrag(event, [{ id: newElementId(), kind: "image", role: "media", src: item.url, fit: "cover", ...centeredBox(deck, 0.58, item.width / Math.max(1, item.height)) }]); }} aria-label={`${image ? "Replace selected image with" : "Add"} ${item.name}`} title={item.name} className="min-w-0 overflow-hidden rounded-lg border border-line bg-elevated text-left hover:border-accent"><span className="block aspect-square bg-surface-2 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(item.url)})` }} /><span className="block truncate px-1 py-1 text-[11px] text-fg">{item.name}</span></button>)}</div> : <PanelEmpty><ImagePlus size={18} className="mx-auto mb-1" /> Your uploads appear here.</PanelEmpty>}
  </div>;
}
