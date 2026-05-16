const ALLOWED_EMBED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
]);

const ALLOWED_PUBLIC_MEDIA_PROTOCOLS = new Set(["https:"]);
const BLOCKED_PUBLIC_FILE_EXTENSIONS = new Set([
  "apk",
  "app",
  "bat",
  "bin",
  "cmd",
  "com",
  "dll",
  "dmg",
  "exe",
  "hta",
  "jar",
  "js",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
  "vbs",
  "wsf",
]);

export type SafeMediaUrl = {
  url: string;
  kind: "image" | "video" | "link";
  embedUrl: string | null;
  provider: "youtube" | "vimeo" | "direct" | "link";
};

function hostAllowed(hostname: string) {
  return ALLOWED_EMBED_HOSTS.has(hostname.toLowerCase());
}

function pathExtension(pathname: string) {
  const fileName = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  return fileName.includes(".") ? extension : "";
}

function hasBlockedExtension(url: URL) {
  const extension = pathExtension(url.pathname);
  return extension ? BLOCKED_PUBLIC_FILE_EXTENSIONS.has(extension) : false;
}

function youtubeEmbed(url: URL) {
  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }

  if (url.hostname.endsWith("youtube.com")) {
    if (url.pathname.startsWith("/embed/")) return url.toString();
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }

  return null;
}

function vimeoEmbed(url: URL) {
  if (url.hostname === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
    return url.toString();
  }
  if (url.hostname.endsWith("vimeo.com")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export function safePublicUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED_PUBLIC_MEDIA_PROTOCOLS.has(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (hasBlockedExtension(url)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function safeVideoEmbedUrl(value?: string | null) {
  const safe = safePublicUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (!hostAllowed(url.hostname)) return null;
  return youtubeEmbed(url) || vimeoEmbed(url);
}

export function classifySafeMediaUrl(value?: string | null): SafeMediaUrl | null {
  const safe = safePublicUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const path = url.pathname.toLowerCase();
  const embedUrl = safeVideoEmbedUrl(safe);

  if (embedUrl) {
    return {
      url: safe,
      kind: "video",
      embedUrl,
      provider: embedUrl.includes("youtube.com") ? "youtube" : "vimeo",
    };
  }

  if (/\.(png|jpe?g|webp|gif)$/.test(path)) {
    return { url: safe, kind: "image", embedUrl: null, provider: "direct" };
  }

  if (/\.(mp4|webm|mov)$/.test(path)) {
    return { url: safe, kind: "video", embedUrl: null, provider: "direct" };
  }

  return { url: safe, kind: "link", embedUrl: null, provider: "link" };
}

export function safeCatalogImageUrl(value?: string | null) {
  const media = classifySafeMediaUrl(value);
  return media?.kind === "image" ? media.url : null;
}

export function safeImageUrl(value?: string | null) {
  return safeCatalogImageUrl(value);
}

export function safeCatalogVideoUrl(value?: string | null) {
  const media = classifySafeMediaUrl(value);
  return media?.kind === "video" ? media.url : null;
}

export function sanitizeCatalogMetadata(metadata: Record<string, unknown> | null | undefined) {
  const source = metadata ?? {};
  const visibility = source.visibility === "public" || source.visibility === "portal" ? source.visibility : "private";
  const enrollmentMode = source.enrollmentMode === "paid" ? "paid" : source.enrollmentMode === "free" ? "free" : "closed";
  const thumbnailUrl = safeCatalogImageUrl(typeof source.thumbnailUrl === "string" ? source.thumbnailUrl : null);
  const previewVideoUrl = safeCatalogVideoUrl(typeof source.previewVideoUrl === "string" ? source.previewVideoUrl : null);
  const previewEmbedUrl = safeVideoEmbedUrl(previewVideoUrl);

  return {
    visibility,
    enrollmentMode,
    featured: Boolean(source.featured),
    category: typeof source.category === "string" ? source.category.slice(0, 80) : "",
    language: typeof source.language === "string" ? source.language.slice(0, 40) : "English",
    difficulty: typeof source.difficulty === "string" ? source.difficulty.slice(0, 40) : "",
    previewSummary: typeof source.previewSummary === "string" ? source.previewSummary.slice(0, 600) : "",
    thumbnailUrl,
    previewVideoUrl,
    previewEmbedUrl,
  };
}
