const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_OBJECT_PATH_MAX_LENGTH = 512;
export const UPLOAD_OBJECT_PATH_MAX_SEGMENTS = 12;

const ALLOWED_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp4",
  "mov",
  "webm",
  "mp3",
  "wav",
]);

const BLOCKED_EXTENSIONS = new Set([
  "app",
  "bat",
  "bin",
  "cmd",
  "com",
  "cpl",
  "dll",
  "dmg",
  "exe",
  "hta",
  "html",
  "iso",
  "jar",
  "js",
  "jsx",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
  "ts",
  "tsx",
  "vbs",
  "wsf",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
  "",
]);
const BLOCKED_MIME_TYPES = new Set([
  "application/javascript",
  "application/x-msdownload",
  "application/x-sh",
  "image/svg+xml",
  "text/html",
  "text/javascript",
  "text/xml",
]);

const EXTENSION_MIME_FAMILIES: Record<string, string[]> = {
  csv: ["text/", "application/octet-stream"],
  doc: ["application/msword", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  gif: ["image/gif", "application/octet-stream"],
  jpeg: ["image/jpeg", "application/octet-stream"],
  jpg: ["image/jpeg", "application/octet-stream"],
  json: ["application/json", "text/", "application/octet-stream"],
  md: ["text/", "application/octet-stream"],
  mov: ["video/quicktime", "video/", "application/octet-stream"],
  mp3: ["audio/mpeg", "audio/", "application/octet-stream"],
  mp4: ["video/mp4", "video/", "application/octet-stream"],
  pdf: ["application/pdf", "application/octet-stream"],
  ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  png: ["image/png", "application/octet-stream"],
  txt: ["text/", "application/octet-stream", ""],
  wav: ["audio/wav", "audio/x-wav", "audio/", "application/octet-stream"],
  webm: ["video/webm", "video/", "application/octet-stream"],
  webp: ["image/webp", "application/octet-stream"],
};

export type SafeUpload = {
  fileName: string;
  extension: string;
  assetType: "image" | "video" | "audio" | "document" | "other";
  contentType: string;
};

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, value: string) {
  const haystack = new TextDecoder("latin1").decode(bytes.slice(0, 4096)).toLowerCase();
  return haystack.includes(value.toLowerCase());
}

function inferAssetType(contentType: string, extension: string): SafeUpload["assetType"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (
    contentType.startsWith("text/") ||
    contentType.includes("pdf") ||
    contentType.includes("document") ||
    contentType.includes("presentation") ||
    ["txt", "md", "csv", "json", "pdf", "ppt", "pptx", "doc", "docx"].includes(extension)
  ) {
    return "document";
  }
  return "other";
}

function hasAllowedSignature(extension: string, bytes: Uint8Array) {
  if (bytes.length === 0) return false;
  if (["txt", "md", "csv", "json"].includes(extension)) return true;
  if (extension === "pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
  if (["docx", "pptx"].includes(extension)) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (extension === "ppt") return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (["jpg", "jpeg"].includes(extension)) return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === "gif") return containsAscii(bytes, "GIF87a") || containsAscii(bytes, "GIF89a");
  if (extension === "webp") return containsAscii(bytes, "RIFF") && containsAscii(bytes, "WEBP");
  if (["mp4", "mov"].includes(extension)) return containsAscii(bytes, "ftyp");
  if (extension === "webm") return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (extension === "mp3") return startsWith(bytes, [0x49, 0x44, 0x33]) || startsWith(bytes, [0xff, 0xfb]);
  if (extension === "wav") return containsAscii(bytes, "RIFF") && containsAscii(bytes, "WAVE");
  if (extension === "doc") return true;
  return false;
}

function mimeMatchesExtension(extension: string, contentType: string) {
  const allowed = EXTENSION_MIME_FAMILIES[extension] ?? [];
  return allowed.some((entry) => (entry.endsWith("/") ? contentType.startsWith(entry) : contentType === entry));
}

export function sanitizeFileName(name: string) {
  const fallback = "upload";
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function sanitizeObjectPath(path: string) {
  return path
    .split("/")
    .filter((part) => {
      const trimmed = part.trim();
      return trimmed && trimmed !== "." && trimmed !== "..";
    })
    .map((part) => sanitizeFileName(part))
    .filter(Boolean)
    .join("/")
    .replace(/^\/+/, "");
}

export function validateObjectPath(value: unknown, label = "Object path") {
  const path = sanitizeObjectPath(String(value ?? ""));
  if (!path) throw new Error(`${label} is required.`);
  if (path.length > UPLOAD_OBJECT_PATH_MAX_LENGTH) {
    throw new Error(`${label} must be ${UPLOAD_OBJECT_PATH_MAX_LENGTH} characters or fewer.`);
  }
  if (path.split("/").length > UPLOAD_OBJECT_PATH_MAX_SEGMENTS) {
    throw new Error(`${label} must have ${UPLOAD_OBJECT_PATH_MAX_SEGMENTS} segments or fewer.`);
  }
  return path;
}

export async function validateUploadFile(file: File): Promise<SafeUpload> {
  const fileName = sanitizeFileName(file.name);
  const extension = extensionOf(fileName);
  const contentType = (file.type || "application/octet-stream").toLowerCase();

  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files must be 25MB or smaller.");
  if (!extension || BLOCKED_EXTENSIONS.has(extension) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("This file type is not allowed.");
  }
  const allowedMime =
    ALLOWED_MIME_TYPES.has(contentType) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
  if (!allowedMime) throw new Error("This content type is not allowed.");
  if (BLOCKED_MIME_TYPES.has(contentType)) throw new Error("This content type is not allowed.");
  if (!mimeMatchesExtension(extension, contentType)) {
    throw new Error("File extension and content type do not match.");
  }

  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const executable =
    startsWith(bytes, [0x4d, 0x5a]) ||
    startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
    startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe]);
  if (executable) throw new Error("Executable uploads are blocked.");
  if (!hasAllowedSignature(extension, bytes)) {
    throw new Error("File content does not match an allowed upload type.");
  }

  return {
    fileName,
    extension,
    contentType,
    assetType: inferAssetType(contentType, extension),
  };
}
