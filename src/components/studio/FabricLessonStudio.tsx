"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";
import { listStudioItems, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  FileText,
  Copy,
  Download,
  FileJson,
  Home,
  Image as ImageIcon,
  LayoutPanelLeft,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Presentation,
  Trash2,
  Triangle,
  Type,
  type LucideIcon,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";

type FabricModule = typeof import("fabric");
type StudioPanel = "design" | "elements" | "text" | "images" | "pages" | "ai" | "export";
type StudioLanguage = "en" | "es" | "fr";
type StudioView = "hub" | "formats" | "editor";
type StudioFormatKind = "doc" | "slide" | "design";
type AiLessonStyle = "direct" | "socratic" | "professional" | "expert";
type AiLessonType = "lesson" | "slides" | "quiz" | "discussion" | "activity";
type AiLessonFocus = "flow" | "quiz" | "discussion" | "slides" | "activity";
type CanvasSnapshot = Record<string, unknown>;
type PageSeed = {
  title: string;
  body: string;
  accent: string;
};
type StudioPage = {
  id: string;
  name: string;
  seed: PageSeed;
  snapshot: CanvasSnapshot | null;
  previewDataUrl?: string;
};
type InspectorObject = FabricObject & {
  fill?: string;
  stroke?: string;
  fontSize?: number;
  text?: string;
};
type StudioProject = {
  id: string;
  title: string;
  kind: StudioFormatKind;
  templateId: string;
  width: number;
  height: number;
  classId: string;
  className: string;
  orderIndex: number;
  serverItemId: string | null;
  status: "draft" | "published" | "archived";
  updatedAt?: string;
};
type PageMenuPlacement = {
  pageId: string;
  left: number;
  top: number;
};
type StudioTemplate = {
  id: string;
  kind: StudioFormatKind;
  label: string;
  size: string;
  width: number;
  height: number;
  title: string;
  body: string;
  accent: string;
};
type FabricSelection = FabricObject & {
  forEachObject(callback: (object: FabricObject) => void): void;
};
type StudioRosterClass = {
  id: string;
  name: string;
  subject?: string | null;
  grade_level?: string | null;
};
type ContentExtractionResponse = {
  text?: string;
  fileName?: string;
  kind?: string;
  warning?: string | null;
  error?: string;
};
type AiLessonSlide = {
  slideNumber: number;
  title: string;
  type: "title" | "objectives" | "content" | "example" | "socratic" | "activity" | "summary" | "assessment";
  onScreenText: string[];
  speakerNotes: string;
  visualSuggestion: string;
  navigation: {
    previous: string | null;
    next: string | null;
  };
};

const DEFAULT_CANVAS_WIDTH = 960;
const DEFAULT_CANVAS_HEIGHT = 540;
const STORAGE_KEY = "edsync.canva.lesson.studio.v1";
const DEFAULT_ACCENT = "#2458dc";
const STUDIO_IMPORT_ACCEPT = "application/json,.json,image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv";
const PAGE_MENU_WIDTH = 224;
const PAGE_MENU_HEIGHT = 260;
const PAGE_MENU_MARGIN = 12;
const AI_FOCUS_OPTIONS = [
  ["flow", "Flow", "warmup, concept, practice loop, proof check"],
  ["quiz", "Quiz", "game-style checks, feedback, review cards"],
  ["discussion", "Discuss", "prompts, roles, rubrics, participation checks"],
  ["slides", "PPT", "visual slide structure and speaker notes"],
  ["activity", "Activity", "interactive tasks, Kahoot-style rounds, reflection"],
] satisfies Array<[AiLessonFocus, string, string]>;
const STUDIO_FORMATS = [
  {
    id: "doc",
    label: "Docs",
    description: "Handouts, worksheets, guides, and A4/Letter course documents.",
    icon: FileText,
  },
  {
    id: "slide",
    label: "PPT",
    description: "Slide decks, workshops, and lesson presentations.",
    icon: Presentation,
  },
  {
    id: "design",
    label: "Design",
    description: "Course covers, social assets, and visual learning boards.",
    icon: SlidersHorizontal,
  },
] satisfies Array<{ id: StudioFormatKind; label: string; description: string; icon: typeof FileText }>;

const STUDIO_TEMPLATES = [
  {
    id: "doc-a4",
    kind: "doc",
    label: "A4 doc",
    size: "794 x 1123",
    width: 794,
    height: 1123,
    title: "Learning guide",
    body: "Build a printable course page with examples, prompts, and proof of progress.",
    accent: "#2458dc",
  },
  {
    id: "doc-letter",
    kind: "doc",
    label: "Letter doc",
    size: "816 x 1056",
    width: 816,
    height: 1056,
    title: "Course worksheet",
    body: "Create a clean handout for independent learners or organization cohorts.",
    accent: "#0f9f82",
  },
  {
    id: "doc-a4-landscape",
    kind: "doc",
    label: "A4 landscape",
    size: "1123 x 794",
    width: 1123,
    height: 794,
    title: "Landscape guide",
    body: "Build a wide worksheet, comparison chart, or visual learning map.",
    accent: "#2458dc",
  },
  {
    id: "doc-legal",
    kind: "doc",
    label: "Legal doc",
    size: "816 x 1344",
    width: 816,
    height: 1344,
    title: "Extended guide",
    body: "Create a longer independent-learning packet with practice and reflection.",
    accent: "#0f9f82",
  },
  {
    id: "ppt-wide",
    kind: "slide",
    label: "PPT 16:9",
    size: "1280 x 720",
    width: 1280,
    height: 720,
    title: "Course presentation",
    body: "Design a slide deck for teaching, practice, and review.",
    accent: "#2458dc",
  },
  {
    id: "ppt-standard",
    kind: "slide",
    label: "PPT 4:3",
    size: "1024 x 768",
    width: 1024,
    height: 768,
    title: "Workshop deck",
    body: "Build a compact lesson deck with activities and progress checks.",
    accent: "#6d28d9",
  },
  {
    id: "ppt-vertical",
    kind: "slide",
    label: "PPT vertical",
    size: "720 x 1280",
    width: 720,
    height: 1280,
    title: "Vertical lesson",
    body: "Design a mobile-friendly micro lesson, story, or guided practice deck.",
    accent: "#2458dc",
  },
  {
    id: "ppt-ultrawide",
    kind: "slide",
    label: "PPT ultrawide",
    size: "1600 x 900",
    width: 1600,
    height: 900,
    title: "Workshop screen",
    body: "Create a high-resolution deck for live teaching or large displays.",
    accent: "#6d28d9",
  },
  {
    id: "design-cover",
    kind: "design",
    label: "Course cover",
    size: "1200 x 630",
    width: 1200,
    height: 630,
    title: "Course cover",
    body: "Create a public catalog cover or visual course summary.",
    accent: "#0f9f82",
  },
  {
    id: "design-square",
    kind: "design",
    label: "Square board",
    size: "1080 x 1080",
    width: 1080,
    height: 1080,
    title: "Practice board",
    body: "Design a reusable prompt, checklist, or learning visual.",
    accent: "#a15c07",
  },
  {
    id: "design-mobile",
    kind: "design",
    label: "Mobile card",
    size: "1080 x 1920",
    width: 1080,
    height: 1920,
    title: "Learning story",
    body: "Create a vertical learner update, recap, or mobile-first course visual.",
    accent: "#2458dc",
  },
] satisfies StudioTemplate[];

const copy = {
  en: {
    back: "Back",
    title: "Course Studio",
    subtitle: "Design lessons like a deck, course page, or printable handout.",
    select: "Select",
    design: "Design",
    elements: "Elements",
    text: "Text",
    images: "Images",
    pages: "Pages",
    ai: "AI lesson",
    export: "Export",
    undo: "Undo",
    redo: "Redo",
    save: "Save",
    publish: "Publish",
    addText: "Add text",
    heading: "Heading",
    body: "Body",
    note: "Note",
    square: "Square",
    circle: "Circle",
    triangle: "Triangle",
    image: "Image",
    upload: "Upload",
    delete: "Delete",
    duplicate: "Duplicate",
    addPage: "Add page",
    duplicatePage: "Duplicate",
    deletePage: "Delete",
    moveUp: "Up",
    moveDown: "Down",
    color: "Color",
    stroke: "Stroke",
    opacity: "Opacity",
    size: "Size",
    rotate: "Rotate",
    selected: "Selected",
    noSelection: "Select an object to edit it.",
    aiPrompt: "Ask AI for pages, activities, or a handout.",
    generate: "Generate",
    png: "PNG",
    pdf: "PDF",
    project: "Lesson",
    importProject: "Import",
    saved: "Saved locally",
  },
  es: {
    back: "Volver",
    title: "Estudio de curso",
    subtitle: "Disena lecciones como presentacion, pagina o material imprimible.",
    select: "Seleccionar",
    design: "Diseno",
    elements: "Elementos",
    text: "Texto",
    images: "Imagenes",
    pages: "Paginas",
    ai: "Leccion IA",
    export: "Exportar",
    undo: "Deshacer",
    redo: "Rehacer",
    save: "Guardar",
    publish: "Publicar",
    addText: "Agregar texto",
    heading: "Titulo",
    body: "Cuerpo",
    note: "Nota",
    square: "Cuadro",
    circle: "Circulo",
    triangle: "Triangulo",
    image: "Imagen",
    upload: "Subir",
    delete: "Borrar",
    duplicate: "Duplicar",
    addPage: "Agregar",
    duplicatePage: "Duplicar",
    deletePage: "Borrar",
    moveUp: "Arriba",
    moveDown: "Abajo",
    color: "Color",
    stroke: "Borde",
    opacity: "Opacidad",
    size: "Tamano",
    rotate: "Rotar",
    selected: "Seleccion",
    noSelection: "Selecciona un objeto para editarlo.",
    aiPrompt: "Pide a IA paginas, actividades o un material.",
    generate: "Generar",
    png: "PNG",
    pdf: "PDF",
    project: "Leccion",
    importProject: "Importar",
    saved: "Guardado local",
  },
  fr: {
    back: "Retour",
    title: "Studio de cours",
    subtitle: "Creez des lecons comme un diaporama, une page ou un support PDF.",
    select: "Selection",
    design: "Design",
    elements: "Elements",
    text: "Texte",
    images: "Images",
    pages: "Pages",
    ai: "Lecon IA",
    export: "Exporter",
    undo: "Annuler",
    redo: "Refaire",
    save: "Sauver",
    publish: "Publier",
    addText: "Texte",
    heading: "Titre",
    body: "Corps",
    note: "Note",
    square: "Carre",
    circle: "Cercle",
    triangle: "Triangle",
    image: "Image",
    upload: "Importer",
    delete: "Supprimer",
    duplicate: "Dupliquer",
    addPage: "Ajouter",
    duplicatePage: "Dupliquer",
    deletePage: "Supprimer",
    moveUp: "Monter",
    moveDown: "Descendre",
    color: "Couleur",
    stroke: "Contour",
    opacity: "Opacite",
    size: "Taille",
    rotate: "Rotation",
    selected: "Selection",
    noSelection: "Selectionnez un objet pour le modifier.",
    aiPrompt: "Demandez a l'IA des pages, activites ou supports.",
    generate: "Generer",
    png: "PNG",
    pdf: "PDF",
    project: "Lecon",
    importProject: "Importer",
    saved: "Sauve localement",
  },
} satisfies Record<StudioLanguage, Record<string, string>>;

function templateById(templateId: string | null | undefined) {
  return STUDIO_TEMPLATES.find((template) => template.id === templateId) ?? STUDIO_TEMPLATES[2];
}

function studioItemKind(item: StudioServerItem): StudioFormatKind {
  const originalKind = item.metadata?.originalKind;
  const kind = typeof originalKind === "string" ? originalKind : item.kind;
  return kind === "slide" || kind === "design" ? kind : "doc";
}

function isStudioPage(value: unknown): value is StudioPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<StudioPage>;
  return typeof page.id === "string" && typeof page.name === "string" && !!page.seed;
}

