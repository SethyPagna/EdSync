import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, exit } from "node:process";

const sourcePath = join(cwd(), "src", "lib", "content", "extraction.ts");
const source = readFileSync(sourcePath, "utf8");

function readConstant(name) {
  const match = source.match(new RegExp(`const ${name} = ([0-9_,]+);`));
  if (!match) {
    throw new Error(`Missing ${name} in extraction helper.`);
  }
  return Number(match[1].replaceAll("_", ""));
}

const maxScanBytes = readConstant("MAX_BINARY_FALLBACK_SCAN_BYTES");
const sampleCount = readConstant("BINARY_FALLBACK_SAMPLE_COUNT");

function mergeRanges(ranges) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start);

  return sorted.reduce((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      return merged;
    }

    previous.end = Math.max(previous.end, range.end);
    return merged;
  }, []);
}

function sampleRanges(byteLength) {
  if (byteLength <= maxScanBytes) {
    return byteLength > 0 ? [{ start: 0, end: byteLength }] : [];
  }

  const bytesPerSample = Math.floor(maxScanBytes / sampleCount);
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

function scannedBytes(ranges) {
  return ranges.reduce((total, range) => total + range.end - range.start, 0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  for (const byteLength of [0, 1, 12_000, maxScanBytes, maxScanBytes + 1, 10_000_000]) {
    const ranges = sampleRanges(byteLength);
    const scanned = scannedBytes(ranges);
    assert(scanned <= maxScanBytes, `${byteLength} scanned ${scanned}, over budget ${maxScanBytes}.`);
    assert(ranges.every((range) => range.start >= 0 && range.end <= byteLength), `${byteLength} has out-of-bounds range.`);
  }

  const largeRanges = sampleRanges(10_000_000);
  assert(largeRanges.length === sampleCount, "Large files should sample head, middle, and tail.");
  assert(largeRanges[0].start === 0, "Large files should include a head sample.");
  assert(largeRanges[largeRanges.length - 1].end === 10_000_000, "Large files should include a tail sample.");

  console.log(`Extraction bounds ok: maxScanBytes=${maxScanBytes}, sampleCount=${sampleCount}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exit(1);
}
