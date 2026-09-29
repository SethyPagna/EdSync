// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBrowserPptx } from "./pptx-browser";

afterEach(() => {
  document.querySelectorAll('script[src*="pptxgen-4.0.1.bundle.js"]').forEach((script) => script.remove());
  vi.unstubAllGlobals();
  delete (window as Window & { PptxGenJS?: unknown }).PptxGenJS;
  delete (window as Window & { JSZip?: unknown }).JSZip;
});

describe("PowerPoint browser loader", () => {
  it("ships the licensed local browser bundle", () => {
    const bundle = join(process.cwd(), "public", "vendor", "pptxgen-4.0.1.bundle.js");
    const license = join(process.cwd(), "public", "vendor", "PptxGenJS-LICENSE.txt");
    expect(existsSync(bundle)).toBe(true);
    expect(existsSync(license)).toBe(true);
    expect(readFileSync(bundle, "utf8").slice(0, 80)).toContain("PptxGenJS 4.0.1");
  });

  it("initializes the real browser bundle as a script", () => {
    const bundle = readFileSync(join(process.cwd(), "public", "vendor", "pptxgen-4.0.1.bundle.js"), "utf8");
    window.eval(bundle);
    expect(typeof (window as Window & { PptxGenJS?: unknown }).PptxGenJS).toBe("function");
  });

  it("loads once, reports errors, then retries successfully", async () => {
    const first = loadBrowserPptx();
    const same = loadBrowserPptx();
    expect(same).toBe(first);
    const script = document.querySelector<HTMLScriptElement>('script[src*="pptxgen-4.0.1.bundle.js"]');
    expect(script?.src).toContain("/vendor/pptxgen-4.0.1.bundle.js");
    script?.dispatchEvent(new Event("error"));
    await expect(first).rejects.toThrow("could not be loaded");
    await expect(same).rejects.toThrow("could not be loaded");
    expect(document.querySelector('script[src*="pptxgen-4.0.1.bundle.js"]')).toBeNull();

    const second = loadBrowserPptx();
    const replacement = document.querySelector<HTMLScriptElement>('script[src*="pptxgen-4.0.1.bundle.js"]');
    const constructor = class FakePptx {} as unknown as typeof import("pptxgenjs").default;
    vi.stubGlobal("PptxGenJS", constructor);
    replacement?.dispatchEvent(new Event("load"));
    await expect(second).resolves.toBe(constructor);
    await expect(loadBrowserPptx()).resolves.toBe(constructor);
    expect(document.querySelectorAll('script[src*="pptxgen-4.0.1.bundle.js"]')).toHaveLength(1);
  });
});
