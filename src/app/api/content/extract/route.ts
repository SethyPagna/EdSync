import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { extractReadableBinaryFallback, normalizeExtractedText } from "@/lib/content/extraction";
import { d1Query } from "@/lib/db/d1";
import { scanUploadBuffer } from "@/lib/security/malware";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";
import { validateUploadFile } from "@/lib/security/upload";

function fileKind(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) return "text";
  if (/\.pdf$/i.test(file.name) || file.type.includes("pdf")) return "pdf";
  if (/\.docx?$/i.test(file.name) || file.type.includes("word")) return "word";
  return "document";
}

function mediaPrompt(file: File, kind: string) {
  const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  if (kind === "image") {
    return `Image: "${file.name}"\nTopic inferred from file name: ${title}\n\nCreate a visual analysis lesson. Ask students to observe, describe evidence, infer meaning, and connect the image to the learning objective. Include an image section placeholder and a teacher review note.`;
  }
  if (kind === "video" || kind === "audio") {
    return `${kind === "video" ? "Video" : "Audio"}: "${file.name}"\nTopic inferred from file name: ${title}\n\nCreate a media-based lesson with a preview question, active viewing/listening checkpoints, discussion prompts, vocabulary, and a final reflection. Include timestamps as placeholders for the teacher to edit.`;
  }
  return "";
}

async function saveExtraction(input: {
  userId: string;
  file: File;
  kind: string;
  text: string;
  warning: string | null;
  metadata?: Record<string, unknown>;
}) {
  await d1Query(
    `INSERT INTO content_extractions (
       id, user_id, file_name, content_type, size_bytes, extraction_kind,
       extracted_text, warning, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      input.userId,
      input.file.name,
      input.file.type || null,
      input.file.size,
      input.kind,
      input.text,
      input.warning,
      JSON.stringify({
        lastModified: input.file.lastModified || null,
        ...input.metadata,
      }),
    ],
  );
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await enforceRateLimit({
    request,
    scope: "content_extract",
    limit: 30,
    windowSeconds: 600,
    userId: user.id,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many extraction requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  let safeFile;
  try {
    safeFile = await validateUploadFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "File blocked.";
    await logSecurityEvent({
      request,
      userId: user.id,
      eventType: "content_extract_blocked",
      severity: "warning",
      message,
      metadata: { fileName: file.name, contentType: file.type, size: file.size },
    });
    return NextResponse.json(
      { error: message },
      { status: message.includes("25MB") ? 413 : 415 },
    );
  }

  const buffer = await file.arrayBuffer();
  const malwareScan = await scanUploadBuffer({
    buffer: Buffer.from(buffer),
    fileName: safeFile.fileName,
    contentType: safeFile.contentType,
  });
  if (malwareScan.status === "failed") {
    await logSecurityEvent({
      request,
      userId: user.id,
      eventType: "malware_extract_blocked",
      severity: "critical",
      message: "Content extraction blocked by malware scan.",
      metadata: {
        fileName: safeFile.fileName,
        contentType: safeFile.contentType,
        size: file.size,
        scan: malwareScan,
      },
    });
    return NextResponse.json(
      { error: "Extraction blocked because the file looks unsafe." },
      { status: 422 },
    );
  }

  const kind = safeFile.assetType === "document" ? fileKind(file) : safeFile.assetType;
  const mediaText = mediaPrompt(file, kind);
  if (mediaText) {
    const warning = "Media files are stored as lesson context. Add captions, timestamps, or alt text before publishing.";
    await saveExtraction({ userId: user.id, file, kind, text: mediaText, warning });
    return NextResponse.json({
      text: mediaText,
      fileName: file.name,
      kind,
      warning,
    });
  }

  const isTextLike =
    file.type.startsWith("text/") ||
    /\.(txt|md|csv)$/i.test(file.name);

  if (isTextLike) {
    const text = normalizeExtractedText(new TextDecoder("utf-8").decode(buffer));
    const responseText = `Document: "${file.name}"\n\n${text}`;
    await saveExtraction({
      userId: user.id,
      file,
      kind,
      text: responseText,
      warning: text.length === 0 ? "No readable text was found." : null,
    });
    return NextResponse.json({
      text: responseText,
      fileName: file.name,
      kind,
      warning: text.length === 0 ? "No readable text was found." : null,
    });
  }

  const extraction = extractReadableBinaryFallback(buffer, file.name);
  const warning =
    extraction.quality === "none"
      ? "No reliable text was found. Use the generated outline as a starting point and review carefully before publishing."
      : "PDF and Word extraction uses a safe sampled-text fallback in this deployment. Review generated lessons before publishing.";
  await saveExtraction({
    userId: user.id,
    file,
    kind,
    text: extraction.text,
    warning,
    metadata: {
      extraction: {
        method: extraction.method,
        quality: extraction.quality,
        sampled: extraction.sampled,
        scannedBytes: extraction.scannedBytes,
        totalBytes: extraction.totalBytes,
        readableChars: extraction.readableChars,
        ranges: extraction.ranges,
      },
    },
  });
  return NextResponse.json({
    text: extraction.text,
    fileName: file.name,
    kind,
    warning,
    extraction: {
      method: extraction.method,
      quality: extraction.quality,
      sampled: extraction.sampled,
      scannedBytes: extraction.scannedBytes,
      totalBytes: extraction.totalBytes,
      readableChars: extraction.readableChars,
    },
  });
}
