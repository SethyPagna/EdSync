const MAX_EXTRACTED_CHARS = 12_000;
const MAX_BINARY_FALLBACK_SCAN_BYTES = 256_000;
const BINARY_FALLBACK_SAMPLE_COUNT = 3;
const MIN_DIRECT_TEXT_CHARS = 200;
const MEDIUM_QUALITY_TEXT_CHARS = 500;
const HIGH_QUALITY_TEXT_CHARS = 1_200;
const UNSAFE_CHARACTER_PATTERN = /[^\x09\x0a\x0d\x20-\x7e]/g;
const REPEATED_INLINE_SPACE_PATTERN = /[ \t]{2,}/g;
const REPEATED_BLANK_LINE_PATTERN = /\n{3,}/g;

type ByteRange = {
  start: number;
  end: number;
};

export type ExtractionQuality = "none" | "low" | "medium" | "high";

export type BinaryFallbackExtraction = {
  text: string;
  method: "binary-readable-sample";
  quality: ExtractionQuality;
  sampled: boolean;
  scannedBytes: number;
  totalBytes: number;
  readableChars: number;
  ranges: ByteRange[];
};

export function normalizeExtractedText(value: string) {
  return value
    .replace(UNSAFE_CHARACTER_PATTERN, " ")
    .replace(REPEATED_INLINE_SPACE_PATTERN, " ")
    .replace(REPEATED_BLANK_LINE_PATTERN, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function readableAscii(byte: number) {
  return byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)
    ? String.fromCharCode(byte)
    : " ";
}

function mergeRanges(ranges: ByteRange[]) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start);

  return sorted.reduce<ByteRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      return merged;
    }

    previous.end = Math.max(previous.end, range.end);
    return merged;
  }, []);
}

export function binaryFallbackSampleRanges(byteLength: number) {
  if (byteLength <= MAX_BINARY_FALLBACK_SCAN_BYTES) {
    return byteLength > 0 ? [{ start: 0, end: byteLength }] : [];
  }

  const bytesPerSample = Math.floor(MAX_BINARY_FALLBACK_SCAN_BYTES / BINARY_FALLBACK_SAMPLE_COUNT);
  const middleStart = Math.floor(byteLength / 2 - bytesPerSample / 2);
  const starts = [0, middleStart, byteLength - bytesPerSample];

  return mergeRanges(
    starts.map((start) => {
      const safeStart = Math.max(0, Math.min(start, byteLength - bytesPerSample));
      return {
        start: safeStart,
        end: Math.min(byteLength, safeStart + bytesPerSample),
      };
    }),
  );
}

function readReadableAsciiRange(buffer: ArrayBuffer, range: ByteRange) {
  const bytes = new Uint8Array(buffer, range.start, range.end - range.start);
  const chars = new Array<string>(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    chars[index] = readableAscii(bytes[index]);
  }

  return chars.join("");
}

function inferTopicFromFileName(fileName: string) {
  return fileName.replace(/\.(pdf|docx?|txt|md|csv)$/i, "").replace(/[-_]/g, " ");
}

function extractionQuality(readableChars: number, sampled: boolean): ExtractionQuality {
  if (readableChars <= MIN_DIRECT_TEXT_CHARS) return "none";
  if (readableChars >= HIGH_QUALITY_TEXT_CHARS && !sampled) return "high";
  if (readableChars >= MEDIUM_QUALITY_TEXT_CHARS) return "medium";
  return "low";
}

export function extractReadableBinaryFallback(
  buffer: ArrayBuffer,
  fileName: string,
): BinaryFallbackExtraction {
  const ranges = binaryFallbackSampleRanges(buffer.byteLength);
  const scannedBytes = ranges.reduce((total, range) => total + range.end - range.start, 0);
  const raw = ranges.map((range) => readReadableAsciiRange(buffer, range)).join("\n\n");
  const readable = normalizeExtractedText(raw);
  const sampled = scannedBytes < buffer.byteLength;
  const topic = inferTopicFromFileName(fileName);
  const quality = extractionQuality(readable.length, sampled);
  const text = quality !== "none"
    ? `Document: "${fileName}"\n\nExtracted readable text${sampled ? " (sampled safely across the file)" : ""}:\n${readable}`
    : `Document: "${fileName}"\nTopic: ${topic}\n\nThe file did not contain enough directly extractable text. Generate a structured lesson around the inferred topic and ask the teacher to review details before publishing.`;

  return {
    text,
    method: "binary-readable-sample",
    quality,
    sampled,
    scannedBytes,
    totalBytes: buffer.byteLength,
    readableChars: readable.length,
    ranges,
  };
}

export function readableBinaryFallback(buffer: ArrayBuffer, fileName: string) {
  return extractReadableBinaryFallback(buffer, fileName).text;
}
