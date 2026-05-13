import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { d1Query } from "@/lib/db/d1";

const MAX_FILE_BYTES = 25_000_000;
const MAX_EXTRACTED_CHARS = 12_000;

function normalizeText(value: string) {
  return value
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function readableBinaryFallback(buffer: ArrayBuffer, fileName: string) {
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    raw += byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)
      ? String.fromCharCode(byte)
      : " ";
  }

  const readable = normalizeText(raw);
  const topic = fileName.replace(/\.(pdf|docx?|txt|md|csv)$/i, "").replace(/[-_]/g, " ");

  return readable.length > 200
    ? `Document: "${fileName}"\n\nExtracted readable text:\n${readable}`
    : `Document: "${fileName}"\nTopic: ${topic}\n\nThe file did not contain enough directly extractable text. Generate a structured lesson around the inferred topic and ask the teacher to review details before publishing.`;
}

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
      JSON.stringify({ lastModified: input.file.lastModified || null }),
    ],
  );
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Use a file under 25 MB or paste the key text." },
      { status: 413 },
    );
  }

  const buffer = await file.arrayBuffer();
  const kind = fileKind(file);
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
    const text = normalizeText(new TextDecoder("utf-8").decode(buffer));
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

  const text = readableBinaryFallback(buffer, file.name);
  const warning =
    "PDF and Word extraction uses a safe readable-text fallback in this deployment. Review generated lessons before publishing.";
  await saveExtraction({ userId: user.id, file, kind, text, warning });
  return NextResponse.json({
    text,
    fileName: file.name,
    kind,
    warning,
  });
}
