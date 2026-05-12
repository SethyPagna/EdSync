import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

const MAX_FILE_BYTES = 2_500_000;
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
      { error: "File is too large. Use a file under 2.5 MB or paste the key text." },
      { status: 413 },
    );
  }

  const buffer = await file.arrayBuffer();
  const isTextLike =
    file.type.startsWith("text/") ||
    /\.(txt|md|csv)$/i.test(file.name);

  if (isTextLike) {
    const text = normalizeText(new TextDecoder("utf-8").decode(buffer));
    return NextResponse.json({
      text: `Document: "${file.name}"\n\n${text}`,
      fileName: file.name,
      warning: text.length === 0 ? "No readable text was found." : null,
    });
  }

  const text = readableBinaryFallback(buffer, file.name);
  return NextResponse.json({
    text,
    fileName: file.name,
    warning:
      "PDF and Word extraction uses a safe readable-text fallback in this deployment. Review generated lessons before publishing.",
  });
}
