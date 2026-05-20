import type {
  LessonSlideAnimation,
  LessonSlideKind,
  LessonSlideLayout,
  LessonSlideTransition,
} from "@/lib/studio/catalog";
import type { DesignBlock, DesignTemplate } from "@/types";

export type StudioSlideSummary = {
  id: string;
  title: string;
  notes: string;
  accent: string;
  body?: string;
  kind?: LessonSlideKind;
  layout?: LessonSlideLayout;
  themeId?: string;
  transition?: LessonSlideTransition;
  transitionDurationMs?: number;
  animation?: LessonSlideAnimation;
  animationDurationMs?: number;
};

const CSV_NEEDS_QUOTING = /[",\r\n]/;

export type StudioHtmlInsert = {
  html: string;
  plainText: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatList(items: readonly string[]) {
  if (items.length === 0) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function createTextBlockInsert(label: string): StudioHtmlInsert {
  return {
    html: `<hr><section data-edsync-insert="text-block"><h2>${escapeHtml(label)}</h2><p>Add details, examples, and checks for understanding.</p></section>`,
    plainText: label,
  };
}

export function createDesignTemplateInsert(template: DesignTemplate): StudioHtmlInsert {
  const blocks = formatList(template.blocks);
  const tags = template.tags.length > 0 ? `<p><strong>Tags:</strong> ${escapeHtml(template.tags.join(", "))}</p>` : "";
  return {
    html: [
      `<hr><section data-edsync-design-template="${escapeHtml(template.id)}">`,
      `<h2>${escapeHtml(template.title)}</h2>`,
      `<p>${escapeHtml(template.description)}</p>`,
      `<p><strong>Use for:</strong> ${escapeHtml(template.category.replaceAll("_", " "))}</p>`,
      `<p><strong>Tone:</strong> ${escapeHtml(template.previewTone)}</p>`,
      tags,
      blocks ? `<h3>Reusable blocks</h3>${blocks}` : "",
      "</section>",
    ].join(""),
    plainText: `${template.title}\n${template.description}`,
  };
}

export function createDesignBlockInsert(block: DesignBlock): StudioHtmlInsert {
  const content = Object.entries(block.content)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</li>`)
    .join("");
  return {
    html: [
      `<hr><section data-edsync-design-block="${escapeHtml(block.id)}">`,
      `<h2>${escapeHtml(block.title)}</h2>`,
      `<p>${escapeHtml(block.description)}</p>`,
      `<p><strong>Target:</strong> ${escapeHtml(block.insertTarget.replaceAll("_", " "))} · <strong>Estimated:</strong> ${block.estimatedMinutes} min</p>`,
      content ? `<h3>Editable structure</h3><ul>${content}</ul>` : "",
      "</section>",
    ].join(""),
    plainText: `${block.title}\n${block.description}`,
  };
}

export function createEmptySheetRow(columnCount: number) {
  return Array.from({ length: Math.max(columnCount, 1) }, () => "");
}

export function addSheetRow(sheet: string[][], afterIndex = sheet.length - 1) {
  const columnCount = Math.max(...sheet.map((row) => row.length), 1);
  const nextSheet = sheet.map((row) => [...row]);
  const insertAt = Math.min(Math.max(afterIndex + 1, 0), nextSheet.length);
  nextSheet.splice(insertAt, 0, createEmptySheetRow(columnCount));
  return nextSheet;
}

export function addSheetColumn(sheet: string[][], afterIndex = -1) {
  const maxColumnCount = Math.max(...sheet.map((row) => row.length), 1);
  const insertAt = Math.min(Math.max(afterIndex + 1, 0), maxColumnCount);

  return sheet.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < maxColumnCount) nextRow.push("");
    nextRow.splice(insertAt, 0, "");
    return nextRow;
  });
}

export function deleteSheetRow(sheet: string[][], rowIndex: number) {
  if (sheet.length <= 1) return sheet.map((row) => [...row]);
  return sheet.filter((_, index) => index !== rowIndex).map((row) => [...row]);
}

export function deleteSheetColumn(sheet: string[][], columnIndex: number) {
  const maxColumnCount = Math.max(...sheet.map((row) => row.length), 1);
  if (maxColumnCount <= 1) return sheet.map((row) => [...row]);

  return sheet.map((row) => row.filter((_, index) => index !== columnIndex));
}

export function updateSheetCell(
  sheet: string[][],
  rowIndex: number,
  columnIndex: number,
  value: string,
) {
  return sheet.map((row, currentRow) =>
    currentRow === rowIndex
      ? row.map((cell, currentColumn) => (currentColumn === columnIndex ? value : cell))
      : [...row],
  );
}

export function sheetToCsv(sheet: string[][]) {
  return sheet
    .map((row) =>
      row
        .map((cell) => {
          if (!CSV_NEEDS_QUOTING.test(cell)) return cell;
          return `"${cell.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}

export function csvToSheet(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell);
  rows.push(row);

  return rows.length > 0 && rows.some((currentRow) => currentRow.some(Boolean)) ? rows : [[""]];
}

export function createSlide(slides: StudioSlideSummary[], accent: string) {
  return {
    id: `slide-${Date.now()}-${slides.length + 1}`,
    title: "New Slide",
    body: "Add the main teaching point, prompt, or media note.",
    notes: "Add speaker notes or teaching guidance.",
    accent,
    kind: "content" as const,
    layout: "content" as const,
    transition: "fade" as const,
    transitionDurationMs: 450,
    animation: "rise" as const,
    animationDurationMs: 480,
  };
}

export function normalizeStudioSlide(slide: StudioSlideSummary): StudioSlideSummary {
  return {
    ...slide,
    body: slide.body ?? "",
    kind: slide.kind ?? "content",
    layout: slide.layout ?? "content",
    transition: slide.transition ?? "fade",
    transitionDurationMs: slide.transitionDurationMs ?? 450,
    animation: slide.animation ?? "rise",
    animationDurationMs: slide.animationDurationMs ?? 480,
  };
}

export function updateSlide(
  slides: StudioSlideSummary[],
  slideId: string,
  patch: Partial<StudioSlideSummary>,
) {
  return slides.map((slide) =>
    slide.id === slideId ? normalizeStudioSlide({ ...slide, ...patch }) : { ...slide },
  );
}

export function applySlideTheme(
  slides: StudioSlideSummary[],
  theme: { id: string; colors: { primary: string } },
) {
  return slides.map((slide) =>
    normalizeStudioSlide({
      ...slide,
      accent: theme.colors.primary,
      themeId: theme.id,
    }),
  );
}

export function duplicateSlide(slides: StudioSlideSummary[], slideId: string) {
  const slideIndex = slides.findIndex((slide) => slide.id === slideId);
  if (slideIndex === -1) return slides.map((slide) => ({ ...slide }));

  const sourceSlide = slides[slideIndex];
  const duplicate = {
    ...sourceSlide,
    id: `${sourceSlide.id}-copy-${Date.now()}`,
    title: `${sourceSlide.title} copy`,
  };
  const nextSlides = slides.map((slide) => ({ ...slide }));
  nextSlides.splice(slideIndex + 1, 0, duplicate);
  return nextSlides;
}

export function deleteSlide(slides: StudioSlideSummary[], slideId: string) {
  if (slides.length <= 1) return slides.map((slide) => ({ ...slide }));
  return slides.filter((slide) => slide.id !== slideId).map((slide) => ({ ...slide }));
}

export function moveSlide(slides: StudioSlideSummary[], slideId: string, direction: "up" | "down") {
  const currentIndex = slides.findIndex((slide) => slide.id === slideId);
  if (currentIndex === -1) return slides.map((slide) => ({ ...slide }));

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= slides.length) return slides.map((slide) => ({ ...slide }));

  const nextSlides = slides.map((slide) => ({ ...slide }));
  const [slide] = nextSlides.splice(currentIndex, 1);
  nextSlides.splice(nextIndex, 0, slide);
  return nextSlides;
}
