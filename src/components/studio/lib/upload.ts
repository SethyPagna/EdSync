export async function uploadStudioImage(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  }

  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      width = image.naturalWidth;
      height = image.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  if (!width || !height) throw new Error("The image could not be read.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension = extension && ["png", "jpg", "jpeg", "webp", "gif"].includes(extension) ? extension : "png";
  const form = new FormData();
  form.set("file", file);
  form.set("bucket", "studio");
  form.set("path", `${crypto.randomUUID()}.${safeExtension}`);
  const response = await fetch("/api/storage/upload", { method: "POST", body: form, credentials: "include" });
  const payload = await response.json().catch(() => null) as { data?: { publicUrl?: string }; error?: { message?: string } | string } | null;
  if (!response.ok || !payload?.data?.publicUrl) {
    const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    throw new Error(message || "Image upload failed.");
  }
  return { url: payload.data.publicUrl, width, height };
}
