import { describe, expect, it } from "vitest";
import {
  safeCatalogImageUrl,
  safeCatalogVideoUrl,
  safePublicUrl,
  safeVideoEmbedUrl,
  sanitizeCatalogMetadata,
} from "@/lib/security/media";

describe("catalog media security", () => {
  it("allows only HTTPS image URLs for catalog thumbnails", () => {
    expect(safeCatalogImageUrl("https://cdn.example.com/course-cover.webp")).toBe(
      "https://cdn.example.com/course-cover.webp",
    );
    expect(safeCatalogImageUrl("http://cdn.example.com/course-cover.webp")).toBeNull();
    expect(safeCatalogImageUrl("https://cdn.example.com/course-cover.svg")).toBeNull();
    expect(safeCatalogImageUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks credentialed and executable public links", () => {
    expect(safePublicUrl("https://user:pass@example.com/file.png")).toBeNull();
    expect(safePublicUrl("https://cdn.example.com/installer.exe")).toBeNull();
    expect(safePublicUrl("https://cdn.example.com/script.js")).toBeNull();
    expect(safePublicUrl("https://cdn.example.com/document.pdf")).toBe("https://cdn.example.com/document.pdf");
  });

  it("allows direct video files and approved video embeds for previews", () => {
    expect(safeCatalogVideoUrl("https://cdn.example.com/preview.mp4")).toBe(
      "https://cdn.example.com/preview.mp4",
    );
    expect(safeCatalogVideoUrl("https://youtu.be/abc123")).toBe("https://youtu.be/abc123");
    expect(safeCatalogVideoUrl("https://evil.example.com/watch")).toBeNull();
  });

  it("normalizes YouTube and Vimeo embed URLs", () => {
    expect(safeVideoEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
    expect(safeVideoEmbedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
  });

  it("sanitizes catalog metadata without leaking unsafe media", () => {
    const metadata = sanitizeCatalogMetadata({
      visibility: "public",
      enrollmentMode: "free",
      thumbnailUrl: "https://cdn.example.com/file.html",
      previewVideoUrl: "https://evil.example.com/watch",
      category: "Math",
      language: "English",
      difficulty: "Beginner",
    });

    expect(metadata.visibility).toBe("public");
    expect(metadata.enrollmentMode).toBe("free");
    expect(metadata.thumbnailUrl).toBeNull();
    expect(metadata.previewVideoUrl).toBeNull();
    expect(metadata.previewEmbedUrl).toBeNull();
  });
});