function readProjectPages(value: unknown) {
  if (!Array.isArray(value)) return null;
  const pages = value.filter(isStudioPage);
  return pages.length > 0 ? pages : null;
}

function initialPagesForTemplate(template: StudioTemplate, title = template.title): StudioPage[] {
  const supportTitle = template.kind === "slide" ? "Practice slide" : template.kind === "doc" ? "Practice page" : "Visual board";
  return [
    {
      id: crypto.randomUUID(),
      name: template.kind === "slide" ? "Cover slide" : "Cover",
      seed: {
        title,
        body: template.body,
        accent: template.accent,
      },
      snapshot: null,
    },
    {
      id: crypto.randomUUID(),
      name: supportTitle,
      seed: {
        title: supportTitle,
        body: "Add examples, activities, evidence prompts, and learner-friendly checkpoints.",
        accent: template.kind === "design" ? "#2458dc" : "#0f9f82",
      },
      snapshot: null,
    },
  ];
}

const initialPages = (): StudioPage[] => [
  {
    id: crypto.randomUUID(),
    name: "Cover",
    seed: {
      title: "Untitled course",
      body: "Drag text, shapes, and images onto this page.",
      accent: DEFAULT_ACCENT,
    },
    snapshot: null,
  },
  {
    id: crypto.randomUUID(),
    name: "Lesson",
    seed: {
      title: "Core idea",
      body: "Add explanation, examples, practice checks, and evidence.",
      accent: "#0f9f82",
    },
    snapshot: null,
  },
];

