export interface JpegPage {
  bytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

const encoder = new TextEncoder();

export function buildImagePdf(pages: readonly JpegPage[]): Uint8Array {
  if (!pages.length) throw new Error("Choose at least one page to export.");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (bytes: Uint8Array) => { chunks.push(bytes); length += bytes.length; };
  const ascii = (value: string) => write(encoder.encode(value));
  const object = (id: number) => { offsets[id] = length; ascii(`${id} 0 obj\n`); };

  ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds: number[] = [];

  pages.forEach((page, index) => {
    if (!page.bytes.length || !Number.isFinite(page.pixelWidth) || !Number.isFinite(page.pixelHeight) || page.pixelWidth <= 0 || page.pixelHeight <= 0) {
      throw new Error(`Page ${index + 1} has no valid JPEG image.`);
    }
    if (page.bytes[0] !== 0xff || page.bytes[1] !== 0xd8 || page.bytes[page.bytes.length - 2] !== 0xff || page.bytes[page.bytes.length - 1] !== 0xd9) {
      throw new Error(`Page ${index + 1} is not a complete JPEG image.`);
    }

    const imageId = 3 + index * 3;
    const contentId = imageId + 1;
    const pageId = imageId + 2;
    pageIds.push(pageId);
    const pixelWidth = Math.round(page.pixelWidth);
    const pixelHeight = Math.round(page.pixelHeight);
    const scale = Math.min(1, 960 / Math.max(pixelWidth, pixelHeight));
    const width = +(pixelWidth * scale).toFixed(3);
    const height = +(pixelHeight * scale).toFixed(3);

    object(imageId);
    ascii(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
    write(page.bytes);
    ascii("\nendstream\nendobj\n");

    const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
    object(contentId);
    ascii(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

    object(pageId);
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
  });

  object(2);
  ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`);
  object(1);
  ascii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const xrefOffset = length;
  const objectCount = 3 + pages.length * 3;
  ascii(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let id = 1; id < objectCount; id += 1) {
    ascii(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  ascii(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const output = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return output;
}
