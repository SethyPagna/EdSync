type PptxConstructor = typeof import("pptxgenjs").default;

const BUNDLE_URL = "/vendor/pptxgen-4.0.1.bundle.js";
let loading: Promise<PptxConstructor> | null = null;

function loadedConstructor(): PptxConstructor | null {
  const host = globalThis as typeof globalThis & { PptxGenJS?: PptxConstructor };
  return typeof host.PptxGenJS === "function" ? host.PptxGenJS : null;
}

export function loadBrowserPptx(): Promise<PptxConstructor> {
  const existing = loadedConstructor();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  if (typeof document === "undefined") return Promise.reject(new Error("PowerPoint export requires a browser."));

  loading = new Promise<PptxConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = BUNDLE_URL;
    script.async = true;
    script.onload = () => {
      const constructor = loadedConstructor();
      if (constructor) resolve(constructor);
      else {
        script.remove();
        reject(new Error("PowerPoint export did not initialize. Please retry."));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("PowerPoint export could not be loaded. Check your connection and retry."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
