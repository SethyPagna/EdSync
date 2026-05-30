import { statSync, readFileSync } from "node:fs";
import path from "node:path";
import { listTrackedFiles } from "../shared/git";

type AssetReference = {
  file: string;
  assetPath: string;
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

const missingAssets: AssetReference[] = [];
const undersizedAssets: Array<AssetReference & { bytes: number; minimumBytes: number }> = [];

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
  } catch {
    missingAssets.push(reference);
  }
}

if (missingAssets.length > 0 || undersizedAssets.length > 0) {
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
  process.exit(1);
}

console.log("Referenced public assets exist and have usable sizes.");
