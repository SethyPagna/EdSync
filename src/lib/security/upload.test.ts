import { describe, expect, it } from "vitest";
import {
  UPLOAD_OBJECT_PATH_MAX_LENGTH,
  UPLOAD_OBJECT_PATH_MAX_SEGMENTS,
  sanitizeFileName,
  sanitizeObjectPath,
  validateObjectPath,
  validateUploadFile,
} from "@/lib/security/upload";

function fileFromBytes(name: string, type: string, bytes: number[]) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("upload security", () => {
  it("sanitizes file names and object paths", () => {
    expect(sanitizeFileName("../My Course!!.png")).toBe("My-Course.png");
    expect(sanitizeObjectPath("../avatars/ My Photo!!.png")).toBe("avatars/My-Photo.png");
    expect(validateObjectPath("../avatars/ My Photo!!.png")).toBe("avatars/My-Photo.png");
    expect(() => validateObjectPath("")).toThrow("required");
    const overlongPath = Array.from({ length: 5 }, (_, index) => `${index}-${"x".repeat(119)}`).join("/");
    expect(overlongPath.length).toBeGreaterThan(UPLOAD_OBJECT_PATH_MAX_LENGTH);
    expect(() => validateObjectPath(overlongPath)).toThrow("characters");
    expect(() => validateObjectPath(Array.from({ length: UPLOAD_OBJECT_PATH_MAX_SEGMENTS + 1 }, (_, index) => `part-${index}`).join("/"))).toThrow(
      "segments",
    );
  });

  it("accepts image uploads when MIME and signature match", async () => {
    const file = fileFromBytes("cover.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x00]);
    await expect(validateUploadFile(file)).resolves.toMatchObject({
      assetType: "image",
      contentType: "image/png",
      extension: "png",
    });
  });

  it("blocks active markup and SVG uploads", async () => {
    const html = new File(["<script>alert(1)</script>"], "notes.txt", { type: "text/html" });
    await expect(validateUploadFile(html)).rejects.toThrow("content type");

    const svg = new File(["<svg><script>alert(1)</script></svg>"], "diagram.svg", { type: "image/svg+xml" });
    await expect(validateUploadFile(svg)).rejects.toThrow("not allowed");
  });

  it("blocks mismatched MIME and extension pairs", async () => {
    const disguised = fileFromBytes("cover.png", "text/plain", [0x89, 0x50, 0x4e, 0x47, 0x00]);
    await expect(validateUploadFile(disguised)).rejects.toThrow("do not match");
  });

  it("blocks executable signatures even with a safe extension", async () => {
    const executable = fileFromBytes("malware.txt", "text/plain", [0x4d, 0x5a, 0x90, 0x00]);
    await expect(validateUploadFile(executable)).rejects.toThrow("Executable");
  });
});
