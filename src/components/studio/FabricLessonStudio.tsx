"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";
import { listStudioItems, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Circle,
  FileText,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  Home,
  Image as ImageIcon,
  LayoutPanelLeft,
  Maximize2,
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
  Undo2,
  UploadCloud,
} from "lucide-react";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";

type FabricModule = typeof import("fabric");
type StudioPanel = "design" | "elements" | "text" | "images" | "pages" | "ai" | "export";
type StudioLanguage = "en" | "es" | "fr";
type StudioView = "hub" | "formats" | "editor";
type StudioFormatKind = "doc" | "slide" | "design";
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
  serverItemId: string | null;
  status: "draft" | "published" | "archived";
  updatedAt?: string;
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

const DEFAULT_CANVAS_WIDTH = 960;
const DEFAULT_CANVAS_HEIGHT = 540;
const STORAGE_KEY = "edsync.canva.lesson.studio.v1";
const DEFAULT_ACCENT = "#2458dc";
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
    ai: "AI",
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
    project: "Project",
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
    ai: "IA",
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
    project: "Proyecto",
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
    ai: "IA",
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
    project: "Projet",
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

function formatUpdatedAt(value: string | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function FabricLessonStudio() {
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
  const [view, setView] = useState<StudioView>("hub");
  const [projects, setProjects] = useState<StudioServerItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectKindFilter, setProjectKindFilter] = useState<StudioFormatKind | "all">("all");
  const [selectedFormat, setSelectedFormat] = useState<StudioFormatKind>("slide");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [activeProject, setActiveProject] = useState<StudioProject | null>(null);
  const [pages, setPages] = useState<StudioPage[]>(initialPages);
  const [activePageId, setActivePageId] = useState("");
  const [panel, setPanel] = useState<StudioPanel>("elements");
  const [language, setLanguage] = useState<StudioLanguage>("en");
  const [selectedObject, setSelectedObject] = useState<InspectorObject | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedStudioItemId, setSavedStudioItemId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<"draft" | "published" | null>(null);
  const t = copy[language];
  const canvasWidth = activeProject?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = activeProject?.height ?? DEFAULT_CANVAS_HEIGHT;
  const selectedTemplates = STUDIO_TEMPLATES.filter((template) => template.kind === selectedFormat);
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    return projects.filter((project) => {
      const kind = studioItemKind(project);
      const matchesKind = projectKindFilter === "all" || kind === projectKindFilter;
      const matchesQuery = !query || project.title.toLowerCase().includes(query);
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
      toast.error(error instanceof Error ? error.message : "Could not load studio projects.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refreshProjects();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refreshProjects]);

  const fitCanvasToStage = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = canvasStageRef.current;
    if (!canvas || !stage) return;
    const bounds = stage.getBoundingClientRect();
    const scale = Math.min(
      1,
      Math.max(0.28, (bounds.width - 48) / canvasWidth),
      Math.max(0.28, (bounds.height - 48) / canvasHeight),
    );
    canvas.setDimensions({
      width: Math.round(canvasWidth * scale),
      height: Math.round(canvasHeight * scale),
    });
    canvas.setZoom(scale);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, [canvasHeight, canvasWidth]);

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
    const snapshot = serializeCanvas();
    const pageId = activePageIdRef.current;
    if (!snapshot || !pageId) return;
    setPages((current) =>
      current.map((page) => (page.id === pageId ? { ...page, snapshot } : page)),
    );
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
        selectionColor: "rgba(36,88,220,0.12)",
        selectionBorderColor: DEFAULT_ACCENT,
      });
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

  const startNewProject = (template: StudioTemplate) => {
    const nextPages = initialPagesForTemplate(template);
    const nextProject: StudioProject = {
      id: crypto.randomUUID(),
      title: template.title,
      kind: template.kind,
      templateId: template.id,
      width: template.width,
      height: template.height,
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

  const startAiAssistedProject = () => {
    startNewProject(templateById("ppt-wide"));
    setPanel("ai");
    setAiPrompt("Create a concise course outline with editable pages, practice prompts, and proof of progress.");
  };

  const openProject = (item: StudioServerItem) => {
    const content = item.content;
    const metadata = item.metadata ?? {};
    const kind = studioItemKind(item);
    const template = templateById(typeof metadata.templateId === "string" ? metadata.templateId : null);
    const width = typeof metadata.canvasWidth === "number" ? metadata.canvasWidth : template.width;
    const height = typeof metadata.canvasHeight === "number" ? metadata.canvasHeight : template.height;
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
      serverItemId: item.id,
      status: item.status,
      updatedAt: item.updatedAt,
    });
    setView("editor");
  };

  const returnToHub = async () => {
    syncActivePage();
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
    syncActivePage();
    activePageIdRef.current = nextPage.id;
    setActivePageId(nextPage.id);
    await loadPage(nextPage);
  };

  const addObject = (object: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    object.set({
      cornerColor: DEFAULT_ACCENT,
      cornerStrokeColor: "#ffffff",
      borderColor: DEFAULT_ACCENT,
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
    };
    setPages((current) => {
      const index = current.findIndex((item) => item.id === page.id);
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
  };

  const deletePage = async (page: StudioPage) => {
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

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${activePage?.name ?? "edsync-page"}.png`;
    link.click();
  };

  const exportPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Allow popups to export PDF.");
      return;
    }
    const orientation = canvasWidth >= canvasHeight ? "landscape" : "portrait";
    printWindow.document.write(`<!doctype html><html><head><title>EdSync PDF</title><style>@page{size:${orientation};margin:0}body{margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f8fc}img{width:100vw;height:auto;max-height:100vh;object-fit:contain}</style></head><body><img src="${dataUrl}" alt="EdSync studio project"/><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  const projectPayload = () => {
    syncActivePage();
    return {
      app: "EdSync Studio",
      version: 1,
      exportedAt: new Date().toISOString(),
      activePageId: activePageIdRef.current,
      project: activeProject,
      pages: pages.map((page) => ({
        ...page,
        snapshot: page.id === activePageIdRef.current ? serializeCanvas() : page.snapshot,
      })),
    };
  };

  const projectTitle = () => {
    const firstPage = pages[0];
    return activeProject?.title || firstPage?.seed.title?.trim() || firstPage?.name?.trim() || "Untitled project";
  };

  const projectPlainText = () =>
    pages
      .map((page, index) => `${index + 1}. ${page.name}\n${page.seed.title}\n${page.seed.body}`)
      .join("\n\n");

  const downloadProject = () => {
    downloadText("edsync-studio-project.json", JSON.stringify(projectPayload(), null, 2));
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
        metadata: {
          editor: "fabric",
          templateId: activeProject?.templateId ?? "ppt-wide",
          canvasWidth,
          canvasHeight,
          language,
          pageCount: pages.length,
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
              status,
              updatedAt: item.updatedAt,
            }
          : current,
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, studioItemId: item.id, status }));
      toast.success(status === "published" ? "Published to EdSync." : "Saved to EdSync.");
      void refreshProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save studio project.");
    } finally {
      setSavingStatus(null);
    }
  };

  const importProject = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as { pages?: StudioPage[]; activePageId?: string; project?: Partial<StudioProject> };
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      toast.error("Invalid studio project.");
      return;
    }
    const template = templateById(parsed.project?.templateId);
    const nextProject: StudioProject = {
      id: crypto.randomUUID(),
      title: parsed.project?.title || "Imported project",
      kind: parsed.project?.kind === "doc" || parsed.project?.kind === "design" || parsed.project?.kind === "slide" ? parsed.project.kind : template.kind,
      templateId: template.id,
      width: typeof parsed.project?.width === "number" ? parsed.project.width : template.width,
      height: typeof parsed.project?.height === "number" ? parsed.project.height : template.height,
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
    setView("editor");
    await loadPage(next);
    toast.success("Project loaded.");
  };

  const applyAiLesson = async (lesson: {
    title?: string;
    description?: string;
    sections?: Array<{ title?: string; content?: string }>;
  }) => {
    const sections = lesson.sections?.length ? lesson.sections : [{ title: lesson.title, content: lesson.description }];
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
    activePageIdRef.current = nextPages[0].id;
    setActivePageId(nextPages[0].id);
    await loadPage(nextPages[0]);
  };

  const generateWithAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast.error("Add an AI prompt first.");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/create-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "text",
          content: prompt,
          complexity: 55,
          pacing: 50,
          scaffolding: 45,
          depth: "standard",
          languageStyle: "student_friendly",
          audienceLanguage: language === "es" ? "Spanish" : language === "fr" ? "French" : "English",
          versionCount: 1,
          designTemplateId: "clear-classroom",
          outputLength: "standard",
        }),
      });
      const data = (await response.json()) as {
        lesson?: { title?: string; description?: string; sections?: Array<{ title?: string; content?: string }> };
        error?: string;
      };
      if (!response.ok || !data.lesson) {
        toast.error(data.error || "AI generation is unavailable.");
        return;
      }
      await applyAiLesson(data.lesson);
      setPanel("pages");
      toast.success("AI lesson added to the canvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toolRail = [
    { id: "elements" as const, label: t.elements, icon: Shapes },
    { id: "text" as const, label: t.text, icon: Type },
    { id: "images" as const, label: t.images, icon: ImageIcon },
    { id: "pages" as const, label: t.pages, icon: LayoutPanelLeft },
    { id: "ai" as const, label: t.ai, icon: Sparkles },
    { id: "export" as const, label: t.export, icon: Download },
  ];

  if (view !== "editor" || !activeProject) {
    return (
      <main className="min-h-[calc(100dvh-1rem)] overflow-x-clip bg-edsync-bg p-2 text-edsync-text sm:p-4">
        <section className="mx-auto grid max-w-[96rem] gap-4 lg:grid-cols-[76px_minmax(0,1fr)]">
          <nav className="premium-surface hidden rounded-[1.5rem] p-2 lg:flex lg:min-h-[calc(100dvh-2rem)] lg:flex-col lg:items-center lg:gap-2">
            {[
              { label: "Create", icon: Plus, active: view === "formats", action: "formats" },
              { label: "Home", icon: Home, active: view === "hub", action: "hub" },
              { label: "Projects", icon: FolderOpen, active: false, action: "hub" },
              { label: "Templates", icon: LayoutPanelLeft, active: view === "formats", action: "formats" },
              { label: "Upload", icon: UploadCloud, active: false, action: "upload" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.action === "upload") {
                      projectInputRef.current?.click();
                      return;
                    }
                    setView(item.action === "formats" ? "formats" : "hub");
                  }}
                  className={`flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-black transition ${
                    item.active ? "bg-edsync-blue text-white shadow-sm" : "text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-5">
            <header className="premium-panel overflow-hidden rounded-[2rem] p-5 sm:p-7">
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
                    placeholder="Search projects, formats, and uploads"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-edsync-text outline-none placeholder:text-edsync-subtle sm:text-base"
                  />
                </label>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {STUDIO_TEMPLATES.map((template) => {
                  const Icon = template.kind === "slide" ? Presentation : template.kind === "design" ? SlidersHorizontal : FileText;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => startNewProject(template)}
                      className="group rounded-2xl border border-edsync-border bg-edsync-card p-3 text-center transition hover:-translate-y-0.5 hover:border-edsync-blue/40"
                    >
                      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-edsync-blue to-edsync-emerald text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-2 block truncate text-sm font-black">{template.label}</span>
                      <span className="block text-xs font-bold text-edsync-subtle">{template.size}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setView("formats")} className="btn-primary justify-center px-4 py-3">
                  <Plus className="h-4 w-4" />
                  New project
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
                  setSelectedFormat("design");
                  setView("formats");
                }} className="btn-secondary justify-center px-4 py-3">
                  <Maximize2 className="h-4 w-4" />
                  Custom size
                </button>
              </div>
            </header>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="premium-surface rounded-[1.5rem] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-black">Your projects</h2>
                  <p className="text-sm font-semibold text-edsync-subtle">Open recent work, or filter by Doc, PPT, and design.</p>
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
                  <p className="font-display text-xl font-black">{projects.length > 0 ? "No matching projects" : "No studio projects yet"}</p>
                  <p className="mt-1 text-sm text-edsync-subtle">{projects.length > 0 ? "Try another search or filter." : "Start with a Doc, PPT, or design size."}</p>
                  <button type="button" onClick={() => setView("formats")} className="btn-primary mt-5 inline-flex">
                    <Plus className="h-4 w-4" />
                    Add new
                  </button>
                </div>
              )}
            </div>

            <aside className="premium-surface h-fit rounded-[1.5rem] p-4 sm:p-5">
              <h2 className="font-display text-xl font-black">New project</h2>
              <div className="mt-4 grid gap-2">
                {STUDIO_FORMATS.map((format) => {
                  const Icon = format.icon;
                  return (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormat(format.id);
                        setView("formats");
                      }}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                        selectedFormat === format.id && view === "formats"
                          ? "border-edsync-blue bg-edsync-blue/10"
                          : "border-edsync-border bg-edsync-surface hover:border-edsync-blue/40"
                      }`}
                    >
                      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-black">{format.label}</span>
                        <span className="block text-xs font-semibold leading-5 text-edsync-subtle">{format.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                <div className="flex items-center gap-2 text-sm font-black">
                  <Maximize2 className="h-4 w-4 text-edsync-blue" />
                  Custom size
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
                <button type="button" onClick={startCustomProject} className="btn-secondary mt-3 w-full justify-center">
                  Create custom
                </button>
              </div>
            </aside>
          </section>

          {view === "formats" && (
            <section className="premium-panel rounded-[1.5rem] p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-black">Choose format and dimensions</h2>
                  <p className="text-sm font-semibold text-edsync-subtle">The canvas opens with the right aspect ratio and project type.</p>
                </div>
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
          )}
          </div>
        </section>

        <input ref={projectInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importProject(file);
          event.currentTarget.value = "";
        }} />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-1rem)] overflow-x-clip bg-edsync-bg p-2 text-edsync-text sm:p-3">
      <section className="flex min-h-[720px] flex-col overflow-hidden rounded-[2rem] border border-edsync-border bg-edsync-card shadow-2xl shadow-slate-300/40 dark:shadow-black/40 lg:h-[calc(100dvh-1.5rem)]">
        <header className="flex flex-wrap items-center gap-2 border-b border-edsync-border bg-edsync-card/95 px-3 py-2 backdrop-blur">
          <button type="button" onClick={() => void returnToHub()} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-edsync-border bg-edsync-surface px-3 text-sm font-black text-edsync-text transition hover:border-edsync-blue/40">
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </button>
          <div className="min-w-[12rem] flex-1">
            <h1 className="font-display text-lg font-black text-edsync-text sm:text-xl">{activeProject.title}</h1>
            <p className="hidden text-xs font-semibold text-edsync-subtle sm:block">
              {activeProject.kind.toUpperCase()} · {activeProject.width} x {activeProject.height}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-edsync-border bg-edsync-surface p-1">
            <button type="button" onClick={undo} disabled={!canUndo} className="h-9 rounded-xl px-2 text-edsync-text transition hover:bg-edsync-card disabled:opacity-35" title={t.undo} aria-label={t.undo}>
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className="h-9 rounded-xl px-2 text-edsync-text transition hover:bg-edsync-card disabled:opacity-35" title={t.redo} aria-label={t.redo}>
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => void persistProject("draft")} disabled={savingStatus !== null} className="hidden h-10 items-center gap-2 rounded-2xl border border-edsync-border bg-edsync-surface px-3 text-sm font-black transition hover:border-edsync-blue/40 disabled:opacity-50 sm:inline-flex">
            <Save className="h-4 w-4" />
            {savingStatus === "draft" ? "..." : t.save}
          </button>
          <select value={language} onChange={(event) => setLanguage(event.target.value as StudioLanguage)} className="h-10 rounded-2xl border border-edsync-border bg-edsync-surface px-3 text-sm font-black text-edsync-text">
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
          </select>
          <ThemeToggle compact />
          <button type="button" onClick={() => void persistProject("published")} disabled={savingStatus !== null} className="btn-primary h-10 px-4 text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />
            {savingStatus === "published" ? "..." : t.publish}
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[76px_300px_minmax(0,1fr)_280px]">
          <nav className="grid grid-cols-3 gap-1 border-b border-edsync-border bg-edsync-card p-2 sm:grid-cols-6 lg:flex lg:flex-col lg:border-b-0 lg:border-r">
            {toolRail.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setPanel(tool.id)}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-black transition ${
                    panel === tool.id ? "bg-gradient-to-br from-edsync-blue to-edsync-emerald text-white shadow-sm" : "text-edsync-subtle hover:bg-edsync-surface hover:text-edsync-text"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </nav>

          <aside className="min-h-0 border-b border-edsync-border bg-edsync-card p-4 lg:border-b-0 lg:border-r lg:overflow-y-auto">
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
              <div className="space-y-4">
                <PanelTitle icon={Sparkles} title={t.ai} />
                <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={8} className="edsync-textarea" placeholder={t.aiPrompt} />
                <button type="button" onClick={generateWithAi} disabled={isGenerating} className="btn-primary w-full justify-center disabled:opacity-50">
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "..." : t.generate}
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
                  <FileJson className="h-4 w-4" />
                  {t.importProject}
                </button>
              </div>
            )}
          </aside>

          <section className="min-h-0 bg-[radial-gradient(circle_at_50%_0%,rgba(36,88,220,0.14),transparent_25rem)] p-3 dark:bg-slate-950 lg:overflow-hidden">
            <div className="flex h-full min-h-[34rem] flex-col rounded-[1.5rem] border border-edsync-border bg-edsync-bg/75 p-3 backdrop-blur">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-edsync-border bg-edsync-card px-3 py-2 text-xs font-black text-edsync-subtle">
                  <MousePointer2 className="h-4 w-4 text-edsync-blue" />
                  {activePage?.name}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={duplicateSelected} className="rounded-2xl border border-edsync-border bg-edsync-card px-3 py-2 text-xs font-black transition hover:border-edsync-blue/40">
                    <Copy className="inline h-4 w-4" /> {t.duplicate}
                  </button>
                  <button type="button" onClick={removeSelected} className="rounded-2xl border border-edsync-border bg-edsync-card px-3 py-2 text-xs font-black text-edsync-red transition hover:border-edsync-red/40">
                    <Trash2 className="inline h-4 w-4" /> {t.delete}
                  </button>
                </div>
              </div>
              <div ref={canvasStageRef} className="grid flex-1 place-items-center overflow-hidden rounded-[1.25rem] border border-edsync-border bg-[linear-gradient(45deg,rgba(15,23,42,0.05)_25%,transparent_25%,transparent_75%,rgba(15,23,42,0.05)_75%),linear-gradient(45deg,rgba(15,23,42,0.05)_25%,transparent_25%,transparent_75%,rgba(15,23,42,0.05)_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px] p-3 sm:p-6">
                <div className="rounded-[1.35rem] bg-white p-0 shadow-2xl shadow-slate-400/30">
                  <canvas ref={canvasElementRef} aria-label="EdSync lesson canvas" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-edsync-border bg-edsync-card p-2">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => void switchPage(page.id)}
                    className={`flex min-w-[7rem] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-black transition ${
                      page.id === activePageId ? "border-edsync-blue bg-edsync-blue text-white" : "border-edsync-border bg-edsync-surface text-edsync-text hover:border-edsync-blue/40"
                    }`}
                  >
                    <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${page.id === activePageId ? "bg-white/18" : "bg-edsync-blue/10 text-edsync-blue"}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate">{page.name}</span>
                  </button>
                ))}
                <button type="button" onClick={addPage} className="flex min-w-[7rem] items-center justify-center gap-2 rounded-xl border border-dashed border-edsync-border bg-edsync-surface px-3 py-2 text-xs font-black text-edsync-blue transition hover:border-edsync-blue/40">
                  <Plus className="h-4 w-4" />
                  {t.addPage}
                </button>
              </div>
            </div>
          </section>

          <aside className="border-t border-edsync-border bg-edsync-card p-4 lg:border-l lg:border-t-0 lg:overflow-y-auto">
            <PanelTitle icon={MousePointer2} title={t.selected} />
            {selectedObject ? (
              <div className="mt-4 space-y-4">
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
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-4 text-sm font-semibold text-edsync-subtle">{t.noSelection}</p>
            )}
          </aside>
        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void uploadImage(file);
        event.currentTarget.value = "";
      }} />
      <input ref={projectInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void importProject(file);
        event.currentTarget.value = "";
      }} />
    </main>
  );
}

function ProjectCard({ project, onOpen }: { project: StudioServerItem; onOpen: () => void }) {
  const kind = studioItemKind(project);
  const template = templateById(typeof project.metadata?.templateId === "string" ? project.metadata.templateId : null);
  const FormatIcon = kind === "slide" ? Presentation : kind === "design" ? SlidersHorizontal : FileText;
  const width = typeof project.metadata?.canvasWidth === "number" ? project.metadata.canvasWidth : template.width;
  const height = typeof project.metadata?.canvasHeight === "number" ? project.metadata.canvasHeight : template.height;

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
            <span>{formatUpdatedAt(project.updatedAt)}</span>
          </span>
        </span>
      </div>
    </button>
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
