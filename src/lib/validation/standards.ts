export const STANDARDS_TITLE_MAX_LENGTH = 180;
export const STANDARDS_MANIFEST_MAX_BYTES = 1_000_000;
export const STANDARDS_LAUNCH_PATH_MAX_LENGTH = 500;

const STANDARDS_STATUSES = new Set(["uploaded", "parsed", "error", "archived"]);
const DANGEROUS_PATH_PATTERN = /(^\/|\\|(?:^|\/)\.\.(?:\/|$)|[<>:"|?*]|[\x00-\x1F\x7F])/;

export type StandardsPackageStatus = "uploaded" | "parsed" | "error" | "archived";

export function validateStandardsTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Package title is required.");
  if (title.length > STANDARDS_TITLE_MAX_LENGTH) {
    throw new Error(`Package title must be ${STANDARDS_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function normalizeStandardsStatus(value: unknown): StandardsPackageStatus {
  const status = String(value ?? "parsed").trim();
  return STANDARDS_STATUSES.has(status) ? (status as StandardsPackageStatus) : "parsed";
}

export function validateStandardsFileName(value: unknown) {
  const fileName = String(value ?? "").trim();
  if (!fileName) throw new Error("Manifest file name is required.");
  if (DANGEROUS_PATH_PATTERN.test(fileName)) throw new Error("Manifest file name must be a safe relative file name.");
  if (!/\.(xml|json)$/i.test(fileName)) throw new Error("Manifest file must be XML or JSON.");
  return fileName;
}

export function validateStandardsManifestText(value: unknown) {
  const manifestText = String(value ?? "").trim();
  if (!manifestText) throw new Error("Manifest text is required.");

  const byteLength = new TextEncoder().encode(manifestText).length;
  if (byteLength > STANDARDS_MANIFEST_MAX_BYTES) {
    throw new Error("Manifest is too large. Upload a smaller standards package manifest.");
  }

  if (!/[<{]/.test(manifestText)) throw new Error("Manifest text does not look like XML or JSON.");
  if (/<script[\s>]/i.test(manifestText)) throw new Error("Manifest cannot include script tags.");
  return manifestText;
}

export function normalizeStandardsLaunchPath(value: unknown) {
  const launchPath = String(value ?? "").trim();
  if (!launchPath) return null;
  if (launchPath.length > STANDARDS_LAUNCH_PATH_MAX_LENGTH) {
    throw new Error(`Launch path must be ${STANDARDS_LAUNCH_PATH_MAX_LENGTH} characters or fewer.`);
  }
  if (DANGEROUS_PATH_PATTERN.test(launchPath)) throw new Error("Launch path must be a safe relative path.");
  return launchPath;
}