function downloadText(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cssColor(value: unknown, fallback = DEFAULT_ACCENT) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cleanSlideText(line: string) {
  return line.replace(/\*\*(.*?)\*\*/g, "$1").trim();
}

function formatUpdatedAt(value: string | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getPageMenuPlacement(rect: DOMRect) {
  const maxLeft = window.innerWidth - PAGE_MENU_WIDTH - PAGE_MENU_MARGIN;
  const preferredTop = rect.top - PAGE_MENU_HEIGHT - 8;
  const fallbackTop = rect.bottom + 8;
  const top = preferredTop >= PAGE_MENU_MARGIN ? preferredTop : Math.min(fallbackTop, window.innerHeight - PAGE_MENU_HEIGHT - PAGE_MENU_MARGIN);

  return {
    left: Math.max(PAGE_MENU_MARGIN, Math.min(rect.left + rect.width / 2 - PAGE_MENU_WIDTH / 2, maxLeft)),
    top: Math.max(PAGE_MENU_MARGIN, top),
  };
}

export default function FabricLessonStudio() {
  const searchParams = useSearchParams();
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const fabricRef = useRef<FabricModule | null>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const restoringRef = useRef(false);
  const activePageIdRef = useRef<string>("");
  const pagesRef = useRef<StudioPage[]>([]);
  const historyRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const openedItemIdRef = useRef<string | null>(null);
  const [view, setView] = useState<StudioView>("hub");
  const [projects, setProjects] = useState<StudioServerItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectKindFilter, setProjectKindFilter] = useState<StudioFormatKind | "all">("all");
  const [openPageMenu, setOpenPageMenu] = useState<PageMenuPlacement | null>(null);
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<StudioFormatKind>("slide");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [classes, setClasses] = useState<StudioRosterClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [lessonClassName, setLessonClassName] = useState("");
  const [lessonOrderIndex, setLessonOrderIndex] = useState(1);
  const [activeProject, setActiveProject] = useState<StudioProject | null>(null);
  const [pages, setPages] = useState<StudioPage[]>(initialPages);
  const [activePageId, setActivePageId] = useState("");
  const [panel, setPanel] = useState<StudioPanel>("elements");
  const [language, setLanguage] = useState<StudioLanguage>("en");
  const [selectedObject, setSelectedObject] = useState<InspectorObject | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [aiLessonName, setAiLessonName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiObjectives, setAiObjectives] = useState("");
  const [aiSources, setAiSources] = useState("");
  const [aiLessonType, setAiLessonType] = useState<AiLessonType>("lesson");
  const [aiFocuses, setAiFocuses] = useState<AiLessonFocus[]>(["flow", "quiz", "slides"]);
  const [aiStyle, setAiStyle] = useState<AiLessonStyle>("socratic");
  const [aiComplexity, setAiComplexity] = useState(55);
  const [aiVersions, setAiVersions] = useState(1);
  const [aiPageCount, setAiPageCount] = useState(6);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [savedStudioItemId, setSavedStudioItemId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<"draft" | "published" | null>(null);
  const t = copy[language];
  const canvasWidth = activeProject?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = activeProject?.height ?? DEFAULT_CANVAS_HEIGHT;
  const selectedTemplates = STUDIO_TEMPLATES.filter((template) => template.kind === selectedFormat);
  const selectedRosterClass = classes.find((classItem) => classItem.id === selectedClassId);
  const resolvedLessonClassName = selectedRosterClass?.name ?? lessonClassName.trim();
  const activeLessonOrderIndex = Math.max(1, Math.round(lessonOrderIndex || 1));
  const activeAiFocusDetails = AI_FOCUS_OPTIONS.filter(([id]) => aiFocuses.includes(id));
  const aiPromptPreview = [
    aiPrompt.trim() || "Build a complete EdSync learning experience.",
    aiLessonName.trim() ? `Lesson: ${aiLessonName.trim()}` : "",
    aiDescription.trim() ? `Description: ${aiDescription.trim()}` : "",
    aiObjectives.trim() ? `Objectives: ${aiObjectives.trim()}` : "",
    `Outputs: ${activeAiFocusDetails.map(([, label]) => label).join(", ") || "Flow"}.`,
    `Target length: ${Math.max(1, Math.round(aiPageCount || 1))} pages/sections.`,
    aiSources.trim() ? "Attached source context included." : "",
  ].filter(Boolean).join("\n");
  const requestedStudioItemId = searchParams.get("item");
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    return projects.filter((project) => {
      const kind = studioItemKind(project);
      const matchesKind = projectKindFilter === "all" || kind === projectKindFilter;
      const className = typeof project.metadata?.className === "string" ? project.metadata.className : "";
      const matchesQuery = !query || `${project.title} ${className}`.toLowerCase().includes(query);
      return matchesKind && matchesQuery;
    });
  }, [projectKindFilter, projectQuery, projects]);
  const projectCounts = useMemo(
    () => ({
      all: projects.length,
      doc: projects.filter((project) => studioItemKind(project) === "doc").length,
      slide: projects.filter((project) => studioItemKind(project) === "slide").length,
      design: projects.filter((project) => studioItemKind(project) === "design").length,
    }),
    [projects],
  );

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      setProjects(await listStudioItems(undefined, false));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load studio lessons.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const refreshClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/teacher/roster", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as {
        data?: { classes?: StudioRosterClass[] };
      } | null;
      if (!response.ok) return;
      setClasses(payload?.data?.classes ?? []);
    } catch {
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refreshProjects();
      void refreshClasses();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refreshClasses, refreshProjects]);

  const fitCanvasToStage = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = canvasStageRef.current;
    if (!canvas || !stage) return;
    const bounds = stage.getBoundingClientRect();
    const fitScale = Math.min(
      1,
      Math.max(0.28, (bounds.width - 24) / canvasWidth),
      Math.max(0.28, (bounds.height - 24) / canvasHeight),
    );
    const scale = Math.max(0.1, Math.min(5, fitScale * (zoomPercent / 100)));
    canvas.setDimensions({
      width: Math.round(canvasWidth * scale),
      height: Math.round(canvasHeight * scale),
    });
    canvas.setZoom(scale);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, [canvasHeight, canvasWidth, zoomPercent]);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [activePageId, pages],
  );

  const refreshHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const serializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toJSON() as CanvasSnapshot;
  }, []);

  const syncActivePage = useCallback(() => {
    const canvas = canvasRef.current;
    const snapshot = serializeCanvas();
    const pageId = activePageIdRef.current;
    if (!snapshot || !pageId) return;
    let previewDataUrl: string | undefined;
    try {
      previewDataUrl = canvas?.toDataURL({ format: "png", multiplier: 0.35 });
    } catch {
      previewDataUrl = undefined;
    }
    const updatePage = (page: StudioPage) =>
      page.id === pageId ? { ...page, snapshot, previewDataUrl: previewDataUrl ?? page.previewDataUrl } : page;
    pagesRef.current = pagesRef.current.map(updatePage);
    setPages((current) => current.map(updatePage));
  }, [serializeCanvas]);

  const pushHistory = useCallback(() => {
    if (restoringRef.current) return;
    const snapshot = serializeCanvas();
    if (!snapshot) return;
    const encoded = JSON.stringify(snapshot);
    const last = historyRef.current.at(-1);
    if (encoded !== last) {
      historyRef.current = [...historyRef.current.slice(-40), encoded];
      futureRef.current = [];
      refreshHistoryState();
      syncActivePage();
    }
  }, [refreshHistoryState, serializeCanvas, syncActivePage]);

  const updateSelectedObject = useCallback(() => {
    const canvas = canvasRef.current;
    setSelectedObject((canvas?.getActiveObject() as InspectorObject | undefined) ?? null);
  }, []);

  const drawSeed = useCallback(async (page: StudioPage) => {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!fabric || !canvas) return;
    const margin = Math.max(42, Math.round(canvasWidth * 0.055));
    const titleTop = Math.max(82, Math.round(canvasHeight * 0.16));
    const bodyTop = Math.min(canvasHeight - 180, titleTop + Math.max(112, Math.round(canvasHeight * 0.17)));
    const titleSize = Math.max(38, Math.min(72, Math.round(canvasWidth * 0.056)));
    const bodySize = Math.max(20, Math.min(30, Math.round(canvasWidth * 0.026)));
    const titleWidth = Math.round(canvasWidth * (canvasWidth > canvasHeight ? 0.62 : 0.82));
    const bodyWidth = Math.round(canvasWidth * (canvasWidth > canvasHeight ? 0.52 : 0.74));
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    const accent = page.seed.accent;
    canvas.add(
      new fabric.Rect({
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        fill: "#f7fbff",
        selectable: false,
        evented: false,
      }),
    );
    canvas.add(
      new fabric.Rect({
        left: margin,
        top: margin,
        width: Math.max(84, Math.round(canvasWidth * 0.1)),
        height: 10,
        rx: 5,
        ry: 5,
        fill: accent,
      }),
    );
    canvas.add(
      new fabric.Textbox(page.seed.title, {
        left: margin,
        top: titleTop,
        width: titleWidth,
        fontSize: titleSize,
        fontWeight: "800",
        fill: "#0d1726",
        fontFamily: "Instrument Sans",
      }),
    );
    canvas.add(
      new fabric.Textbox(page.seed.body, {
        left: margin,
        top: bodyTop,
        width: bodyWidth,
        fontSize: bodySize,
        lineHeight: 1.28,
        fill: "#526173",
        fontFamily: "Instrument Sans",
      }),
    );
    if (canvasWidth > 700) {
      canvas.add(
        new fabric.Circle({
          left: Math.max(margin, canvasWidth - margin - 180),
          top: Math.max(margin * 2, Math.round(canvasHeight * 0.28)),
          radius: Math.max(54, Math.min(116, Math.round(canvasWidth * 0.09))),
          fill: "rgba(36,88,220,0.16)",
          stroke: accent,
          strokeWidth: 2,
        }),
      );
    }
    canvas.renderAll();
  }, [canvasHeight, canvasWidth]);

  const loadPage = useCallback(
    async (page: StudioPage) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      restoringRef.current = true;
      canvas.discardActiveObject();
      if (page.snapshot) {
        canvas.clear();
        await Promise.resolve(canvas.loadFromJSON(page.snapshot));
        canvas.renderAll();
      } else {
        await drawSeed(page);
      }
      const encoded = JSON.stringify(canvas.toJSON());
      historyRef.current = [encoded];
      futureRef.current = [];
      restoringRef.current = false;
      updateSelectedObject();
      refreshHistoryState();
      syncActivePage();
    },
    [drawSeed, refreshHistoryState, syncActivePage, updateSelectedObject],
  );

  useEffect(() => {
    if (!activeProject) return undefined;
    let disposed = false;
    async function bootCanvas() {
      const fabric = await import("fabric");
      if (disposed || !canvasElementRef.current) return;
      canvasRef.current?.dispose();
      fabricRef.current = fabric;
      const canvas = new fabric.Canvas(canvasElementRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        preserveObjectStacking: true,
        backgroundColor: "#ffffff",
        selectionColor: "rgba(0,197,167,0.12)",
        selectionBorderColor: "#00c5a7",
      });
      fabric.FabricObject.ownDefaults = {
        ...fabric.FabricObject.ownDefaults,
        borderColor: "#00c5a7",
        borderDashArray: [6, 4],
        borderScaleFactor: 1.5,
        cornerColor: "#ffffff",
        cornerSize: 10,
        cornerStrokeColor: "#00c5a7",
        cornerStyle: "circle",
        transparentCorners: false,
      };
      canvasRef.current = canvas;
      const currentPages = pagesRef.current;
      const firstPageId = activePageIdRef.current || currentPages[0]?.id || "";
      activePageIdRef.current = firstPageId;
      setActivePageId(firstPageId);
      canvas.on("object:added", pushHistory);
      canvas.on("object:modified", pushHistory);
      canvas.on("object:removed", pushHistory);
      canvas.on("selection:created", updateSelectedObject);
      canvas.on("selection:updated", updateSelectedObject);
      canvas.on("selection:cleared", updateSelectedObject);
      canvas.on("mouse:up", (event) => {
        if (event.target) updateSelectedObject();
      });
      await loadPage(currentPages.find((page) => page.id === firstPageId) ?? currentPages[0]);
      fitCanvasToStage();
    }
    void bootCanvas();
    return () => {
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
  }, [activeProject, canvasHeight, canvasWidth, fitCanvasToStage, loadPage, pushHistory, updateSelectedObject]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const resizeObserver = new ResizeObserver(fitCanvasToStage);
    resizeObserver.observe(stage);
    window.addEventListener("resize", fitCanvasToStage);
    fitCanvasToStage();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitCanvasToStage);
    };
  }, [fitCanvasToStage]);

  useEffect(() => {
    if (!openPageMenu) return undefined;

    const closeMenu = () => setOpenPageMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-page-menu-root]")) return;
      closeMenu();
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [openPageMenu]);

  const togglePageMenu = useCallback((pageId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const tile = event.currentTarget.closest("[data-page-preview-tile]");
    const placement = getPageMenuPlacement((tile ?? event.currentTarget).getBoundingClientRect());
    setOpenPageMenu((current) => (current?.pageId === pageId ? null : { pageId, ...placement }));
  }, []);

  const startNewProject = (template: StudioTemplate) => {
    const nextPages = initialPagesForTemplate(template);
    const nextProject: StudioProject = {
      id: crypto.randomUUID(),
      title: template.title,
      kind: template.kind,
      templateId: template.id,
      width: template.width,
      height: template.height,
      classId: selectedClassId,
      className: resolvedLessonClassName,
      orderIndex: activeLessonOrderIndex,
      serverItemId: null,
      status: "draft",
    };
    setSavedStudioItemId(null);
    setPages(nextPages);
    pagesRef.current = nextPages;
    activePageIdRef.current = nextPages[0]?.id ?? "";
    setActivePageId(nextPages[0]?.id ?? "");
    setPanel("elements");
    setActiveProject(nextProject);
    setView("editor");
  };

  const startCustomProject = () => {
    const width = Math.min(3840, Math.max(320, Math.round(customWidth || DEFAULT_CANVAS_WIDTH)));
    const height = Math.min(3840, Math.max(320, Math.round(customHeight || DEFAULT_CANVAS_HEIGHT)));
    const customTemplate: StudioTemplate = {
      id: `custom-${selectedFormat}-${width}x${height}`,
      kind: selectedFormat,
      label: "Custom size",
      size: `${width} x ${height}`,
      width,
      height,
      title: selectedFormat === "doc" ? "Custom document" : selectedFormat === "slide" ? "Custom presentation" : "Custom design",
      body: "Start with your own dimensions, then add text, elements, images, pages, and AI content.",
      accent: DEFAULT_ACCENT,
    };
    startNewProject(customTemplate);
  };

  const applyCustomSize = () => {
    const width = Math.min(3840, Math.max(320, Math.round(customWidth || DEFAULT_CANVAS_WIDTH)));
    const height = Math.min(3840, Math.max(320, Math.round(customHeight || DEFAULT_CANVAS_HEIGHT)));
    applyTemplateSize({
      id: `custom-${selectedFormat}-${width}x${height}`,
      kind: selectedFormat,
      label: "Custom size",
      size: `${width} x ${height}`,
      width,
      height,
      title: activeProject?.title || "Custom lesson",
      body: "Custom EdSync lesson canvas.",
      accent: DEFAULT_ACCENT,
    });
  };

  const startAiAssistedProject = () => {
    startNewProject(templateById("ppt-wide"));
    setPanel("ai");
    setAiLessonType("lesson");
    setAiFocuses(["flow", "quiz", "slides"]);
    setAiStyle("socratic");
    setAiComplexity(55);
    setAiVersions(1);
    setAiPageCount(6);
    setAiPrompt((current) =>
      current.trim()
        ? current
        : "Create a concise course outline with editable pages, practice prompts, and proof of progress.",
    );
  };

  const applyTemplateSize = (template: StudioTemplate) => {
    if (!activeProject) {
      startNewProject(template);
      return;
    }
    syncActivePage();
    setCustomWidth(template.width);
    setCustomHeight(template.height);
    setActiveProject((current) =>
      current
        ? {
            ...current,
            kind: template.kind,
            templateId: template.id,
            width: template.width,
            height: template.height,
          }
        : current,
    );
    toast.success("Canvas size updated.");
  };

  const openProject = useCallback((item: StudioServerItem) => {
    const content = item.content;
    const metadata = item.metadata ?? {};
    const kind = studioItemKind(item);
    const template = templateById(typeof metadata.templateId === "string" ? metadata.templateId : null);
    const width = typeof metadata.canvasWidth === "number" ? metadata.canvasWidth : template.width;
    const height = typeof metadata.canvasHeight === "number" ? metadata.canvasHeight : template.height;
    const classId = typeof metadata.classId === "string" ? metadata.classId : "";
    const className = typeof metadata.className === "string" ? metadata.className : "";
    const orderIndex = typeof metadata.orderIndex === "number" ? metadata.orderIndex : 1;
    const storedPages = readProjectPages(content.pages);
    const nextPages = storedPages ?? initialPagesForTemplate(template, item.title);
    setSavedStudioItemId(item.id);
    setPages(nextPages);
    pagesRef.current = nextPages;
    const activeId = typeof content.activePageId === "string" ? content.activePageId : nextPages[0]?.id;
    activePageIdRef.current = activeId ?? "";
    setActivePageId(activeId ?? "");
    setPanel("pages");
    setActiveProject({
      id: item.id,
      title: item.title,
      kind,
      templateId: template.id,
      width,
      height,
      classId,
      className,
      orderIndex,
      serverItemId: item.id,
      status: item.status,
      updatedAt: item.updatedAt,
    });
    setSelectedClassId(classId);
    setLessonClassName(className);
    setLessonOrderIndex(orderIndex);
    setView("editor");
  }, []);

  useEffect(() => {
    if (!requestedStudioItemId || projectsLoading || view === "editor" || openedItemIdRef.current === requestedStudioItemId) return undefined;
    const item = projects.find((project) => project.id === requestedStudioItemId);
    if (!item) return undefined;
    openedItemIdRef.current = requestedStudioItemId;
    const openTimer = window.setTimeout(() => openProject(item), 0);
    return () => window.clearTimeout(openTimer);
  }, [openProject, projects, projectsLoading, requestedStudioItemId, view]);

  const returnToHub = async () => {
    syncActivePage();
    setOpenPageMenu(null);
    setView("hub");
    setActiveProject(null);
    setSelectedObject(null);
    activePageIdRef.current = "";
    setActivePageId("");
    await refreshProjects();
  };

  const switchPage = async (pageId: string) => {
    const nextPage = pages.find((page) => page.id === pageId);
    if (!nextPage || nextPage.id === activePageIdRef.current) return;
    setOpenPageMenu(null);
    syncActivePage();
    activePageIdRef.current = nextPage.id;
    setActivePageId(nextPage.id);
    await loadPage(nextPage);
  };

  const addObject = (object: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    object.set({
      borderColor: "#00c5a7",
      borderDashArray: [6, 4],
      borderScaleFactor: 1.5,
      cornerColor: "#ffffff",
      cornerSize: 10,
      cornerStrokeColor: "#00c5a7",
      cornerStyle: "circle",
      transparentCorners: false,
    });
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    updateSelectedObject();
    pushHistory();
  };

  const addText = (variant: "heading" | "body" | "note") => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const config = {
      heading: { text: "New heading", size: 46, weight: "800", width: 520 },
      body: { text: "Write clear lesson text here.", size: 25, weight: "500", width: 520 },
      note: { text: "Tip or practice prompt", size: 22, weight: "700", width: 360 },
    }[variant];
    addObject(
      new fabric.Textbox(config.text, {
        left: 120,
        top: 120,
        width: config.width,
        fontSize: config.size,
        fontWeight: config.weight,
        fontFamily: "Instrument Sans",
        fill: variant === "note" ? DEFAULT_ACCENT : "#0d1726",
      }),
    );
  };

  const addShape = (shape: "rect" | "circle" | "triangle") => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    if (shape === "circle") {
      addObject(new fabric.Circle({ left: 180, top: 150, radius: 70, fill: "#dbeafe", stroke: DEFAULT_ACCENT, strokeWidth: 3 }));
      return;
    }
    if (shape === "triangle") {
      addObject(new fabric.Triangle({ left: 190, top: 150, width: 150, height: 130, fill: "#dcfce7", stroke: "#0f9f82", strokeWidth: 3 }));
      return;
    }
    addObject(new fabric.Rect({ left: 170, top: 150, width: 190, height: 120, rx: 18, ry: 18, fill: "#eef4ff", stroke: DEFAULT_ACCENT, strokeWidth: 3 }));
  };

  const addImageCard = async () => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#2458dc"/><stop offset="1" stop-color="#0f9f82"/></linearGradient></defs><rect width="420" height="260" rx="28" fill="#eef6ff"/><circle cx="322" cy="78" r="42" fill="url(#g)" opacity=".85"/><path d="M44 208l92-90 74 66 54-46 112 70z" fill="url(#g)" opacity=".74"/><rect x="42" y="38" width="170" height="20" rx="10" fill="#0d1726" opacity=".22"/></svg>`,
    );
    const image = await fabric.FabricImage.fromURL(`data:image/svg+xml,${svg}`);
    image.set({ left: 190, top: 150, scaleX: 0.7, scaleY: 0.7 });
    addObject(image);
  };

  const uploadImage = async (file: File) => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const url = URL.createObjectURL(file);
    try {
      const image = await fabric.FabricImage.fromURL(url);
      image.scaleToWidth(420);
      image.set({ left: 160, top: 100 });
      addObject(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const removeSelected = useCallback(() => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    if (active.type === "activeselection" && "forEachObject" in active) {
      (active as FabricSelection).forEachObject((object) => canvas.remove(object));
    } else {
      canvas.remove(active);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    updateSelectedObject();
    pushHistory();
  }, [pushHistory, updateSelectedObject]);

  const duplicateSelected = async () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    const clone = (await active.clone()) as FabricObject;
    clone.set({ left: (active.left ?? 0) + 28, top: (active.top ?? 0) + 28 });
    addObject(clone);
  };

  const updateObject = (patch: Partial<InspectorObject>) => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() as InspectorObject | undefined;
    if (!canvas || !active) return;
    active.set(patch);
    canvas.requestRenderAll();
    setSelectedObject(active);
    pushHistory();
  };

  const undo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    if (current) futureRef.current.unshift(current);
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    restoringRef.current = true;
    canvas.clear();
    await Promise.resolve(canvas.loadFromJSON(JSON.parse(previous)));
    canvas.renderAll();
    restoringRef.current = false;
    updateSelectedObject();
    refreshHistoryState();
    syncActivePage();
  }, [refreshHistoryState, syncActivePage, updateSelectedObject]);

  const redo = useCallback(async () => {
    const canvas = canvasRef.current;
    const next = futureRef.current.shift();
    if (!canvas || !next) return;
    restoringRef.current = true;
    canvas.clear();
    await Promise.resolve(canvas.loadFromJSON(JSON.parse(next)));
    canvas.renderAll();
    restoringRef.current = false;
    historyRef.current.push(next);
    updateSelectedObject();
    refreshHistoryState();
    syncActivePage();
  }, [refreshHistoryState, syncActivePage, updateSelectedObject]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Delete" || event.key === "Backspace") {
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        removeSelected();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        void redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, removeSelected, undo]);

  const addPage = async () => {
    syncActivePage();
    const next: StudioPage = {
      id: crypto.randomUUID(),
      name: `Page ${pages.length + 1}`,
      seed: {
        title: "New page",
        body: "Add a concept, activity, or proof of learning.",
        accent: DEFAULT_ACCENT,
      },
      snapshot: null,
    };
    setPages((current) => [...current, next]);
    activePageIdRef.current = next.id;
    setActivePageId(next.id);
    await loadPage(next);
  };

  const duplicatePage = async (page: StudioPage) => {
    syncActivePage();
    const next: StudioPage = {
      ...page,
      id: crypto.randomUUID(),
      name: `${page.name} copy`,
      snapshot: page.id === activePageIdRef.current ? serializeCanvas() : page.snapshot,
      previewDataUrl: page.previewDataUrl,
    };
    setPages((current) => {
      const index = current.findIndex((item) => item.id === page.id);
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
  };

  const deletePage = async (page: StudioPage) => {
    setOpenPageMenu(null);
    if (pages.length === 1) {
      toast.error("Keep at least one page.");
      return;
    }
    const nextPages = pages.filter((item) => item.id !== page.id);
    setPages(nextPages);
    if (page.id === activePageIdRef.current) {
      const next = nextPages[0];
      activePageIdRef.current = next.id;
      setActivePageId(next.id);
      await loadPage(next);
    }
  };

  const movePage = (page: StudioPage, direction: -1 | 1) => {
    setOpenPageMenu(null);
    syncActivePage();
    setPages((current) => {
      const index = current.findIndex((item) => item.id === page.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const reorderPage = (sourcePageId: string, targetPageId: string) => {
    if (sourcePageId === targetPageId) return;
    setOpenPageMenu(null);
    syncActivePage();
    setPages((current) => {
      const sourceIndex = current.findIndex((page) => page.id === sourcePageId);
      const targetIndex = current.findIndex((page) => page.id === targetPageId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [sourcePage] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourcePage);
      pagesRef.current = next;
      return next;
    });
  };

  const activePageDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const zoom = canvas.getZoom();
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    canvas.setZoom(1);
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    canvas.setDimensions({ width, height });
    canvas.setZoom(zoom);
    canvas.renderAll();
    return dataUrl;
  };

  const exportPng = () => {
    const dataUrl = activePageDataUrl();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${activePage?.name ?? "edsync-page"}.png`;
    link.click();
  };

  const exportPdf = () => {
    const dataUrl = activePageDataUrl();
    if (!dataUrl) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Allow popups to export PDF.");
      return;
    }
    const orientation = canvasWidth >= canvasHeight ? "landscape" : "portrait";
    printWindow.document.write(`<!doctype html><html><head><title>EdSync PDF</title><style>@page{size:${orientation};margin:0}body{margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f8fc}img{width:100vw;height:auto;max-height:100vh;object-fit:contain}</style></head><body><img src="${dataUrl}" alt="EdSync studio lesson"/><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  const presentProject = () => {
    const dataUrl = activePageDataUrl();
    if (!dataUrl) return;
    const presentWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!presentWindow) {
      exportPng();
      toast.error("Allow popups to present. Downloaded the current page instead.");
      return;
    }
    presentWindow.document.write(`<!doctype html><html><head><title>${projectTitle()}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f}img{max-width:100vw;max-height:100vh;object-fit:contain}</style></head><body><img src="${dataUrl}" alt="EdSync lesson presentation"/></body></html>`);
    presentWindow.document.close();
  };

  const projectPayload = () => {
    syncActivePage();
    const project = activeProject
      ? {
          ...activeProject,
          classId: selectedClassId,
          className: resolvedLessonClassName,
          orderIndex: activeLessonOrderIndex,
        }
      : activeProject;
    return {
      app: "EdSync Studio",
      version: 1,
      exportedAt: new Date().toISOString(),
      activePageId: activePageIdRef.current,
      project,
      pages: pages.map((page) => ({
        ...page,
        snapshot: page.id === activePageIdRef.current ? serializeCanvas() : page.snapshot,
      })),
    };
  };

  const projectTitle = () => {
    const firstPage = pages[0];
    return activeProject?.title || firstPage?.seed.title?.trim() || firstPage?.name?.trim() || "Untitled lesson";
  };

  const projectPlainText = () =>
    pages
      .map((page, index) => `${index + 1}. ${page.name}\n${page.seed.title}\n${page.seed.body}`)
      .join("\n\n");

  const downloadProject = () => {
    downloadText("edsync-studio-lesson.json", JSON.stringify(projectPayload(), null, 2));
  };

  const saveLocal = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projectPayload()));
    toast.success(t.saved);
  };

  const persistProject = async (status: "draft" | "published") => {
    setSavingStatus(status);
    try {
      const payload = projectPayload();
      const input = {
        id: savedStudioItemId ?? undefined,
        kind: activeProject?.kind ?? "doc",
        title: projectTitle(),
        content: payload,
        plainText: projectPlainText(),
        status,
        sourceType: selectedClassId ? "class" : "studio_lesson",
        sourceId: selectedClassId || null,
        metadata: {
          editor: "fabric",
          templateId: activeProject?.templateId ?? "ppt-wide",
          canvasWidth,
          canvasHeight,
          classId: selectedClassId,
          className: resolvedLessonClassName,
          orderIndex: activeLessonOrderIndex,
          language,
          pageCount: pages.length,
          lessonName: aiLessonName.trim(),
          lessonDescription: aiDescription.trim(),
          objectives: aiObjectives.trim(),
          lessonType: aiLessonType,
          teachingStyle: aiStyle,
          sourceNotes: aiSources.trim(),
        },
      };
      const item = savedStudioItemId ? await updateStudioItem({ ...input, id: savedStudioItemId }) : await saveStudioItem(input);
      setSavedStudioItemId(item.id);
      setActiveProject((current) =>
        current
          ? {
              ...current,
              id: item.id,
              serverItemId: item.id,
              classId: selectedClassId,
              className: resolvedLessonClassName,
              orderIndex: activeLessonOrderIndex,
              status,
              updatedAt: item.updatedAt,
            }
          : current,
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, studioItemId: item.id, status }));
      toast.success(status === "published" ? "Published to EdSync." : "Saved to EdSync.");
      void refreshProjects();
      return item;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save studio lesson.");
      return null;
    } finally {
      setSavingStatus(null);
    }
  };

  const shareProject = async () => {
    const item = await persistProject("published");
    if (!item) return;
    const shareUrl = `${window.location.origin}/studio?item=${encodeURIComponent(item.id)}`;
    try {
      await window.navigator.clipboard.writeText(shareUrl);
      toast.success("Published and copied Studio link.");
    } catch {
      toast.success("Published. Open this lesson from Studio or My Courses.");
    }
  };

  const appendAiSource = useCallback((text: string) => {
    const source = text.trim();
    if (!source) return;
    setAiSources((current) => [current.trim(), source].filter(Boolean).join("\n\n"));
  }, []);

  const importProject = async (file: File) => {
    let parsed: { pages?: StudioPage[]; activePageId?: string; project?: Partial<StudioProject> };
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as { pages?: StudioPage[]; activePageId?: string; project?: Partial<StudioProject> };
    } catch {
      toast.error("This JSON file is not a Studio lesson.");
      return;
    }
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      toast.error("Invalid studio lesson.");
      return;
    }
    const template = templateById(parsed.project?.templateId);
    const nextProject: StudioProject = {
      id: crypto.randomUUID(),
      title: parsed.project?.title || "Imported lesson",
      kind: parsed.project?.kind === "doc" || parsed.project?.kind === "design" || parsed.project?.kind === "slide" ? parsed.project.kind : template.kind,
      templateId: template.id,
      width: typeof parsed.project?.width === "number" ? parsed.project.width : template.width,
      height: typeof parsed.project?.height === "number" ? parsed.project.height : template.height,
      classId: typeof parsed.project?.classId === "string" ? parsed.project.classId : "",
      className: typeof parsed.project?.className === "string" ? parsed.project.className : "",
      orderIndex: typeof parsed.project?.orderIndex === "number" ? parsed.project.orderIndex : 1,
      serverItemId: null,
      status: "draft",
    };
    setPages(parsed.pages);
    pagesRef.current = parsed.pages;
    const next = parsed.pages.find((page) => page.id === parsed.activePageId) ?? parsed.pages[0];
    activePageIdRef.current = next.id;
    setActivePageId(next.id);
    setSavedStudioItemId(null);
    setActiveProject(nextProject);
    setSelectedClassId(nextProject.classId);
    setLessonClassName(nextProject.className);
    setLessonOrderIndex(nextProject.orderIndex);
    setView("editor");
    await loadPage(next);
    toast.success("Lesson loaded.");
  };

  const extractSourceFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/content/extract", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as ContentExtractionResponse | null;
      if (!response.ok) {
        toast.error(data?.error || "Could not import this source.");
        return;
      }
      const sourceText = data?.text?.trim() || `Imported source: ${file.name}`;
      appendAiSource(sourceText);
      setAiPrompt((current) =>
        current.trim()
          ? current
          : "Use the imported source to create an editable EdSync lesson with a clear flow, activities, checks, and proof of progress.",
      );
      if (!activeProject) {
        startAiAssistedProject();
      } else {
        setPanel("ai");
      }
      if (data?.warning) toast(data.warning);
      toast.success(`${data?.kind ?? "Source"} imported for AI lesson.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Source import failed.");
    }
  };

  const handleStudioImport = async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".json") || file.type === "application/json") {
      await importProject(file);
      return;
    }
    if (file.type.startsWith("image/") && activeProject && canvasRef.current) {
      await uploadImage(file);
      setPanel("images");
      toast.success("Image added to canvas.");
      return;
    }
    await extractSourceFile(file);
  };

  const handleCanvasFileDrop = (files: FileList) => {
    const file = Array.from(files).find((item) => item.type.startsWith("image/")) ?? Array.from(files)[0];
    if (file) void handleStudioImport(file);
  };

  const handleCanvasPaste = (clipboardData: DataTransfer) => {
    const imageFromFiles = Array.from(clipboardData.files).find((file) => file.type.startsWith("image/"));
    const imageFromItems = Array.from(clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    const image = imageFromFiles ?? imageFromItems;
    if (!image) return false;
    void uploadImage(image);
    return true;
  };

  const applyAiLesson = async (lesson: {
    title?: string;
    description?: string;
    sections?: Array<{ title?: string; content?: string }>;
  }) => {
    const sections = lesson.sections?.length ? lesson.sections : [{ title: lesson.title, content: lesson.description }];
    const aiTitle = lesson.title?.trim() || sections[0]?.title?.trim() || "AI lesson";
    const nextPages: StudioPage[] = sections.map((section, index) => ({
      id: crypto.randomUUID(),
      name: section.title || `AI page ${index + 1}`,
      seed: {
        title: section.title || lesson.title || "AI lesson page",
        body: section.content || lesson.description || "Review and edit this generated page.",
        accent: index % 2 === 0 ? DEFAULT_ACCENT : "#0f9f82",
      },
      snapshot: null,
    }));
    setPages(nextPages);
    pagesRef.current = nextPages;
    activePageIdRef.current = nextPages[0].id;
    setActivePageId(nextPages[0].id);
    setActiveProject((current) =>
      current
        ? {
            ...current,
            title: aiTitle,
            status: "draft",
          }
        : current,
    );
    await loadPage(nextPages[0]);
  };

  const applyAiSlideDeck = async (slides: AiLessonSlide[]) => {
    const validSlides = slides.filter((slide) => slide.title.trim() && slide.onScreenText.length > 0);
    if (validSlides.length === 0) {
      toast.error("AI returned no usable slides.");
      return;
    }

    const nextPages: StudioPage[] = validSlides.map((slide, index) => {
      const bodyLines = slide.onScreenText
        .map(cleanSlideText)
        .filter((line) => line && line.toLowerCase() !== slide.title.toLowerCase());
      return {
        id: crypto.randomUUID(),
        name: slide.title,
        seed: {
          title: slide.title,
          body: bodyLines.join("\n") || slide.visualSuggestion || "Review and edit this generated slide.",
          accent: index % 2 === 0 ? DEFAULT_ACCENT : "#0f9f82",
        },
        snapshot: null,
      };
    });

    setPages(nextPages);
    pagesRef.current = nextPages;
    activePageIdRef.current = nextPages[0].id;
    setActivePageId(nextPages[0].id);
    setActiveProject((current) =>
      current
        ? {
            ...current,
            title: validSlides[0].title || current.title,
            status: "draft",
          }
        : current,
    );
    await loadPage(nextPages[0]);
  };

  const generateWithAi = async () => {
    const prompt = aiPrompt.trim();
    const lessonName = aiLessonName.trim();
    const description = aiDescription.trim();
    const objectives = aiObjectives.trim();
    const sources = aiSources.trim();
    const targetPageCount = Math.max(1, Math.round(aiPageCount || 1));
    const focusSummary = activeAiFocusDetails.map(([, label, detail]) => `${label}: ${detail}`).join("; ") || "Flow: complete lesson sequence";
    if (!prompt && !lessonName && !description && !objectives) {
      toast.error("Add a lesson goal, objective, or AI direction first.");
      return;
    }
    const lessonContext = [
      lessonName ? `Lesson name: ${lessonName}.` : null,
      description ? `Description: ${description}.` : null,
      objectives ? `Objectives: ${objectives}.` : null,
      sources ? `Source files, links, or notes: ${sources}.` : null,
      `Lesson type: ${aiLessonType}.`,
      `Required outputs: ${focusSummary}.`,
      `Teaching style: ${aiStyle}.`,
      `Target pages or sections: ${targetPageCount}.`,
      resolvedLessonClassName ? `Class or cohort: ${resolvedLessonClassName}.` : "Independent learner or creator workspace.",
      `Lesson order: ${activeLessonOrderIndex}.`,
      `Canvas format: ${activeProject?.kind ?? "slide"} ${canvasWidth} x ${canvasHeight}.`,
      `Include EdSync activities where useful: quiz checks, discussion prompts, practice loops, review cards, proof of progress, and game-style questions.`,
    ].filter(Boolean).join("\n");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/create-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "text",
          content: `${prompt || "Build a complete EdSync learning experience."}\n\nEdSync lesson context:\n${lessonContext}`,
          complexity: aiComplexity,
          pacing: 50,
          scaffolding: 45,
          depth: "standard",
          languageStyle: aiStyle === "expert" ? "academic" : aiStyle === "professional" ? "professional" : "student_friendly",
          audienceLanguage: language === "es" ? "Spanish" : language === "fr" ? "French" : "English",
          versionCount: Math.max(1, Math.min(3, aiVersions)),
          designTemplateId: "clear-classroom",
          outputLength: "standard",
          outputFormat: "slide_deck",
          slideCount: targetPageCount,
        }),
      });
      const data = (await response.json()) as {
        lesson?: { title?: string; description?: string; sections?: Array<{ title?: string; content?: string }> };
        slides?: AiLessonSlide[];
        error?: string;
      };
      if (!response.ok || (!data.lesson && !data.slides?.length)) {
        toast.error(data.error || "AI generation is unavailable.");
        return;
      }
      if (data.slides?.length) {
        await applyAiSlideDeck(data.slides);
      } else if (data.lesson) {
        await applyAiLesson(data.lesson);
      }
      setPanel("pages");
      toast.success("AI lesson added to the canvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toolRail = [
    { id: "design" as const, label: "Format", icon: LayoutPanelLeft },
    { id: "elements" as const, label: t.elements, icon: Shapes },
    { id: "text" as const, label: t.text, icon: Type },
    { id: "images" as const, label: t.images, icon: ImageIcon },
    { id: "pages" as const, label: t.pages, icon: LayoutPanelLeft },
    { id: "ai" as const, label: t.ai, icon: Sparkles },
    { id: "export" as const, label: t.export, icon: Download },
  ];

  const openPanel = (nextPanel: StudioPanel) => {
    setPanel(nextPanel);
    const canvas = canvasRef.current;
    if (!canvas?.getActiveObject()) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    updateSelectedObject();
  };

  const aiLessonBuilder = (
    <div className="space-y-4">
      <PanelTitle icon={Sparkles} title={t.ai} />
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-xs font-bold text-edsync-subtle">
          Lesson name <RequiredMark />
          <input
            value={aiLessonName}
            onChange={(event) => setAiLessonName(event.target.value)}
            placeholder="Example: Logic proofs for beginners"
            className="mt-1 h-11 w-full rounded-2xl border border-edsync-border bg-edsync-surface px-3 text-sm font-black text-edsync-text"
          />
        </label>
        <label className="block text-xs font-bold text-edsync-subtle">
          Lesson type
          <select
            value={aiLessonType}
            onChange={(event) => setAiLessonType(event.target.value as AiLessonType)}
            className="mt-1 h-11 w-full rounded-2xl border border-edsync-border bg-edsync-surface px-3 text-sm font-black text-edsync-text"
          >
            <option value="lesson">Lesson flow</option>
            <option value="slides">PPT / slides</option>
            <option value="quiz">Quiz check</option>
            <option value="discussion">Discussion</option>
            <option value="activity">Activity</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-xs font-bold text-edsync-subtle">
          Description
          <textarea
            value={aiDescription}
            onChange={(event) => setAiDescription(event.target.value)}
            rows={3}
            className="edsync-textarea mt-1 text-sm"
            placeholder="Audience, topic, and expected learning outcome"
          />
        </label>
        <label className="block text-xs font-bold text-edsync-subtle">
          Objectives <RequiredMark />
          <textarea
            value={aiObjectives}
            onChange={(event) => setAiObjectives(event.target.value)}
            rows={3}
            className="edsync-textarea mt-1 text-sm"
            placeholder="Success criteria, quiz targets, practice goals"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block rounded-2xl bg-edsync-surface p-3 text-xs font-bold text-edsync-subtle">
          Style
          <select
            value={aiStyle}
            onChange={(event) => setAiStyle(event.target.value as AiLessonStyle)}
            className="mt-2 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
          >
            <option value="socratic">Socratic</option>
            <option value="direct">Direct</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label className="block rounded-2xl bg-edsync-surface p-3 text-xs font-bold text-edsync-subtle">
          Complexity {aiComplexity}
          <input
            type="range"
            min={10}
            max={100}
            value={aiComplexity}
            onChange={(event) => setAiComplexity(Number(event.target.value))}
            className="mt-3 w-full accent-edsync-blue"
          />
        </label>
        <label className="block rounded-2xl bg-edsync-surface p-3 text-xs font-bold text-edsync-subtle">
          Pages / sections
          <input
            type="number"
            min={1}
            max={24}
            value={aiPageCount}
            onChange={(event) => setAiPageCount(Math.min(24, Math.max(1, Number(event.target.value))))}
            className="mt-2 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
          />
        </label>
        <label className="block rounded-2xl bg-edsync-surface p-3 text-xs font-bold text-edsync-subtle">
          Versions
          <input
            type="number"
            min={1}
            max={4}
            value={aiVersions}
            onChange={(event) => setAiVersions(Math.min(4, Math.max(1, Number(event.target.value))))}
            className="mt-2 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-edsync-subtle">
            Include
          </p>
          <button
            type="button"
            onClick={() => projectInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-black text-edsync-blue transition hover:bg-edsync-blue/10"
          >
            <UploadCloud className="h-4 w-4" />
            Attach
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FOCUS_OPTIONS.map(([id, label, detail]) => {
            const active = aiFocuses.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setAiFocuses((current) =>
                    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                  )
                }
                className={`rounded-2xl px-3 py-2 text-left text-xs font-black transition ${
                  active
                    ? "bg-edsync-blue/10 text-edsync-blue ring-1 ring-edsync-blue/30"
                    : "bg-edsync-surface text-edsync-text hover:bg-edsync-muted"
                }`}
              >
                <span className="block">{label}</span>
                <span className="mt-1 block text-[11px] font-semibold leading-4 text-edsync-subtle">
                  {detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <label className="block text-xs font-bold text-edsync-subtle">
            AI direction <RequiredMark />
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              rows={5}
              className="edsync-textarea mt-1"
              placeholder={t.aiPrompt}
            />
          </label>
          <label className="block text-xs font-bold text-edsync-subtle">
            Sources, links, constraints
            <textarea
              value={aiSources}
              onChange={(event) => setAiSources(event.target.value)}
              rows={4}
              className="edsync-textarea mt-1 text-sm"
              placeholder="Paste links, file notes, source text, or constraints"
            />
          </label>
        </div>
        <div className="rounded-2xl bg-edsync-surface p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-edsync-subtle">
            Prompt preview
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-edsync-card p-3 text-xs font-semibold leading-5 text-edsync-text">
            {aiPromptPreview}
          </pre>
        </div>
      </div>

      <button
        type="button"
        onClick={generateWithAi}
        disabled={isGenerating}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {isGenerating ? "Generating..." : t.generate}
      </button>
    </div>
  );

  const openPageMenuPage = openPageMenu ? pages.find((page) => page.id === openPageMenu.pageId) : undefined;
  const runPageMenuAction = (action: () => void | Promise<void>) => {
    setOpenPageMenu(null);
    void action();
  };
  const pageMenuPortal =
    openPageMenu && openPageMenuPage && typeof document !== "undefined"
      ? createPortal(
          <div
            data-page-menu-root
            className="fixed z-[1000] w-56 overflow-hidden rounded-3xl bg-edsync-card p-1 text-sm font-semibold text-edsync-text shadow-2xl ring-1 ring-edsync-border"
            style={{ left: openPageMenu.left, top: openPageMenu.top }}
            role="menu"
          >
            <PageMenuRow label="Copy" shortcut="Ctrl+C" icon={Copy} onClick={() => runPageMenuAction(() => duplicatePage(openPageMenuPage))} />
            <PageMenuRow label="Move left" icon={ArrowUp} onClick={() => runPageMenuAction(() => movePage(openPageMenuPage, -1))} />
            <PageMenuRow label="Move right" icon={ArrowDown} onClick={() => runPageMenuAction(() => movePage(openPageMenuPage, 1))} />
            <PageMenuRow label="Duplicate" shortcut="Ctrl+D" icon={Copy} onClick={() => runPageMenuAction(() => duplicatePage(openPageMenuPage))} />
            <PageMenuRow label="Delete" shortcut="Del" icon={Trash2} tone="danger" onClick={() => runPageMenuAction(() => deletePage(openPageMenuPage))} />
            <PageMenuRow label="Add page" icon={Plus} onClick={() => runPageMenuAction(addPage)} />
            <PageMenuRow label="Download page" icon={Download} onClick={() => runPageMenuAction(exportPng)} />
          </div>,
          document.body,
        )
      : null;
  const formatChooserPortal =
    view === "formats" && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[900] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Choose lesson format">
            <section className="max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] border border-edsync-border bg-edsync-card p-4 shadow-2xl shadow-slate-900/25 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-edsync-blue">Format</p>
                  <h2 className="font-display text-2xl font-black">Choose dimensions</h2>
                  <p className="text-sm font-semibold text-edsync-subtle">Pick the lesson canvas size before editing.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-2xl border border-edsync-border bg-edsync-surface p-1">
                    {STUDIO_FORMATS.map((format) => (
                      <button
                        key={format.id}
                        type="button"
                        onClick={() => setSelectedFormat(format.id)}
                        className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                          selectedFormat === format.id ? "bg-edsync-text text-edsync-card" : "text-edsync-subtle hover:text-edsync-text"
                        }`}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("hub")}
                    className="grid h-10 w-10 place-items-center rounded-2xl text-edsync-subtle transition hover:bg-edsync-muted hover:text-edsync-text"
                    aria-label="Close format chooser"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} onSelect={() => startNewProject(template)} />
                ))}
                <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                      <Maximize2 className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-edsync-border bg-edsync-card px-2.5 py-1 text-xs font-black text-edsync-subtle">
                      Custom
                    </span>
                  </div>
                  <p className="mt-5 font-display text-xl font-black">Custom dimensions</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs font-bold text-edsync-subtle">
                      Width
                      <input
                        type="number"
                        min={320}
                        max={3840}
                        value={customWidth}
                        onChange={(event) => setCustomWidth(Number(event.target.value))}
                        className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
                      />
                    </label>
                    <label className="text-xs font-bold text-edsync-subtle">
                      Height
                      <input
                        type="number"
                        min={320}
                        max={3840}
                        value={customHeight}
                        onChange={(event) => setCustomHeight(Number(event.target.value))}
                        className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
                      />
                    </label>
                  </div>
                  <button type="button" onClick={startCustomProject} className="btn-primary mt-4 w-full justify-center">
                    Create custom
                  </button>
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  if (view !== "editor" || !activeProject) {
    return (
      <>
      <main className="min-h-[calc(100dvh-1rem)] overflow-x-clip bg-edsync-bg text-edsync-text">
        <section className="mx-auto w-full">
          <div className="space-y-5">
            <header className="premium-panel overflow-hidden rounded-[1.5rem] p-5 sm:p-7">
              <div className="mx-auto max-w-4xl text-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-edsync-blue">EdSync Studio</p>
                <h1 className="mt-3 font-display text-3xl font-black text-edsync-text sm:text-5xl">
                  What will you create today?
                </h1>
                <label className="mx-auto mt-5 flex max-w-3xl items-center gap-3 rounded-[1.35rem] border border-edsync-border bg-edsync-card px-4 py-3 shadow-lg shadow-slate-300/20 dark:shadow-black/25">
                  <Search className="h-5 w-5 flex-shrink-0 text-edsync-subtle" />
                  <input
                    value={projectQuery}
                    onChange={(event) => setProjectQuery(event.target.value)}
                    placeholder="Search lessons, formats, and uploads"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-edsync-text outline-none placeholder:text-edsync-subtle sm:text-base"
                  />
                </label>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setView("formats")} className="btn-primary justify-center px-4 py-3">
                  <Plus className="h-4 w-4" />
                  New lesson
                </button>
                <button type="button" onClick={startAiAssistedProject} className="btn-secondary justify-center px-4 py-3">
                  <Sparkles className="h-4 w-4" />
                  AI lesson
                </button>
                <button type="button" onClick={() => projectInputRef.current?.click()} className="btn-secondary justify-center px-4 py-3">
                  <FileJson className="h-4 w-4" />
                  Import
                </button>
                <button type="button" onClick={() => {
                  setSelectedFormat("slide");
                  setView("formats");
                }} className="btn-secondary justify-center px-4 py-3">
                  <Maximize2 className="h-4 w-4" />
                  Format/dimensions
                </button>
              </div>
            </header>

          <section className="grid gap-5">
            <div className="premium-surface rounded-[1.5rem] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-black">Your lessons</h2>
                  <p className="text-sm font-semibold text-edsync-subtle">Open recent lessons, or filter by Doc, PPT, and design.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all" as const, label: "All", count: projectCounts.all },
                    { id: "slide" as const, label: "PPT", count: projectCounts.slide },
                    { id: "doc" as const, label: "Docs", count: projectCounts.doc },
                    { id: "design" as const, label: "Design", count: projectCounts.design },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setProjectKindFilter(filter.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                        projectKindFilter === filter.id
                          ? "border-edsync-blue bg-edsync-blue text-white"
                          : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/40 hover:text-edsync-text"
                      }`}
                    >
                      {filter.label} {filter.count}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void refreshProjects()} className="btn-ghost px-3 py-2 text-sm">
                  Refresh
                </button>
              </div>

              {projectsLoading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="h-40 animate-pulse rounded-2xl bg-edsync-muted" />
                  ))}
                </div>
              ) : filteredProjects.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onOpen={() => openProject(project)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
                  <Presentation className="mx-auto mb-3 h-9 w-9 text-edsync-blue" />
                  <p className="font-display text-xl font-black">{projects.length > 0 ? "No matching lessons" : "No lessons yet"}</p>
                  <p className="mt-1 text-sm text-edsync-subtle">{projects.length > 0 ? "Try another search or filter." : "Start with a Doc, PPT, or design size."}</p>
                  <button type="button" onClick={() => setView("formats")} className="btn-primary mt-5 inline-flex">
                    <Plus className="h-4 w-4" />
                    Add new
                  </button>
                </div>
              )}
            </div>

          </section>

          </div>
        </section>

        <input ref={projectInputRef} type="file" accept={STUDIO_IMPORT_ACCEPT} className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleStudioImport(file);
          event.currentTarget.value = "";
        }} />
      </main>
      {formatChooserPortal}
      </>
    );
  }

  return (
    <>
    <main className="min-h-dvh overflow-x-clip bg-edsync-bg text-edsync-text">
      <section className="flex min-h-dvh flex-col overflow-hidden bg-edsync-card lg:h-[calc(100dvh-1.5rem)] lg:rounded-[1.25rem] lg:border lg:border-edsync-border">
        <header className="flex min-h-14 flex-wrap items-center gap-2 bg-gradient-to-r from-edsync-emerald via-edsync-blue to-violet-700 px-3 py-2 text-white shadow-lg shadow-edsync-blue/20">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button type="button" onClick={() => void returnToHub()} className="inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-black transition hover:bg-white/15" title={t.back}>
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button type="button" onClick={() => setPanel("export")} className="hidden h-10 items-center gap-2 rounded-2xl px-3 text-sm font-black transition hover:bg-white/15 sm:inline-flex">
              <FileText className="h-4 w-4" />
              File
            </button>
            <button type="button" onClick={() => setPanel("design")} className="hidden h-10 items-center gap-2 rounded-2xl px-3 text-sm font-black transition hover:bg-white/15 sm:inline-flex">
              <Maximize2 className="h-4 w-4" />
              Resize
            </button>
            <button type="button" onClick={() => openPanel(selectedObject ? "text" : "elements")} className="hidden h-10 items-center gap-2 rounded-2xl px-3 text-sm font-black transition hover:bg-white/15 md:inline-flex">
              <MousePointer2 className="h-4 w-4" />
              Editing
            </button>
            <span className="mx-1 hidden h-7 w-px bg-white/25 md:block" />
            <button type="button" onClick={undo} disabled={!canUndo} className="grid h-10 w-10 place-items-center rounded-2xl transition hover:bg-white/15 disabled:opacity-35" title={t.undo} aria-label={t.undo}>
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className="grid h-10 w-10 place-items-center rounded-2xl transition hover:bg-white/15 disabled:opacity-35" title={t.redo} aria-label={t.redo}>
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 flex-[1.4] text-center">
            <h1 className="truncate text-sm font-black sm:text-base">{activeProject.title}</h1>
            <p className="hidden truncate text-[11px] font-semibold text-white/75 sm:block">
              {[activeProject.kind.toUpperCase(), `${activeProject.width} x ${activeProject.height}`, resolvedLessonClassName, `Order ${activeLessonOrderIndex}`]
                .filter(Boolean)
                .join(" / ")}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            <button type="button" onClick={() => void persistProject("draft")} disabled={savingStatus !== null} className="hidden h-10 items-center gap-2 rounded-xl px-2 text-sm font-black transition hover:bg-white/15 disabled:opacity-50 lg:inline-flex">
              <Save className="h-4 w-4" />
              {savingStatus === "draft" ? "..." : t.save}
            </button>
            <select value={language} onChange={(event) => setLanguage(event.target.value as StudioLanguage)} className="h-10 rounded-2xl border border-white/25 bg-white px-3 text-sm font-black text-edsync-text">
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
            </select>
            <ThemeToggle compact />
            <button type="button" onClick={presentProject} className="h-10 rounded-xl px-2 text-sm font-black text-white transition hover:bg-white/15 sm:px-3">
              Present
            </button>
            <button type="button" onClick={() => void shareProject()} disabled={savingStatus !== null} className="h-10 rounded-xl px-2 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50 sm:px-3">
              {savingStatus === "published" ? "..." : "Share"}
            </button>
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 ${
            panel === "ai" && !selectedObject
              ? "lg:grid-cols-[72px_minmax(0,1fr)]"
              : "lg:grid-cols-[72px_304px_minmax(0,1fr)]"
          }`}
        >
          <nav className="flex gap-1 overflow-x-auto border-b border-edsync-border bg-edsync-card p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r">
            {toolRail.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => openPanel(tool.id)}
                  className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-black transition lg:min-w-0 ${
                    !selectedObject && panel === tool.id ? "bg-gradient-to-br from-edsync-blue to-edsync-emerald text-white shadow-sm" : "text-edsync-subtle hover:bg-edsync-surface hover:text-edsync-text"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </nav>

          <aside
            className={`edsync-scrollbar-none min-h-0 border-b border-edsync-border bg-edsync-card p-3 lg:border-b-0 lg:border-r lg:overflow-y-auto ${
              panel === "ai" && !selectedObject ? "hidden" : "block"
            }`}
          >
            {selectedObject ? (
              <div className="space-y-4">
                <PanelTitle icon={MousePointer2} title={t.selected} />
                <InspectorColor label={t.color} value={cssColor(selectedObject.fill)} onChange={(value) => updateObject({ fill: value })} />
                <InspectorColor label={t.stroke} value={cssColor(selectedObject.stroke, "#0d1726")} onChange={(value) => updateObject({ stroke: value })} />
                <InspectorRange label={t.opacity} min={0.1} max={1} step={0.05} value={selectedObject.opacity ?? 1} onChange={(value) => updateObject({ opacity: value })} />
                {"fontSize" in selectedObject && (
                  <InspectorRange label={t.size} min={12} max={96} step={1} value={selectedObject.fontSize ?? 24} onChange={(value) => updateObject({ fontSize: value })} />
                )}
                <InspectorRange label={t.rotate} min={-180} max={180} step={1} value={selectedObject.angle ?? 0} onChange={(value) => updateObject({ angle: value })} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={duplicateSelected} className="btn-secondary justify-center px-3 py-2 text-sm">
                    <Copy className="h-4 w-4" />
                    {t.duplicate}
                  </button>
                  <button type="button" onClick={removeSelected} className="btn-secondary justify-center px-3 py-2 text-sm text-edsync-red">
                    <Trash2 className="h-4 w-4" />
                    {t.delete}
                  </button>
                </div>
                <button type="button" onClick={() => openPanel(panel)} className="btn-ghost w-full justify-center px-3 py-2 text-sm">
                  Done editing
                </button>
              </div>
            ) : (
              <>
            {panel === "design" && (
              <div className="space-y-4">
                <PanelTitle icon={LayoutPanelLeft} title="Format/dimensions" />
                <LessonSetupPanel
                  classes={classes}
                  selectedClassId={selectedClassId}
                  classNameValue={lessonClassName}
                  orderIndex={lessonOrderIndex}
                  onClassIdChange={(classId) => {
                    setSelectedClassId(classId);
                    const nextClass = classes.find((classItem) => classItem.id === classId);
                    if (nextClass) setLessonClassName(nextClass.name);
                  }}
                  onClassNameChange={(value) => {
                    setSelectedClassId("");
                    setLessonClassName(value);
                  }}
                  onOrderIndexChange={setLessonOrderIndex}
                />
                <div className="flex rounded-2xl border border-edsync-border bg-edsync-surface p-1">
                  {STUDIO_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => setSelectedFormat(format.id)}
                      className={`flex-1 rounded-xl px-2 py-2 text-xs font-black transition ${
                        selectedFormat === format.id ? "bg-edsync-text text-edsync-card" : "text-edsync-subtle hover:text-edsync-text"
                      }`}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2">
                  {selectedTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplateSize(template)}
                      className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-edsync-blue/40 ${
                        activeProject.templateId === template.id ? "border-edsync-blue bg-edsync-blue/10" : "border-edsync-border bg-edsync-surface"
                      }`}
                    >
                      <span className="block text-sm font-black text-edsync-text">{template.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-edsync-subtle">{template.size}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-edsync-text">Design templates</p>
                    <span className="rounded-full bg-edsync-blue/10 px-2 py-1 text-[10px] font-black uppercase text-edsync-blue">Style</span>
                  </div>
                  <div className="grid gap-2">
                    {[
                      ["Clean lesson", "#2458dc"],
                      ["Practice check", "#0f9f82"],
                      ["Activity deck", "#6d28d9"],
                    ].map(([label, accent]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (!activePage) return;
                          const nextPage = { ...activePage, seed: { ...activePage.seed, accent }, snapshot: null };
                          setPages((current) => current.map((page) => (page.id === nextPage.id ? nextPage : page)));
                          pagesRef.current = pagesRef.current.map((page) => (page.id === nextPage.id ? nextPage : page));
                          void loadPage(nextPage);
                        }}
                        className="flex items-center gap-3 rounded-xl border border-edsync-border bg-edsync-card px-3 py-2 text-left text-sm font-black transition hover:border-edsync-blue/40"
                      >
                        <span className="h-5 w-5 rounded-lg" style={{ backgroundColor: accent }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                  <div className="flex items-center gap-2 text-sm font-black">
                    <Maximize2 className="h-4 w-4 text-edsync-blue" />
                    Custom
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs font-bold text-edsync-subtle">
                      Width
                      <input
                        type="number"
                        min={320}
                        max={3840}
                        value={customWidth}
                        onChange={(event) => setCustomWidth(Number(event.target.value))}
                        className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
                      />
                    </label>
                    <label className="text-xs font-bold text-edsync-subtle">
                      Height
                      <input
                        type="number"
                        min={320}
                        max={3840}
                        value={customHeight}
                        onChange={(event) => setCustomHeight(Number(event.target.value))}
                        className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
                      />
                    </label>
                  </div>
                  <button type="button" onClick={applyCustomSize} className="btn-secondary mt-3 w-full justify-center">
                    Apply custom
                  </button>
                </div>
              </div>
            )}
            {panel === "elements" && (
              <div className="space-y-4">
                <PanelTitle icon={Shapes} title={t.elements} />
                <div className="grid grid-cols-3 gap-2">
                  <ToolButton label={t.square} icon={Square} onClick={() => addShape("rect")} />
                  <ToolButton label={t.circle} icon={Circle} onClick={() => addShape("circle")} />
                  <ToolButton label={t.triangle} icon={Triangle} onClick={() => addShape("triangle")} />
                </div>
                <button type="button" onClick={addImageCard} className="w-full rounded-2xl border border-edsync-border bg-edsync-surface p-4 text-left font-black transition hover:border-edsync-blue/40">
                  <ImageIcon className="mb-3 h-5 w-5 text-edsync-blue" />
                  {t.image}
                </button>
              </div>
            )}
            {panel === "text" && (
              <div className="space-y-4">
                <PanelTitle icon={Type} title={t.text} />
                <ToolRow label={t.heading} onClick={() => addText("heading")} />
                <ToolRow label={t.body} onClick={() => addText("body")} />
                <ToolRow label={t.note} onClick={() => addText("note")} />
              </div>
            )}
            {panel === "images" && (
              <div className="space-y-4">
                <PanelTitle icon={ImageIcon} title={t.images} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full justify-center">
                  <ImageIcon className="h-4 w-4" />
                  {t.upload}
                </button>
                <button type="button" onClick={() => projectInputRef.current?.click()} className="btn-secondary w-full justify-center">
                  <UploadCloud className="h-4 w-4" />
                  Import source
                </button>
                <p className="rounded-2xl border border-edsync-border bg-edsync-surface px-3 py-2 text-xs font-bold text-edsync-subtle">
                  Drop or paste images onto the canvas. Import PDF, PPT, Word, or text as AI lesson source.
                </p>
                <button type="button" onClick={addImageCard} className="w-full rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-5 text-sm font-bold text-edsync-subtle transition hover:border-edsync-blue/40 hover:text-edsync-blue">
                  {t.image}
                </button>
              </div>
            )}
            {panel === "pages" && (
              <div className="space-y-4">
                <PanelTitle icon={LayoutPanelLeft} title={t.pages} />
                <button type="button" onClick={addPage} className="btn-primary w-full justify-center">
                  <Plus className="h-4 w-4" />
                  {t.addPage}
                </button>
                <div className="space-y-2">
                  {pages.map((page, index) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => void switchPage(page.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        page.id === activePageId ? "border-edsync-blue bg-edsync-blue/10" : "border-edsync-border bg-edsync-surface hover:border-edsync-blue/40"
                      }`}
                    >
                      <span className="text-xs font-black text-edsync-subtle">{String(index + 1).padStart(2, "0")}</span>
                      <span className="ml-2 font-black">{page.name}</span>
                      <span className="mt-3 flex gap-1">
                        <IconPill label={t.moveUp} icon={ArrowUp} onClick={(event) => { event.stopPropagation(); movePage(page, -1); }} />
                        <IconPill label={t.moveDown} icon={ArrowDown} onClick={(event) => { event.stopPropagation(); movePage(page, 1); }} />
                        <IconPill label={t.duplicatePage} icon={Copy} onClick={(event) => { event.stopPropagation(); void duplicatePage(page); }} />
                        <IconPill label={t.deletePage} icon={Trash2} onClick={(event) => { event.stopPropagation(); void deletePage(page); }} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {panel === "ai" && (
              <div className="space-y-3">
                <PanelTitle icon={Sparkles} title={t.ai} />
                <p className="rounded-2xl bg-edsync-surface px-3 py-2 text-sm font-semibold text-edsync-subtle">
                  AI lesson opens as a larger canvas panel so prompts, files, and output choices stay readable.
                </p>
                <button
                  type="button"
                  onClick={() => setPanel("ai")}
                  className="btn-primary w-full justify-center"
                >
                  <Sparkles className="h-4 w-4" />
                  Open AI builder
                </button>
              </div>
            )}
            {panel === "export" && (
              <div className="space-y-4">
                <PanelTitle icon={Download} title={t.export} />
                <ToolRow label={t.png} onClick={exportPng} />
                <ToolRow label={t.pdf} onClick={exportPdf} />
                <ToolRow label={t.project} onClick={downloadProject} />
                <ToolRow label="Local backup" onClick={saveLocal} />
                <ToolRow label={t.save} onClick={() => void persistProject("draft")} />
                <ToolRow label={t.publish} onClick={() => void persistProject("published")} />
                <button type="button" onClick={() => projectInputRef.current?.click()} className="btn-secondary w-full justify-center">
                  <UploadCloud className="h-4 w-4" />
                  Import source
                </button>
              </div>
            )}
              </>
            )}
          </aside>

          <section className="min-h-0 bg-edsync-bg lg:overflow-hidden">
            <div className="flex h-full min-h-[24rem] flex-col bg-edsync-bg sm:min-h-[34rem]">
              <div
                ref={canvasStageRef}
                tabIndex={0}
                className="relative grid flex-1 place-items-center overflow-auto bg-[#eef3f8] p-10 outline-none dark:bg-[#dfe8f2] sm:p-16"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleCanvasFileDrop(event.dataTransfer.files);
                }}
                onPaste={(event) => {
                  if (handleCanvasPaste(event.clipboardData)) event.preventDefault();
                }}
                aria-label="EdSync lesson canvas workspace"
              >
                {panel === "ai" && !selectedObject && (
                  <div className="absolute inset-x-2 top-3 z-20 mx-auto max-h-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto rounded-[1.5rem] bg-edsync-card/98 p-4 shadow-2xl shadow-slate-500/25 ring-1 ring-edsync-border backdrop-blur sm:inset-x-4 sm:p-5">
                    {aiLessonBuilder}
                  </div>
                )}
                <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-edsync-border bg-edsync-card/95 p-1.5 shadow-xl shadow-slate-400/20 backdrop-blur">
                  <button type="button" onClick={() => openPanel("ai")} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black text-edsync-text transition hover:bg-edsync-blue/10">
                    <Sparkles className="h-4 w-4 text-edsync-blue" />
                    Ask EdSync
                  </button>
                  <button type="button" onClick={() => openPanel(selectedObject ? "text" : "elements")} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black text-edsync-text transition hover:bg-edsync-muted">
                    <MousePointer2 className="h-4 w-4" />
                    Edit
                  </button>
                  {selectedObject && (
                    <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-black text-edsync-text transition hover:bg-edsync-muted">
                      <span className="h-4 w-4 rounded-full border border-edsync-border" style={{ backgroundColor: cssColor(selectedObject.fill) }} />
                      Style
                      <input type="color" value={cssColor(selectedObject.fill)} onChange={(event) => updateObject({ fill: event.target.value })} className="sr-only" />
                    </label>
                  )}
                  <span className="h-5 w-px shrink-0 bg-edsync-border" />
                  <button type="button" onClick={duplicateSelected} disabled={!selectedObject} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-edsync-text transition hover:bg-edsync-muted disabled:opacity-35" title={t.duplicate} aria-label={t.duplicate}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={removeSelected} disabled={!selectedObject} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-edsync-red transition hover:bg-edsync-red/10 disabled:opacity-35" title={t.delete} aria-label={t.delete}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="my-14 bg-white shadow-xl shadow-slate-400/25">
                  <canvas ref={canvasElementRef} aria-label="EdSync lesson canvas" />
                </div>
              </div>
              <div className="border-t border-edsync-border bg-edsync-card">
                <div className="flex gap-2 overflow-x-auto px-3 py-2">
                  {pages.map((page, index) => {
                    const isActivePage = page.id === activePageId;
                    const isMenuOpen = openPageMenu?.pageId === page.id;
                    return (
                      <div
                        key={page.id}
                        data-page-preview-tile
                        draggable
                        onDragStart={() => setDraggingPageId(page.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingPageId) reorderPage(draggingPageId, page.id);
                          setDraggingPageId(null);
                        }}
                        onDragEnd={() => setDraggingPageId(null)}
                        className={`group relative min-w-[7.25rem] rounded-xl p-1.5 transition ${
                          isActivePage ? "bg-edsync-blue/10 ring-2 ring-edsync-blue/35" : "hover:bg-edsync-muted"
                        } ${draggingPageId === page.id ? "opacity-55" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => void switchPage(page.id)}
                          className="relative block h-14 w-[6.5rem] overflow-hidden rounded-lg bg-white text-left shadow-sm"
                          aria-label={`Open page ${index + 1}`}
                        >
                          {page.previewDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={page.previewDataUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="block h-full w-full bg-white p-2">
                              <span className="block h-1.5 w-8 rounded-full" style={{ backgroundColor: page.seed.accent }} />
                              <span className="mt-2 block h-2 w-12 rounded-full bg-slate-200" />
                              <span className="mt-1 block h-2 w-9 rounded-full bg-slate-200" />
                            </span>
                          )}
                          <span className="absolute bottom-1 left-1 rounded-md bg-edsync-text/80 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                            {index + 1}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => togglePageMenu(page.id, event)}
                          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-edsync-card/95 text-edsync-text opacity-0 shadow-sm transition hover:bg-edsync-muted group-hover:opacity-100 data-[open=true]:opacity-100"
                          data-open={isMenuOpen}
                          data-page-menu-root
                          aria-label={`Page ${index + 1} menu`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden max-w-48 -translate-x-1/2 rounded-xl bg-edsync-text px-3 py-2 text-xs font-black text-edsync-card shadow-xl group-hover:block">
                          {page.name}
                        </span>
                      </div>
                    );
                  })}
                  <button type="button" onClick={addPage} className="flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl px-3 py-4 text-xs font-black text-edsync-blue transition hover:bg-edsync-blue/10">
                    <Plus className="h-4 w-4" />
                    {t.addPage}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edsync-border/70 px-3 py-2 text-xs font-black text-edsync-subtle">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => openPanel("pages")} className="rounded-xl px-2 py-1.5 transition hover:bg-edsync-muted hover:text-edsync-text">
                      Notes
                    </button>
                    <button type="button" onClick={() => openPanel("pages")} className="rounded-xl px-2 py-1.5 transition hover:bg-edsync-muted hover:text-edsync-text">
                      Timer
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
                    <label className="flex items-center gap-2">
                      <span className="sr-only">Canvas zoom</span>
                      <input
                        type="range"
                        min={10}
                        max={500}
                        step={10}
                        value={zoomPercent}
                        onChange={(event) => setZoomPercent(Number(event.target.value))}
                        className="w-24 accent-edsync-blue sm:w-32"
                        aria-label="Canvas zoom"
                      />
                      <span className="min-w-10 text-edsync-text">{zoomPercent}%</span>
                    </label>
                    <span className="whitespace-nowrap text-edsync-text">
                      {pages.findIndex((page) => page.id === activePageId) + 1} / {pages.length}
                    </span>
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-xl text-edsync-text transition hover:bg-edsync-muted" aria-label="Grid view">
                      <LayoutPanelLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={presentProject} className="grid h-8 w-8 place-items-center rounded-xl text-edsync-text transition hover:bg-edsync-muted" aria-label="Full screen presentation">
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void uploadImage(file);
        event.currentTarget.value = "";
      }} />
      <input ref={projectInputRef} type="file" accept={STUDIO_IMPORT_ACCEPT} className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void handleStudioImport(file);
        event.currentTarget.value = "";
      }} />
    </main>
    {pageMenuPortal}
    </>
  );
}

function ProjectCard({ project, onOpen }: { project: StudioServerItem; onOpen: () => void }) {
  const kind = studioItemKind(project);
  const template = templateById(typeof project.metadata?.templateId === "string" ? project.metadata.templateId : null);
  const FormatIcon = kind === "slide" ? Presentation : kind === "design" ? SlidersHorizontal : FileText;
  const width = typeof project.metadata?.canvasWidth === "number" ? project.metadata.canvasWidth : template.width;
  const height = typeof project.metadata?.canvasHeight === "number" ? project.metadata.canvasHeight : template.height;
  const className = typeof project.metadata?.className === "string" ? project.metadata.className : "";
  const orderIndex = typeof project.metadata?.orderIndex === "number" ? project.metadata.orderIndex : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-w-0 rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-edsync-blue/40 hover:bg-edsync-card"
    >
      <div className="aspect-[1.35] overflow-hidden rounded-xl border border-edsync-border bg-gradient-to-br from-edsync-blue/12 via-edsync-card to-edsync-emerald/10 p-3">
        <div
          className="mx-auto h-full rounded-lg border border-edsync-border bg-white shadow-sm transition group-hover:scale-[1.02]"
          style={{ aspectRatio: `${width} / ${height}`, maxWidth: "100%" }}
        >
          <div className="h-2 w-16 rounded-br-lg bg-edsync-blue" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded-full bg-slate-900/20" />
            <div className="h-2 w-1/2 rounded-full bg-slate-900/12" />
            <div className="h-2 w-2/3 rounded-full bg-slate-900/12" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
          <FormatIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black text-edsync-text">{project.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-edsync-subtle">
            <span>{kind === "slide" ? "PPT" : kind === "design" ? "Design" : "Doc"}</span>
            <span>{width} x {height}</span>
            {className && <span>{className}</span>}
            {orderIndex && <span>Order {orderIndex}</span>}
            <span>{formatUpdatedAt(project.updatedAt)}</span>
          </span>
        </span>
      </div>
    </button>
  );
}

function LessonSetupPanel({
  classes,
  selectedClassId,
  classNameValue,
  orderIndex,
  onClassIdChange,
  onClassNameChange,
  onOrderIndexChange,
}: {
  classes: StudioRosterClass[];
  selectedClassId: string;
  classNameValue: string;
  orderIndex: number;
  onClassIdChange: (value: string) => void;
  onClassNameChange: (value: string) => void;
  onOrderIndexChange: (value: number) => void;
}) {
  return (
    <div className="mb-4 mt-4 rounded-2xl border border-edsync-border bg-edsync-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-edsync-text">Lesson setup</p>
          <p className="text-xs font-semibold text-edsync-subtle">Course, class, and order.</p>
        </div>
        <span className="rounded-full bg-edsync-blue/10 px-2 py-1 text-[11px] font-black text-edsync-blue">EdSync</span>
      </div>
      {classes.length > 0 ? (
        <label className="mt-3 block text-xs font-bold text-edsync-subtle">
          Attach to course / class
          <select
            value={selectedClassId}
            onChange={(event) => onClassIdChange(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
          >
            <option value="">Independent course lesson</option>
            {classes.map((classItem) => {
              const detail = [classItem.subject, classItem.grade_level].filter(Boolean).join(" / ");
              return (
                <option key={classItem.id} value={classItem.id}>
                  {detail ? `${classItem.name} (${detail})` : classItem.name}
                </option>
              );
            })}
          </select>
        </label>
      ) : (
        <label className="mt-3 block text-xs font-bold text-edsync-subtle">
          Course, class, or cohort
          <input
            value={classNameValue}
            onChange={(event) => onClassNameChange(event.target.value)}
            placeholder="Course, cohort, or independent lesson"
            className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
          />
        </label>
      )}
      <label className="mt-3 block text-xs font-bold text-edsync-subtle">
        Lesson order
        <input
          type="number"
          min={1}
          value={orderIndex}
          onChange={(event) => onOrderIndexChange(Number(event.target.value))}
          className="mt-1 h-10 w-full rounded-xl border border-edsync-border bg-edsync-card px-3 text-sm font-black text-edsync-text"
        />
      </label>
    </div>
  );
}

function TemplateCard({ template, onSelect }: { template: StudioTemplate; onSelect: () => void }) {
  const Icon = template.kind === "slide" ? Presentation : template.kind === "design" ? SlidersHorizontal : FileText;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group rounded-2xl border border-edsync-border bg-edsync-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-edsync-blue/40 hover:bg-edsync-card"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full border border-edsync-border bg-edsync-card px-2.5 py-1 text-xs font-black text-edsync-subtle">
          {template.size}
        </span>
      </div>
      <div className="mt-5">
        <p className="font-display text-xl font-black">{template.label}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-edsync-subtle">{template.body}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-edsync-blue">
        Create <ArrowDown className="h-4 w-4 -rotate-90 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Shapes; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-edsync-blue/10 text-edsync-blue">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="font-display text-lg font-black text-edsync-text">{title}</h2>
    </div>
  );
}

function RequiredMark() {
  return <span className="text-edsync-red" aria-label="required">*</span>;
}

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Square; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid aspect-square place-items-center rounded-2xl border border-edsync-border bg-edsync-surface p-2 text-xs font-black transition hover:-translate-y-0.5 hover:border-edsync-blue/40">
      <Icon className="h-5 w-5 text-edsync-blue" />
      <span>{label}</span>
    </button>
  );
}

function ToolRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-2xl border border-edsync-border bg-edsync-surface px-4 py-3 text-left font-black transition hover:-translate-y-0.5 hover:border-edsync-blue/40">
      <span>{label}</span>
      <Plus className="h-4 w-4 text-edsync-blue" />
    </button>
  );
}

function IconPill({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowUp;
  label: string;
  onClick: (event: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span role="button" tabIndex={0} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-xl border border-edsync-border bg-edsync-card text-edsync-subtle transition hover:border-edsync-blue/40 hover:text-edsync-blue" title={label}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function PageMenuRow({
  icon: Icon,
  label,
  shortcut,
  tone = "default",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-edsync-muted ${
        tone === "danger" ? "text-edsync-red" : "text-edsync-text"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="rounded-md bg-edsync-muted px-1.5 py-0.5 text-[11px] font-black text-edsync-subtle">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function InspectorColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-sm font-black">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 cursor-pointer rounded-xl border border-edsync-border bg-transparent" />
    </label>
  );
}

function InspectorRange({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-edsync-border bg-edsync-surface p-3">
      <span className="mb-2 flex justify-between text-sm font-black">
        <span>{label}</span>
        <span className="text-edsync-subtle">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-edsync-blue" />
    </label>
  );
}
