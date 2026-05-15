import { describe, expect, it } from "vitest";
import {
  normalizeStandardsLaunchPath,
  normalizeStandardsStatus,
  STANDARDS_TITLE_MAX_LENGTH,
  validateStandardsFileName,
  validateStandardsManifestText,
  validateStandardsTitle,
} from "@/lib/standards-validation";

describe("standards validation", () => {
  it("validates title and status boundaries", () => {
    expect(validateStandardsTitle("  Safety Course  ")).toBe("Safety Course");
    expect(() => validateStandardsTitle("")).toThrow("required");
    expect(() => validateStandardsTitle("x".repeat(STANDARDS_TITLE_MAX_LENGTH + 1))).toThrow("characters");
    expect(normalizeStandardsStatus("archived")).toBe("archived");
    expect(normalizeStandardsStatus("deleted")).toBe("parsed");
  });

  it("accepts safe manifest filenames and launch paths", () => {
    expect(validateStandardsFileName("imsmanifest.xml")).toBe("imsmanifest.xml");
    expect(validateStandardsFileName("tincan.json")).toBe("tincan.json");
    expect(normalizeStandardsLaunchPath("launch/index.html")).toBe("launch/index.html");
    expect(normalizeStandardsLaunchPath("")).toBeNull();
    expect(() => validateStandardsFileName("../imsmanifest.xml")).toThrow("safe");
    expect(() => normalizeStandardsLaunchPath("/absolute/index.html")).toThrow("safe");
  });

  it("rejects unsafe or oversized manifest text", () => {
    expect(validateStandardsManifestText("<manifest><title>Ok</title></manifest>")).toContain("manifest");
    expect(() => validateStandardsManifestText("plain text")).toThrow("does not look");
    expect(() => validateStandardsManifestText("<script>alert(1)</script>")).toThrow("script");
    expect(() => validateStandardsManifestText(`<manifest>${"x".repeat(1_100_000)}</manifest>`)).toThrow("too large");
  });
});
