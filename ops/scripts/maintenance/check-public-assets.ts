import { statSync, readFileSync } from "node:fs";
import path from "node:path";
import { listTrackedFiles } from "../shared/git";

type AssetReference = {
  file: string;
  assetPath: string;
};

type ImageDimensions = {
  height: number;
  width: number;
};

type ImageMetadata = ImageDimensions & {
  mimeType: string;
};

const sourceExtensions = new Set([
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".webmanifest",
]);

const publicAssetPattern = /\/(?:showcase\/[A-Za-z0-9._/-]+\.(?:gif|jpe?g|png|svg|webp)|favicon\.svg|manifest\.webmanifest)\b/g;
const minimumAssetBytes = new Map([
  ["/favicon.svg", 100],
  ["/manifest.webmanifest", 100],
]);
const minimumShowcaseImageBytes = 10_000;
const minimumShowcaseImageDimensions: ImageDimensions = {
  height: 600,
  width: 1_000,
};
const expectedMimeTypesByExtension = new Map([
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function readTextFile(file: string) {
  return readFileSync(file, "utf8");
}

function isScannable(file: string) {
  return sourceExtensions.has(path.extname(file));
}

function collectReferencedPublicAssets() {
  const references: AssetReference[] = [];

  for (const file of listTrackedFiles().filter(isScannable)) {
    const text = readTextFile(file);
    for (const match of text.matchAll(publicAssetPattern)) {
      references.push({ file, assetPath: match[0] });
    }
  }

  return references.sort((left, right) => `${left.assetPath}:${left.file}`.localeCompare(`${right.assetPath}:${right.file}`));
}

function assetFilePath(assetPath: string) {
  return path.join(process.cwd(), "public", assetPath.replace(/^\//, ""));
}

function hasSignature(bytes: Buffer, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function readPngDimensions(bytes: Buffer): ImageMetadata | null {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
  if (bytes.length < 24 || !hasSignature(bytes, pngSignature)) return null;

  return {
    height: bytes.readUInt32BE(20),
    mimeType: "image/png",
    width: bytes.readUInt32BE(16),
  };
}

function isJpegStartOfFrame(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readJpegDimensions(bytes: Buffer): ImageMetadata | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    while (bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;

    if (isJpegStartOfFrame(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        mimeType: "image/jpeg",
        width: bytes.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return {
    height: 0,
    mimeType: "image/jpeg",
    width: 0,
  };
}

function readImageMetadata(filePath: string) {
  const bytes = readFileSync(filePath);
  const pngMetadata = readPngDimensions(bytes);
  if (pngMetadata) return pngMetadata;

  const jpegMetadata = readJpegDimensions(bytes);
  if (jpegMetadata) return jpegMetadata;

  if (hasSignature(bytes, [0x47, 0x49, 0x46])) {
    return { height: 0, mimeType: "image/gif", width: 0 };
  }

  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return { height: 0, mimeType: "image/webp", width: 0 };
  }

  if (path.extname(filePath).toLowerCase() === ".svg") {
    return { height: 0, mimeType: "image/svg+xml", width: 0 };
  }

  return null;
}

const missingAssets: AssetReference[] = [];
const undersizedAssets: Array<AssetReference & { bytes: number; minimumBytes: number }> = [];
const mismatchedImageTypes: Array<AssetReference & { actualMimeType: string; expectedMimeType: string }> = [];
const undersizedShowcaseImages: Array<AssetReference & ImageDimensions> = [];
const unreadableImages: AssetReference[] = [];

for (const reference of collectReferencedPublicAssets()) {
  const filePath = assetFilePath(reference.assetPath);
  try {
    const stats = statSync(filePath);
    const minimumBytes = reference.assetPath.startsWith("/showcase/")
      ? minimumShowcaseImageBytes
      : (minimumAssetBytes.get(reference.assetPath) ?? 1);

    if (stats.size < minimumBytes) {
      undersizedAssets.push({ ...reference, bytes: stats.size, minimumBytes });
    }

    const expectedMimeType = expectedMimeTypesByExtension.get(path.extname(reference.assetPath).toLowerCase());
    if (expectedMimeType) {
      const metadata = readImageMetadata(filePath);
      if (!metadata) {
        unreadableImages.push(reference);
        continue;
      }

      if (metadata.mimeType !== expectedMimeType) {
        mismatchedImageTypes.push({ ...reference, actualMimeType: metadata.mimeType, expectedMimeType });
      }

      if (
        reference.assetPath.startsWith("/showcase/") &&
        metadata.width > 0 &&
        metadata.height > 0 &&
        (metadata.width < minimumShowcaseImageDimensions.width || metadata.height < minimumShowcaseImageDimensions.height)
      ) {
        undersizedShowcaseImages.push({ ...reference, height: metadata.height, width: metadata.width });
      }
    }
  } catch {
    missingAssets.push(reference);
  }
}

if (
  missingAssets.length > 0 ||
  undersizedAssets.length > 0 ||
  mismatchedImageTypes.length > 0 ||
  undersizedShowcaseImages.length > 0 ||
  unreadableImages.length > 0
) {
  if (missingAssets.length > 0) {
    console.error("Referenced public assets are missing:");
    for (const reference of missingAssets) {
      console.error(`- ${reference.assetPath} referenced by ${reference.file}`);
    }
  }
  if (undersizedAssets.length > 0) {
    console.error("Referenced public assets are unexpectedly small:");
    for (const reference of undersizedAssets) {
      console.error(`- ${reference.assetPath} referenced by ${reference.file}: ${reference.bytes} bytes, expected at least ${reference.minimumBytes}`);
    }
  }
  if (mismatchedImageTypes.length > 0) {
    console.error("Referenced image extensions do not match their file content:");
    for (const reference of mismatchedImageTypes) {
      console.error(`- ${reference.assetPath} referenced by ${reference.file}: ${reference.actualMimeType}, expected ${reference.expectedMimeType}`);
    }
  }
  if (undersizedShowcaseImages.length > 0) {
    console.error("Referenced showcase images are too small for clear product screenshots:");
    for (const reference of undersizedShowcaseImages) {
      console.error(`- ${reference.assetPath} referenced by ${reference.file}: ${reference.width}x${reference.height}, expected at least ${minimumShowcaseImageDimensions.width}x${minimumShowcaseImageDimensions.height}`);
    }
  }
  if (unreadableImages.length > 0) {
    console.error("Referenced images could not be identified from file content:");
    for (const reference of unreadableImages) {
      console.error(`- ${reference.assetPath} referenced by ${reference.file}`);
    }
  }
  process.exit(1);
}

console.log("Referenced public assets exist, match their extensions, and have usable sizes.");
