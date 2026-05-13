export type ParsedPackage = {
  packageType: "scorm_1_2" | "scorm_2004" | "xapi" | "cmi5";
  title: string;
  launchPath: string | null;
  manifest: Record<string, unknown>;
};

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() ?? null;
}

export function parseStandardsManifest(input: { fileName: string; manifestText: string }): ParsedPackage {
  const text = input.manifestText;
  const title = firstMatch(text, /<title[^>]*>([^<]+)<\/title>/i) || input.fileName.replace(/\.[^.]+$/, "");
  const launchPath =
    firstMatch(text, /href=["']([^"']+\.(?:html?|xhtml))["']/i) ||
    firstMatch(text, /launchParameters[^>]*>([^<]+)<\/launchParameters>/i);
  const lower = text.toLowerCase();
  const packageType =
    lower.includes("cmi5") ? "cmi5" : lower.includes("tincan") || lower.includes("xapi")
      ? "xapi"
      : lower.includes("2004")
        ? "scorm_2004"
        : "scorm_1_2";

  return {
    packageType,
    title,
    launchPath,
    manifest: {
      source: input.fileName,
      title,
      launchPath,
      detectedAt: new Date().toISOString(),
    },
  };
}
