"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowRight,
  AlignLeft,
  Bold,
  Blocks,
  Download,
  Film,
  Image as ImageIcon,
  Italic,
  Languages,
  LayoutTemplate,
  List,
  Palette,
  Play,
  Sparkles,
  Type,
  Underline,
  Wand2,
} from "lucide-react";
import {
  SECTION_INSERT_TOOLS,
  SECTION_TEMPLATES,
  normalizeLessonAuthoringContent,
  type SectionTemplate,
} from "@/lib/content/section-library";
import LessonBlockEditor from "@/components/lesson/LessonBlockEditor";
import { createClient } from "@/lib/edsync/client";
import {
  CREATOR_ASSET_CATEGORIES,
  CREATOR_EXPORT_OPTIONS,
  CREATOR_PALETTE_SWATCHES,
  CREATOR_TEXT_STYLES,
  PRACTICE_GAME_STYLE_PRESETS,
} from "@/lib/learning/creator-library";
import { listLessonTemplateOptions } from "@/lib/learning/design-system";
import { classifySafeMediaUrl, safeImageUrl } from "@/lib/security/media";
import type { AILessonDraft, ContentType, DifficultyLevel } from "@/types";

type CreationMode = "ai_collab" | "ai_full" | "manual";
type ImportMode = "objectives" | "text" | "url" | "file";
type Step = "choose" | "import" | "generating" | "edit";
type GenerationDepth = "quick" | "standard" | "zero_to_expert";
type LanguageStyle = "student_friendly" | "professional" | "speaking" | "simple";
type StudioPanel = "templates" | "blocks" | "media" | "text" | "brand" | "animate" | "ai" | "export";

type DraftSection = {
  title: string;
  content: string;
  content_type: ContentType;
  duration_minutes: number;
};
type DraftQuestion = {
  question_text: string;
  question_type: string;
  options: { id: string; text: string; is_correct: boolean }[];
  explanation: string;
  difficulty: DifficultyLevel;
  is_diagnostic: boolean;
  is_micro_check: boolean;
  is_final_quiz: boolean;
};
type DraftGlossary = { term: string; definition: string; example: string };

const languageOptions = [
  "English",
  "Khmer",
  "Korean",
  "Chinese",
  "Japanese",
  "Spanish",
  "French",
  "German",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Arabic",
];

const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string; short: string }> = [
  { value: "text", label: "Text", short: "Text" },
  { value: "image", label: "Image", short: "Media" },
  { value: "video", label: "Video", short: "Video" },
  { value: "quiz", label: "Quiz", short: "Quiz" },
  { value: "activity", label: "Activity", short: "Act" },
  { value: "discussion", label: "Discussion", short: "Talk" },
];

type Draft = {
  title: string;
  description: string;
  objectives: string[];
  estimated_duration: number;
  prerequisites: string[];
  tags: string[];
  sections: DraftSection[];
  quiz_questions: DraftQuestion[];
  glossary_terms: DraftGlossary[];
  difficulty: DifficultyLevel;
  subject: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  objectives: ["", "", ""],
  estimated_duration: 45,
  prerequisites: [],
  tags: [],
  sections: [
    {
      title: "Introduction",
      content: "",
      content_type: "text",
      duration_minutes: 8,
    },
    {
      title: "Core Content",
      content: "",
      content_type: "text",
      duration_minutes: 20,
    },
    {
      title: "Summary",
      content: "",
      content_type: "text",
      duration_minutes: 7,
    },
  ],
  quiz_questions: [],
  glossary_terms: [],
  difficulty: "intermediate",
  subject: "",
});

const GENERATION_STEPS = [
  "Extracting key concepts from your content...",
  "Identifying learning objectives...",
  "Designing lesson framework and block types...",
  "Writing page content (text, video, image)...",
  "Generating quiz questions (diagnostic, micro-checks, final)...",
  "Building glossary from key terms...",
  "Organizing and finalizing lesson...",
];

const DRAFT_STORAGE_KEY = "edsync.lesson.create.draft.v1";
const DRAFT_AUTOSAVE_DELAY_MS = 700;

type DraftStorageContent = {
  draft: Draft;
  inputText: string;
  complexity: number;
  pacing: number;
  scaffolding: number;
  generationDepth: GenerationDepth;
  languageStyle: LanguageStyle;
  audienceLanguage: string;
  versionCount: number;
  designTemplateId: string;
  creationMode: CreationMode;
  importMode: ImportMode;
  activeTab: "overview" | "canvas" | "questions" | "glossary";
};

type DraftStoragePayload = Omit<Partial<DraftStorageContent>, "activeTab"> & {
  activeTab?: DraftStorageContent["activeTab"] | "sections";
  savedAt?: string;
};

const lessonTemplateOptions = listLessonTemplateOptions();

const STUDIO_TOOL_RAIL = [
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "blocks", label: "Elements", icon: Blocks },
  { id: "text", label: "Text", icon: Type },
  { id: "media", label: "Uploads", icon: ImageIcon },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "animate", label: "Animate", icon: Wand2 },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "export", label: "Export", icon: Download },
] as const;

const normalizeDraftForAuthoring = (draft: Draft): Draft => ({
  ...draft,
  sections: draft.sections.map((section) => ({
    ...section,
    content: normalizeLessonAuthoringContent(section.content || ""),
  })),
});

export default function CreateLesson() {
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);

  const [creationMode, setCreationMode] = useState<CreationMode>("ai_collab");
  const [importMode, setImportMode] = useState<ImportMode>("objectives");
  const [step, setStep] = useState<Step>("choose");
  const [inputText, setInputText] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [complexity, setComplexity] = useState(50);
  const [pacing, setPacing] = useState(50);
  const [scaffolding, setScaffolding] = useState(50);
  const [generationDepth, setGenerationDepth] = useState<GenerationDepth>("standard");
  const [languageStyle, setLanguageStyle] = useState<LanguageStyle>("student_friendly");
  const [audienceLanguage, setAudienceLanguage] = useState("English");
  const [versionCount, setVersionCount] = useState(1);
  const [designTemplateId, setDesignTemplateId] = useState("corporate");
  const [studioPanel, setStudioPanel] = useState<StudioPanel>("templates");
  const [variants, setVariants] = useState<AILessonDraft[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [genStep, setGenStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedKind, setUploadedKind] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "canvas" | "questions" | "glossary"
  >("overview");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [analysisInfo, setAnalysisInfo] = useState<{
    main_topic?: string;
    key_concepts?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSavedDraftContentRef = useRef<string | null>(null);
  const autosaveErrorShownRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DraftStoragePayload;
        if (parsed.draft) setDraft(normalizeDraftForAuthoring(parsed.draft));
        if (typeof parsed.inputText === "string") setInputText(parsed.inputText);
        if (typeof parsed.complexity === "number") setComplexity(parsed.complexity);
        if (typeof parsed.pacing === "number") setPacing(parsed.pacing);
        if (typeof parsed.scaffolding === "number") setScaffolding(parsed.scaffolding);
        if (parsed.generationDepth) setGenerationDepth(parsed.generationDepth);
        if (parsed.languageStyle) setLanguageStyle(parsed.languageStyle);
        if (parsed.audienceLanguage) setAudienceLanguage(parsed.audienceLanguage);
        if (typeof parsed.versionCount === "number") setVersionCount(parsed.versionCount);
        if (parsed.designTemplateId) setDesignTemplateId(parsed.designTemplateId);
        if (parsed.creationMode) setCreationMode(parsed.creationMode);
        if (parsed.importMode) setImportMode(parsed.importMode);
        if (parsed.activeTab) {
          setActiveTab(parsed.activeTab === "sections" ? "canvas" : parsed.activeTab);
        }
        if (parsed.savedAt) setDraftSavedAt(parsed.savedAt);
        const savedContent = { ...parsed };
        delete savedContent.savedAt;
        lastSavedDraftContentRef.current = JSON.stringify(savedContent);
      } catch {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeoutId = window.setTimeout(() => {
      const content: DraftStorageContent = {
        draft,
        inputText,
        complexity,
        pacing,
        scaffolding,
        generationDepth,
        languageStyle,
        audienceLanguage,
        versionCount,
        designTemplateId,
        creationMode,
        importMode,
        activeTab,
      };
      const serializedContent = JSON.stringify(content);
      if (serializedContent === lastSavedDraftContentRef.current) return;

      const savedAt = new Date().toISOString();
      try {
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ ...content, savedAt }),
        );
        lastSavedDraftContentRef.current = serializedContent;
        setDraftSavedAt(savedAt);
      } catch {
        if (!autosaveErrorShownRef.current) {
          toast.error("Local draft storage is full. Save the lesson to keep the latest changes.");
          autosaveErrorShownRef.current = true;
        }
      }
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeTab,
    audienceLanguage,
    complexity,
    creationMode,
    designTemplateId,
    draft,
    draftLoaded,
    generationDepth,
    importMode,
    inputText,
    languageStyle,
    pacing,
    scaffolding,
    versionCount,
  ]);

  const applyAiDraft = (ai: AILessonDraft) => {
    setDraft(normalizeDraftForAuthoring({
      title: ai.title || "",
      description: ai.description || "",
      objectives: ai.objectives?.length ? ai.objectives : ["", "", ""],
      estimated_duration: ai.estimated_duration || 45,
      prerequisites: ai.prerequisites || [],
      tags: ai.tags || [],
      sections: ai.sections?.length ? ai.sections : emptyDraft().sections,
      quiz_questions: ai.quiz_questions || [],
      glossary_terms: ai.glossary_terms || [],
      difficulty: "intermediate",
      subject: "",
    }));
  };

  const addDraftSection = (template: SectionTemplate = SECTION_TEMPLATES[0]) => {
    setDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          title: template.title,
          content: normalizeLessonAuthoringContent(template.content),
          content_type: template.contentType,
          duration_minutes: template.durationMinutes,
        },
      ],
    }));
  };

  const moveDraftSection = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
    setDraft({ ...draft, sections });
  };

  const duplicateDraftSection = (index: number) => {
    const source = draft.sections[index];
    setDraft({
      ...draft,
      sections: [
        ...draft.sections.slice(0, index + 1),
        { ...source, title: `${source.title} Copy` },
        ...draft.sections.slice(index + 1),
      ],
    });
  };

  const draftSummaryItems = useMemo(
    () => [
      { label: "Pages", value: draft.sections.length, hint: "Designed lesson blocks" },
      { label: "Questions", value: draft.quiz_questions.length, hint: "Assessment items" },
      { label: "Glossary", value: draft.glossary_terms.length, hint: "Vocabulary terms" },
      { label: "Duration", value: `${draft.estimated_duration || 0}m`, hint: "Expected time" },
    ],
    [
      draft.estimated_duration,
      draft.glossary_terms.length,
      draft.quiz_questions.length,
      draft.sections.length,
    ],
  );
  const selectedTemplateOption = useMemo(
    () => lessonTemplateOptions.find((template) => template.id === designTemplateId) ?? lessonTemplateOptions[0],
    [designTemplateId],
  );

  const renderStudioPanel = () => {
    if (studioPanel === "templates") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Templates</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Apply a lesson look</h2>
          </div>
          <div className="space-y-2">
            {lessonTemplateOptions.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setDesignTemplateId(template.id)}
                className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                  designTemplateId === template.id
                    ? "border-edsync-blue bg-edsync-blue/10 text-edsync-text"
                    : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/40"
                }`}
              >
                <p className="font-semibold text-edsync-text">{template.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5">{template.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (studioPanel === "blocks") {
      const practiceTemplateByPreset = {
        "classic-quiz": "exit-ticket",
        "speed-sprint": "practice-sprint",
        "matching-race": "flashcard-round",
        "mistake-retry": "practice-sprint",
        "scenario-challenge": "scenario-game",
      } as const;

      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Elements</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Add learning blocks</h2>
          </div>
          <button type="button" onClick={() => addDraftSection()} className="btn-primary w-full justify-center py-2 text-sm">
            Blank block
          </button>
          <div className="rounded-2xl border border-edsync-border bg-edsync-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Block types</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    addDraftSection({
                      ...SECTION_TEMPLATES[0],
                      id: `blank-${option.value}`,
                      label: option.label,
                      title: option.label,
                      contentType: option.value,
                    })
                  }
                  className="rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2 text-left text-xs font-bold text-edsync-text transition hover:border-edsync-blue/50 hover:bg-edsync-blue/5"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            {SECTION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => addDraftSection(template)}
                className="rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-left transition hover:border-edsync-blue/40 hover:bg-edsync-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-edsync-text">{template.label}</span>
                  <span className="rounded-full bg-edsync-blue/10 px-2 py-0.5 text-[10px] font-bold uppercase text-edsync-blue">
                    {template.contentType}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-edsync-subtle">{template.description}</p>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-edsync-border bg-edsync-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">Practice game blocks</p>
            <div className="mt-2 grid gap-2">
              {PRACTICE_GAME_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    addDraftSection(
                      SECTION_TEMPLATES.find(
                        (template) => template.id === practiceTemplateByPreset[preset.id as keyof typeof practiceTemplateByPreset],
                      ) ?? SECTION_TEMPLATES[0],
                    )
                  }
                  className="rounded-xl border border-edsync-border bg-edsync-surface p-3 text-left transition hover:border-edsync-amber/50"
                >
                  <span className="text-sm font-semibold text-edsync-text">{preset.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-edsync-subtle">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (studioPanel === "media") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Uploads</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Safe image and video inserts</h2>
          </div>
          <button type="button" onClick={() => addDraftSection(SECTION_TEMPLATES.find((item) => item.id === "media-analysis") ?? SECTION_TEMPLATES[0])} className="btn-primary w-full justify-center py-2 text-sm">
            Add media analysis
          </button>
          <div className="grid grid-cols-2 gap-2">
            {CREATOR_ASSET_CATEGORIES.filter((item) => ["photos", "videos", "audio", "frames", "mockups", "charts"].includes(item.id)).map((item) => {
              const Icon = item.id === "videos" || item.id === "audio" ? Film : ImageIcon;
              return (
                <div key={item.id} className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                  <Icon className="h-5 w-5 text-edsync-blue" />
                  <p className="mt-2 text-sm font-semibold text-edsync-text">{item.label}</p>
                  <p className="mt-1 text-xs text-edsync-subtle">{item.description}</p>
                </div>
              );
            })}
          </div>
          <p className="rounded-xl border border-edsync-border bg-edsync-surface p-3 text-xs leading-5 text-edsync-subtle">
            Unsafe SVG, script links, credentials, executable files, and unknown embeds stay blocked by the shared media validator.
          </p>
        </div>
      );
    }

    if (studioPanel === "text") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Text</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Readable page tools</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CREATOR_TEXT_STYLES.map((tool) => (
              <div key={tool.id} className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                <p className="text-sm font-semibold text-edsync-text">{tool.label}</p>
                <p className="mt-1 text-xs text-edsync-subtle">{tool.description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-edsync-border bg-edsync-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Quick inserts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SECTION_INSERT_TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={() =>
                    addDraftSection({
                      ...SECTION_TEMPLATES[0],
                      id: `text-${tool.label.toLowerCase()}`,
                      label: tool.label,
                      title: tool.label,
                      content: tool.content,
                      durationMinutes: 5,
                    })
                  }
                  className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5 text-xs font-bold text-edsync-subtle hover:border-edsync-blue/50 hover:text-edsync-blue"
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (studioPanel === "brand") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Brand</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Palette and tone</h2>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {CREATOR_PALETTE_SWATCHES.map((color) => (
              <span key={color} className="h-10 rounded-2xl border border-edsync-border shadow-sm" style={{ background: color }} />
            ))}
          </div>
          <p className="rounded-xl border border-edsync-border bg-edsync-surface p-3 text-xs leading-5 text-edsync-subtle">
            Current template: <strong className="text-edsync-text">{selectedTemplateOption?.label}</strong>. Template switching keeps the lesson content and reflows the visual treatment.
          </p>
        </div>
      );
    }

    if (studioPanel === "animate") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Animate</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Motion presets</h2>
          </div>
          {["Fade", "Rise", "Slide left", "Highlight", "Reduced motion fallback"].map((preset) => (
            <button key={preset} type="button" className="w-full rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-left text-sm font-semibold text-edsync-text hover:border-edsync-blue/40">
              {preset}
            </button>
          ))}
        </div>
      );
    }

    if (studioPanel === "ai") {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">AI co-creator</p>
            <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Generate into this design</h2>
          </div>
          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
            <p className="text-sm font-semibold text-edsync-text">Current design</p>
            <p className="mt-1 text-xs leading-5 text-edsync-subtle">
              {selectedTemplateOption?.label} with {generationDepth.replaceAll("_", " ")} depth, {languageStyle.replaceAll("_", " ")} tone, and {audienceLanguage} output.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("import")}
            className="btn-secondary w-full justify-center py-2 text-sm"
          >
            <Sparkles className="h-4 w-4" />
            Edit AI prompt
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!inputText.trim() && !uploadedFile}
            className="btn-primary w-full justify-center py-2 text-sm disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            Regenerate lesson
          </button>
          <div className="grid gap-2">
            {[
              "Create a shorter student-friendly version",
              "Add a Kahoot-style sprint block",
              "Convert the outline into slide pages",
              "Add rubric and feedback prompts",
            ].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setInputText((current) => `${current.trim()}\n\n${action}`.trim());
                  toast.success("Added to AI prompt.");
                }}
                className="rounded-xl border border-edsync-border bg-edsync-card p-3 text-left text-sm font-semibold text-edsync-text transition hover:border-edsync-blue/40"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Export</p>
          <h2 className="mt-1 font-display text-xl font-bold text-edsync-text">Preview and publish</h2>
        </div>
        <button type="button" className="btn-secondary w-full justify-center py-2 text-sm">
          <Play className="h-4 w-4" />
          Preview lesson
        </button>
        <div className="grid gap-2">
          {CREATOR_EXPORT_OPTIONS.map((option) => (
            <div key={option.id} className="rounded-xl border border-edsync-border bg-edsync-surface p-3">
              <p className="text-sm font-semibold text-edsync-text">{option.label}</p>
              <p className="mt-1 text-xs leading-5 text-edsync-subtle">{option.description}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => save("draft")} disabled={saving || !draft.title.trim()} className="btn-secondary w-full justify-center py-2 text-sm disabled:opacity-40">
          Save draft
        </button>
        <button type="button" onClick={() => save("published")} disabled={saving || !draft.title.trim()} className="btn-primary w-full justify-center py-2 text-sm disabled:opacity-40">
          Publish lesson
        </button>
      </div>
    );
  };

  const renderCanvasToolbar = () => (
    <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-edsync-border bg-edsync-card/95 p-2 shadow-xl shadow-slate-200/70 backdrop-blur dark:shadow-black/30">
      <button type="button" onClick={() => setStudioPanel("blocks")} className="btn-secondary h-9 px-3 text-xs">
        <AlignLeft className="h-4 w-4" />
      </button>
      <select
        value={selectedTemplateOption?.label ?? "Inter"}
        onChange={(event) => {
          const selected = lessonTemplateOptions.find((template) => template.label === event.target.value);
          if (selected) setDesignTemplateId(selected.id);
        }}
        className="h-9 min-w-32 rounded-xl border border-edsync-border bg-edsync-surface px-3 text-sm font-semibold text-edsync-text"
        aria-label="Lesson template"
      >
        {lessonTemplateOptions.map((template) => (
          <option key={template.id} value={template.label}>
            {template.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setDraft({ ...draft, estimated_duration: Math.max(5, draft.estimated_duration - 5) })} className="btn-secondary h-9 px-3 text-xs">
        -
      </button>
      <span className="flex h-9 min-w-14 items-center justify-center rounded-xl border border-edsync-border bg-edsync-surface px-3 text-sm font-bold text-edsync-text">
        {draft.estimated_duration || 0}m
      </span>
      <button type="button" onClick={() => setDraft({ ...draft, estimated_duration: draft.estimated_duration + 5 })} className="btn-secondary h-9 px-3 text-xs">
        +
      </button>
      {[
        { label: "Bold", icon: Bold, action: () => addDraftSection(SECTION_TEMPLATES.find((item) => item.id === "concept-brief") ?? SECTION_TEMPLATES[0]) },
        { label: "Italic", icon: Italic, action: () => setActiveTab("canvas") },
        { label: "Underline", icon: Underline, action: () => setActiveTab("canvas") },
        { label: "List", icon: List, action: () => addDraftSection(SECTION_TEMPLATES.find((item) => item.id === "guided-notes") ?? SECTION_TEMPLATES[0]) },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            title={item.label}
            className="btn-secondary h-9 px-3 text-xs"
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      <button type="button" onClick={() => setStudioPanel("animate")} className="btn-secondary h-9 px-3 text-xs">
        Animate
      </button>
      <button type="button" onClick={() => setStudioPanel("brand")} className="btn-secondary h-9 px-3 text-xs">
        Brand
      </button>
      <button type="button" onClick={() => setStudioPanel("ai")} className="btn-primary h-9 px-3 text-xs">
        <Sparkles className="h-4 w-4" />
        AI
      </button>
    </div>
  );

  const clearSavedDraft = () => {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    lastSavedDraftContentRef.current = null;
    autosaveErrorShownRef.current = false;
    setDraft(emptyDraft());
    setInputText("");
    setUploadedFile(null);
    setUploadedKind(null);
    setVariants([]);
    setAnalysisInfo(null);
    setDraftSavedAt(null);
    setActiveTab("overview");
    toast.success("Local draft cleared");
  };

  // ── File Upload ──────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);

    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch("/api/content/extract", {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      if (!response.ok || !data?.text) {
        throw new Error(data?.error || "Could not extract this file.");
      }

      setInputText(data.text);
      setUploadedKind(data.kind || null);
      if (data.warning) {
        toast(data.warning, { duration: 8000 });
      }
      toast.success(`"${file.name}" loaded and ready to generate`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read file");
      setUploadedFile(null);
      setUploadedKind(null);
    }
  };

  // ── AI Generation ────────────────────────────────────────────
  const handleGenerate = async () => {
    const content = inputText.trim();
    if (!content) {
      toast.error("Please provide content first");
      return;
    }

    setStep("generating");
    setGenStep(0);
    // Stagger the steps: analysis takes ~3s, generation takes ~10s
    const stepTimings = [0, 1200, 2800, 4500, 7000, 9000, 11000];
    const timers: ReturnType<typeof setTimeout>[] = [];
    stepTimings.forEach((delay, i) => {
      timers.push(setTimeout(() => setGenStep(i), delay));
    });

    try {
      const res = await fetch("/api/ai/create-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMode === "file" ? "text" : importMode,
          content,
          complexity,
          pacing,
          scaffolding,
          depth: generationDepth,
          languageStyle,
          audienceLanguage,
          versionCount,
          designTemplateId,
          outputLength:
            generationDepth === "quick"
              ? "micro"
              : generationDepth === "zero_to_expert"
                ? "extended"
                : "standard",
        }),
      });
      const data = await res.json();
      timers.forEach((t) => clearTimeout(t));
      setGenStep(GENERATION_STEPS.length - 1);

      if (!data.lesson) {
        toast.error(data.error || "Generation failed", { duration: 8000 });
        setStep("import");
        return;
      }

      if (typeof data.warning === "string" && data.warning.trim()) {
        toast(data.warning, { duration: 10000 });
      }

      // Store analysis metadata for display
      if (data.analysis) setAnalysisInfo(data.analysis);

      const generatedVariants = Array.isArray(data.variants)
        ? (data.variants as AILessonDraft[])
        : [data.lesson as AILessonDraft];
      setVariants(generatedVariants);
      setSelectedVariant(0);
      const ai = generatedVariants[0] || (data.lesson as AILessonDraft);
      setTimeout(() => {
        applyAiDraft(ai);
        setStep("edit");
      }, 400);
    } catch (err) {
      timers.forEach((t) => clearTimeout(t));
      toast.error(
        "Network error: " + (err instanceof Error ? err.message : String(err)),
        { duration: 8000 },
      );
      setStep("import");
    }
  };

  // ── Save to edsync ─────────────────────────────────────────
  const save = async (status: "draft" | "published") => {
    if (!draft.title.trim()) {
      toast.error("Please add a title");
      return;
    }
    setSaving(true);

    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { data: lesson, error } = await edsync
      .from("lessons")
      .insert({
        teacher_id: user.id,
        title: draft.title,
        description: draft.description,
        objectives: draft.objectives.filter(Boolean),
        status,
        estimated_duration: draft.estimated_duration,
        prerequisites: draft.prerequisites.filter(Boolean),
        tags: draft.tags.filter(Boolean),
        subject: draft.subject || null,
        difficulty: draft.difficulty,
        ai_generated: creationMode !== "manual",
        complexity_slider: complexity,
        pacing_slider: pacing,
        scaffolding_slider: scaffolding,
        personalization: {
          generationDepth,
          languageStyle,
          audienceLanguage,
          versionCount,
        },
      })
      .select()
      .single();

    if (error || !lesson) {
      toast.error("Failed to save: " + (error?.message ?? "unknown"));
      setSaving(false);
      return;
    }

    if (draft.sections.length > 0) {
      await edsync.from("lesson_sections").insert(
        draft.sections
          .filter((s) => s.title.trim())
          .map((s, idx) => ({
            lesson_id: lesson.id,
            title: s.title,
            content: s.content,
            content_type: s.content_type,
            order_index: idx,
            duration_minutes: s.duration_minutes,
          })),
      );
    }
    if (draft.quiz_questions.length > 0) {
      await edsync.from("quiz_questions").insert(
        draft.quiz_questions.map((q, idx) => ({
          lesson_id: lesson.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          explanation: q.explanation,
          difficulty: q.difficulty,
          is_diagnostic: q.is_diagnostic,
          is_micro_check: q.is_micro_check,
          is_final_quiz: q.is_final_quiz,
          order_index: idx,
        })),
      );
    }
    if (draft.glossary_terms.length > 0) {
      await edsync.from("glossary_terms").insert(
        draft.glossary_terms.map((t) => ({
          lesson_id: lesson.id,
          term: t.term,
          definition: t.definition,
          example: t.example,
        })),
      );
    }

    toast.success(
      status === "published" ? "Lesson published" : "Saved as draft",
    );
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    lastSavedDraftContentRef.current = null;
    autosaveErrorShownRef.current = false;
    router.push(`/teacher/lessons/${lesson.id}`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-[1600px] mx-auto animate-fade-in overflow-x-clip">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center gap-3 sm:gap-4 mb-6">
        <button
          onClick={() =>
            step === "choose"
              ? router.back()
              : setStep(
                  step === "edit"
                    ? creationMode === "manual"
                      ? "choose"
                      : "import"
                    : "choose",
                )
          }
          className="btn-ghost"
        >
          Back
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-edsync-text">
            Create Lesson
          </h1>
          <p className="text-edsync-subtle text-sm">
            {step === "choose"
              ? "Choose how you want to create your lesson"
              : step === "import"
                ? "Provide your source material"
                : step === "generating"
                  ? "AI is building your lesson..."
                  : "Review and edit your lesson"}
          </p>
        </div>
        {step === "edit" && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-edsync-subtle">
            <span className="rounded-full border border-edsync-border bg-edsync-card px-3 py-1">
              {draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft ready"}
            </span>
            <Link href="/teacher/lessons" className="btn-secondary px-3 py-1.5 text-xs">
              My Courses
            </Link>
            <Link href="/practice?mode=quiz&ai=1&task=generate-practice" className="btn-secondary px-3 py-1.5 text-xs">
              Generate practice
            </Link>
            <button type="button" onClick={clearSavedDraft} className="btn-secondary px-3 py-1.5 text-xs">
              Clear draft
            </button>
          </div>
        )}
      </div>

      {/* Step pill tracker */}
      {step !== "choose" && step !== "edit" && (
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          {[
            {
              key: "mode",
              label:
                creationMode === "manual"
                  ? "1 Manual"
                  : creationMode === "ai_full"
                    ? "1 Full AI"
                    : "1 AI Collab",
            },
            ...(creationMode !== "manual"
              ? [{ key: "import", label: "2 Import" }]
              : []),
            { key: "edit", label: creationMode === "manual" ? "2 Edit" : "3 Edit" },
          ].map((pill, i) => (
            <span
              key={pill.key}
              className={`px-3 py-1 rounded-full font-medium ${
                (step === "import" && i <= 1) ||
                (step === "generating" && i === 1)
                  ? "bg-edsync-blue text-white"
                  : "bg-edsync-card text-edsync-subtle border border-edsync-border"
              }`}
            >
              {pill.label}
            </span>
          ))}
          </div>
      )}

      {/* ── STEP: CHOOSE MODE ── */}
      {step === "choose" && (
        <div className="animate-slide-up rounded-[2rem] border border-edsync-border bg-edsync-card p-3 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-edsync-surface px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-edsync-blue">
                Lesson Creation Canvas
              </p>
              <h2 className="font-display text-xl font-bold text-edsync-text">
                Start with AI, a draft, or a blank canvas.
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-edsync-subtle">
              <span className="rounded-full border border-edsync-border bg-edsync-card px-3 py-1">
                Templates
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-card px-3 py-1">
                Pages
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-card px-3 py-1">
                Practice
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              mode: "ai_collab" as const,
              title: "AI draft",
              desc: "Generate a designed outline, then choose what to keep.",
              badge: "Recommended",
              badgeColor:
                "bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20",
            },
            {
              mode: "ai_full" as const,
              title: "Full AI",
              desc: "Build slides, quiz blocks, rubric, and review prompts.",
              badge: "Fastest",
              badgeColor:
                "bg-edsync-purple/10 text-edsync-purple border-edsync-purple/20",
            },
            {
              mode: "manual" as const,
              title: "Blank lesson",
              desc: "Open the Canva-style lesson canvas with no generated content.",
              badge: "Control",
              badgeColor:
                "bg-edsync-emerald/10 text-edsync-emerald border-edsync-emerald/20",
            },
          ].map((opt) => (
            <button
              key={opt.mode}
              onClick={() => {
                setCreationMode(opt.mode);
                if (opt.mode === "manual") {
                  setDraft(emptyDraft());
                  setStep("edit");
                } else setStep("import");
              }}
              className={`group min-h-44 w-full rounded-[1.5rem] border-2 bg-edsync-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                creationMode === opt.mode
                  ? "border-edsync-blue bg-edsync-blue/5"
                  : "border-edsync-border bg-edsync-card hover:border-edsync-muted"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-display font-bold text-edsync-text">
                      {opt.title}
                    </span>
                    <span className={`badge text-xs ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-edsync-subtle">
                    {opt.desc}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-edsync-blue transition group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
          </div>
        </div>
      )}

      {/* ── STEP: IMPORT ── */}
      {step === "import" && (
        <div className="animate-slide-up space-y-6">
          {/* Source type picker */}
          <div className="edsync-card">
            <h2 className="mb-4 font-display text-xl font-bold text-edsync-text">
              {creationMode === "ai_collab"
                ? "Starting point"
                : "Lesson source"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                {
                  mode: "objectives" as const,
                  label: "Objectives",
                  desc: "Learning goals",
                },
                {
                  mode: "text" as const,
                  label: "Text",
                  desc: "Notes or article",
                },
                {
                  mode: "url" as const,
                  label: "URL",
                  desc: "Web link",
                },
                {
                  mode: "file" as const,
                  label: "Upload",
                  desc: "Docs or media",
                },
              ].map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setImportMode(opt.mode);
                    if (opt.mode === "file") fileRef.current?.click();
                  }}
                  title={opt.desc}
                  className={`rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 ${
                    importMode === opt.mode
                      ? "border-edsync-blue bg-edsync-blue/10"
                      : "border-edsync-border bg-edsync-surface hover:border-edsync-muted"
                  }`}
                >
                  <p className="font-semibold text-sm text-edsync-text">
                    {opt.label}
                  </p>
                  <p className="text-xs text-edsync-subtle">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mp3,.wav"
              onChange={handleFileUpload}
              className="hidden"
            />

            {uploadedFile && (
              <div className="flex items-center gap-3 p-3 bg-edsync-emerald/5 border border-edsync-emerald/20 rounded-xl mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-edsync-text truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-edsync-subtle">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                    {uploadedKind ? ` • ${uploadedKind}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setUploadedFile(null);
                    setInputText("");
                  }}
                  className="text-edsync-subtle hover:text-edsync-red text-lg"
                >
                  ×
                </button>
              </div>
            )}

            {importMode !== "file" && (
              <>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    importMode === "objectives"
                      ? "Learning goals, standards, or outcomes..."
                      : importMode === "text"
                        ? "Paste notes, article text, or outline..."
                        : "https://example.com/source"
                  }
                  rows={8}
                  className="edsync-textarea"
                />
                <p className="text-xs text-edsync-subtle mt-1">
                  {inputText.length} characters
                </p>
              </>
            )}
          </div>

          {/* Differentiation sliders */}
          <div className="edsync-card">
            <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
              Differentiation Settings
            </h3>
            <div className="space-y-5">
              {[
                {
                  key: "complexity",
                  val: complexity,
                  set: setComplexity,
                  label: "Complexity",
                  left: "Basic",
                  right: "Advanced",
                  color: "#4F86F7",
                },
                {
                  key: "pacing",
                  val: pacing,
                  set: setPacing,
                  label: "Pacing",
                  left: "Slow",
                  right: "Brisk",
                  color: "#F5A623",
                },
                {
                  key: "scaffolding",
                  val: scaffolding,
                  set: setScaffolding,
                  label: "Scaffolding",
                  left: "Heavy",
                  right: "Independent",
                  color: "#23D18B",
                },
              ].map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-edsync-text">
                      {s.label}
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: s.color }}
                    >
                      {s.val}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={s.val}
                    onChange={(e) => s.set(Number(e.target.value))}
                    style={{ accentColor: s.color }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-edsync-subtle">
                    <span>{s.left}</span>
                    <span>{s.right}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="edsync-card">
            <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
              Teaching Style
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-edsync-subtle">
                  Lesson design
                </span>
                <select
                  value={designTemplateId}
                  onChange={(event) => setDesignTemplateId(event.target.value)}
                  className="edsync-input py-2"
                >
                  {lessonTemplateOptions.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-edsync-subtle">
                  Depth
                </span>
                <select
                  value={generationDepth}
                  onChange={(event) =>
                    setGenerationDepth(event.target.value as GenerationDepth)
                  }
                  className="edsync-input py-2"
                >
                  <option value="quick">Quick classroom draft</option>
                  <option value="standard">Balanced lesson</option>
                  <option value="zero_to_expert">Zero to expert</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-edsync-subtle">
                  Tone
                </span>
                <select
                  value={languageStyle}
                  onChange={(event) =>
                    setLanguageStyle(event.target.value as LanguageStyle)
                  }
                  className="edsync-input py-2"
                >
                  <option value="student_friendly">Student-friendly</option>
                  <option value="professional">Professional</option>
                  <option value="speaking">Speaking script</option>
                  <option value="simple">Simple language</option>
                </select>
              </label>
              <div className="block">
                <span className="sr-only">Response language</span>
                <details className="group relative">
                  <summary className="edsync-input flex cursor-pointer list-none items-center justify-between py-2 marker:hidden">
                    <span className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-edsync-blue" />
                      <span>{audienceLanguage}</span>
                    </span>
                    <span className="text-xs font-semibold text-edsync-subtle">Change</span>
                  </summary>
                  <div className="absolute z-40 mt-2 grid max-h-72 w-full grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-edsync-border bg-edsync-surface p-2 shadow-2xl shadow-slate-200/60 sm:grid-cols-2 dark:shadow-black/30">
                    {languageOptions.map((language) => (
                      <button
                        key={language}
                        type="button"
                        onClick={() => setAudienceLanguage(language)}
                        className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-edsync-blue/10 hover:text-edsync-blue ${
                          audienceLanguage === language ? "bg-edsync-blue/10 text-edsync-blue" : "text-edsync-text"
                        }`}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-edsync-subtle">
                  Versions
                </span>
                <select
                  value={versionCount}
                  onChange={(event) => setVersionCount(Number(event.target.value))}
                  className="edsync-input py-2"
                >
                  <option value={1}>1 version</option>
                  <option value={2}>2 versions</option>
                  <option value={3}>3 versions</option>
                </select>
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!inputText.trim() && !uploadedFile}
            className="btn-primary w-full justify-center py-4 text-base glow-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Generate Lesson with AI
          </button>
        </div>
      )}

      {/* ── STEP: GENERATING ── */}
      {step === "generating" && (
        <div className="flex items-center justify-center min-h-64 animate-fade-in">
          <div className="edsync-card p-6 sm:p-12 text-center max-w-sm w-full">
            <h2 className="font-display font-bold text-2xl text-edsync-text mb-2">
              Building Your Lesson
            </h2>
            <p className="text-edsync-subtle text-xs mb-6">
              AI is running in two passes — extracting knowledge, then
              generating rich content
            </p>
            <div className="space-y-2.5">
              {GENERATION_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 text-sm transition-all ${i <= genStep ? "text-edsync-text" : "text-edsync-subtle/30"}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      i < genStep
                        ? "bg-edsync-emerald/20 text-edsync-emerald"
                        : i === genStep
                          ? "bg-edsync-blue/20 text-edsync-blue animate-pulse"
                          : "bg-edsync-card"
                    }`}
                  >
                    {i < genStep ? "✓" : i === genStep ? "●" : "○"}
                  </span>
                  <span className="text-left leading-snug">{s}</span>
                </div>
              ))}
            </div>
            {genStep >= 2 && (
              <div className="mt-5 pt-4 border-t border-edsync-border">
                <p className="text-xs text-edsync-subtle">
                  {genStep < 4
                    ? "Phase 1: Content analysis complete, generating lesson pages..."
                    : "Phase 2: Writing quiz questions and glossary..."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: EDIT ── */}
      {step === "edit" && (
        <div className="animate-slide-up space-y-4 lg:h-[calc(100dvh-8rem)] lg:min-h-[720px]">
          <div className="grid gap-4 lg:h-full lg:grid-cols-[76px_300px_minmax(0,1fr)] lg:items-stretch">
            <aside className="order-2 flex gap-2 overflow-x-auto rounded-[1.75rem] border border-edsync-border bg-edsync-card p-2 shadow-sm lg:order-1 lg:h-full lg:flex-col lg:overflow-y-auto">
              {STUDIO_TOOL_RAIL.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setStudioPanel(tool.id)}
                    className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold transition ${
                      studioPanel === tool.id
                        ? "bg-edsync-blue text-white shadow-sm"
                        : "text-edsync-subtle hover:bg-edsync-surface hover:text-edsync-text"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </aside>
            <aside className="order-3 rounded-[1.75rem] border border-edsync-border bg-edsync-card p-4 shadow-sm lg:order-2 lg:h-full lg:overflow-y-auto">
              {renderStudioPanel()}
            </aside>
            <div className="order-1 min-w-0 rounded-[2rem] border border-edsync-border bg-edsync-surface p-3 shadow-inner lg:order-3 lg:h-full lg:overflow-hidden">
              <div className="min-w-0 space-y-5 rounded-[1.5rem] bg-edsync-bg p-3 sm:p-5 lg:h-full lg:overflow-y-auto">
          <div className="sticky top-0 z-10 mx-auto max-w-4xl pb-2">
            {renderCanvasToolbar()}
          </div>
          {variants.length > 1 && (
            <div className="edsync-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-edsync-text">
                    Generated versions
                  </h2>
                  <p className="text-sm text-edsync-subtle">
                    Switch drafts before saving. Each version keeps the same schema.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {variants.map((variant, index) => (
                  <button
                    key={`${variant.title}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedVariant(index);
                      applyAiDraft(variant);
                    }}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedVariant === index
                        ? "border-edsync-blue bg-edsync-blue/10"
                        : "border-edsync-border bg-edsync-surface hover:border-edsync-blue/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-edsync-text">
                      Version {index + 1}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-edsync-subtle">
                      {variant.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {creationMode !== "manual" && (
            <div className="p-3 bg-edsync-emerald/5 border border-edsync-emerald/20 rounded-xl text-sm text-edsync-emerald flex items-start gap-2">
              <div className="flex-1">
                <span className="font-medium">Lesson generated!</span> Review
                and customize below, then save or publish.
                {analysisInfo?.main_topic && (
                  <p className="text-edsync-emerald/70 text-xs mt-1 break-words">
                    Topic detected: <strong>{analysisInfo.main_topic}</strong>
                    {analysisInfo.key_concepts?.length
                      ? ` · Key concepts: ${analysisInfo.key_concepts.slice(0, 4).join(", ")}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {draftSummaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-edsync-border bg-edsync-card p-3 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-edsync-subtle">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-edsync-text">
                  {item.value}
                </p>
                <p className="text-xs text-edsync-subtle">{item.hint}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-edsync-border pb-0 overflow-x-auto -mx-1 px-1">
            {[
              { key: "overview" as const, label: "Overview" },
              {
                key: "canvas" as const,
                label: `Pages (${draft.sections.length})`,
              },
              {
                key: "questions" as const,
                label: `Quiz & Practice (${draft.quiz_questions.length})`,
              },
              {
                key: "glossary" as const,
                label: `Terms (${draft.glossary_terms.length})`,
              },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
                  activeTab === t.key
                    ? "border-edsync-blue text-edsync-blue"
                    : "border-transparent text-edsync-subtle hover:text-edsync-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-4">
                <div className="edsync-card">
                  <label className="block text-xs text-edsync-subtle mb-1 font-medium">
                    Lesson Title *
                  </label>
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    className="edsync-input font-display font-bold text-lg"
                    placeholder="Enter lesson title..."
                  />
                </div>
                <div className="edsync-card">
                  <label className="block text-xs text-edsync-subtle mb-1 font-medium">
                    Description
                  </label>
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    rows={3}
                    className="edsync-textarea"
                    placeholder="Brief overview for students..."
                  />
                </div>
                <div className="edsync-card">
                  <h3 className="font-semibold text-edsync-text mb-3">
                    Learning Objectives
                  </h3>
                  <div className="space-y-2">
                    {draft.objectives.map((obj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-edsync-blue font-bold text-sm w-5">
                          {i + 1}.
                        </span>
                        <input
                          value={obj}
                          onChange={(e) => {
                            const o = [...draft.objectives];
                            o[i] = e.target.value;
                            setDraft({ ...draft, objectives: o });
                          }}
                          className="edsync-input py-2 flex-1"
                          placeholder={`Objective ${i + 1}...`}
                        />
                        <button
                          onClick={() =>
                            setDraft({
                              ...draft,
                              objectives: draft.objectives.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                          className="text-edsync-subtle hover:text-edsync-red text-lg flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          objectives: [...draft.objectives, ""],
                        })
                      }
                      className="text-edsync-blue text-sm hover:underline"
                    >
                      + Add objective
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="edsync-card space-y-3">
                  <div>
                    <label className="block text-xs text-edsync-subtle mb-1">
                      Subject
                    </label>
                    <input
                      value={draft.subject}
                      onChange={(e) =>
                        setDraft({ ...draft, subject: e.target.value })
                      }
                      className="edsync-input py-2"
                      placeholder="e.g. Biology"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-edsync-subtle mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={draft.estimated_duration}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          estimated_duration: Number(e.target.value),
                        })
                      }
                      className="edsync-input py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-edsync-subtle mb-1">
                      Difficulty
                    </label>
                    <select
                      value={draft.difficulty}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          difficulty: e.target.value as DifficultyLevel,
                        })
                      }
                      className="edsync-input py-2"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-edsync-subtle mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      value={draft.tags.join(", ")}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      className="edsync-input py-2"
                      placeholder="biology, cells, photosynthesis"
                    />
                  </div>
                </div>
                {/* Differentiation sliders (read-only preview) */}
                {creationMode !== "manual" && (
                  <div className="edsync-card">
                    <h3 className="font-semibold text-edsync-text mb-3 text-sm">
                      Differentiation
                    </h3>
                    {[
                      {
                        label: "Complexity",
                        val: complexity,
                        color: "#4F86F7",
                      },
                      { label: "Pacing", val: pacing, color: "#F5A623" },
                      {
                        label: "Scaffolding",
                        val: scaffolding,
                        color: "#23D18B",
                      },
                    ].map((s) => (
                      <div key={s.label} className="mb-2">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-edsync-subtle">{s.label}</span>
                          <span style={{ color: s.color }}>{s.val}%</span>
                        </div>
                        <div className="h-1.5 bg-edsync-muted/20 rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s.val}%`, background: s.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAGES */}
          {activeTab === "canvas" && (
            <div className="space-y-5">
              {draft.sections.map((sec, i) => (
                <div key={i} className="overflow-hidden rounded-[2rem] border border-edsync-border bg-edsync-card shadow-card">
                  <div className="flex flex-wrap items-center gap-3 border-b border-edsync-border bg-edsync-surface p-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue/15 text-sm font-bold text-edsync-blue">
                      {i + 1}
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) => {
                        const ss = [...draft.sections];
                        ss[i] = { ...ss[i], title: e.target.value };
                        setDraft({ ...draft, sections: ss });
                      }}
                      className="min-w-[12rem] flex-1 rounded-2xl border border-edsync-border bg-edsync-card px-4 py-3 font-display text-base font-bold text-edsync-text outline-none transition focus:border-edsync-blue focus:ring-2 focus:ring-edsync-blue/20"
                      placeholder="Page title..."
                    />
                    <div className="flex rounded-2xl border border-edsync-border bg-edsync-card p-1">
                      {CONTENT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const ss = [...draft.sections];
                            ss[i] = { ...ss[i], content_type: option.value };
                            setDraft({ ...draft, sections: ss });
                          }}
                          title={option.label}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                            sec.content_type === option.value
                              ? "bg-edsync-blue text-white shadow-sm"
                              : "text-edsync-subtle hover:bg-edsync-blue/10 hover:text-edsync-blue"
                          }`}
                        >
                          {option.short}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center rounded-2xl border border-edsync-border bg-edsync-card p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const ss = [...draft.sections];
                          ss[i] = { ...ss[i], duration_minutes: Math.max(1, sec.duration_minutes - 1) };
                          setDraft({ ...draft, sections: ss });
                        }}
                        className="rounded-xl px-3 py-2 text-sm font-bold text-edsync-subtle hover:bg-edsync-blue/10 hover:text-edsync-blue"
                        aria-label="Decrease duration"
                      >
                        -
                      </button>
                      <span className="min-w-14 px-2 text-center text-sm font-bold text-edsync-text">{sec.duration_minutes}m</span>
                      <button
                        type="button"
                        onClick={() => {
                          const ss = [...draft.sections];
                          ss[i] = { ...ss[i], duration_minutes: sec.duration_minutes + 1 };
                          setDraft({ ...draft, sections: ss });
                        }}
                        className="rounded-xl px-3 py-2 text-sm font-bold text-edsync-subtle hover:bg-edsync-blue/10 hover:text-edsync-blue"
                        aria-label="Increase duration"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => moveDraftSection(i, -1)}
                      disabled={i === 0}
                      className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Up
                    </button>
                    <button
                      onClick={() => moveDraftSection(i, 1)}
                      disabled={i === draft.sections.length - 1}
                      className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Down
                    </button>
                    <button
                      onClick={() => duplicateDraftSection(i)}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          sections: draft.sections.filter((_, j) => j !== i),
                        })
                      }
                      className="rounded-xl px-3 py-2 text-sm font-bold text-edsync-subtle hover:bg-edsync-red/10 hover:text-edsync-red sm:ml-auto sm:flex-shrink-0"
                      aria-label="Delete lesson block"
                    >
                      ×
                    </button>
                  </div>
                  {/* Smart content editor per type */}
                  {sec.content_type === "image" ? (
                    (() => {
                      const [imgUrl, imgCaption] = (sec.content || "").split(
                        "|||",
                      );
                      const imagePreview = safeImageUrl(imgUrl);
                      return (
                        <div className="space-y-3 p-3">
                          <div className="p-3 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl text-xs text-edsync-blue">
                            <strong>Image block</strong> — Paste an image URL,
                            or upload an approved image in the editor.
                          </div>
                          <input
                            value={imgUrl || ""}
                            onChange={(e) => {
                              const ss = [...draft.sections];
                              ss[i] = {
                                ...ss[i],
                                content: `${e.target.value}|||${imgCaption || ""}`,
                              };
                              setDraft({ ...draft, sections: ss });
                            }}
                            className="edsync-input py-2 text-sm"
                            placeholder="https://... (image URL)"
                          />
                          <input
                            value={imgCaption || ""}
                            onChange={(e) => {
                              const ss = [...draft.sections];
                              ss[i] = {
                                ...ss[i],
                                content: `${imgUrl || ""}|||${e.target.value}`,
                              };
                              setDraft({ ...draft, sections: ss });
                            }}
                            className="edsync-input py-2 text-sm"
                            placeholder="Caption / description for students..."
                          />
                          {imagePreview && (
                            <Image
                              src={imagePreview}
                              alt="Preview"
                              width={960}
                              height={540}
                              sizes="(max-width: 768px) 100vw, 720px"
                              className="mt-1 h-auto max-h-48 w-full rounded-xl border border-edsync-border object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          {imgUrl && !imagePreview && (
                            <p className="rounded-lg border border-edsync-red/30 bg-edsync-red/10 px-3 py-2 text-xs text-edsync-red">
                              Use a safe HTTPS image ending in PNG, JPG, JPEG, WEBP, or GIF. SVG, scripts, credentials, and executable links are blocked.
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : sec.content_type === "video" ? (
                    (() => {
                      const [vidUrl, vidCaption] = (sec.content || "").split(
                        "|||",
                      );
                      const media = classifySafeMediaUrl(vidUrl);
                      return (
                        <div className="space-y-3 p-3">
                          <div className="p-3 bg-edsync-purple/5 border border-edsync-purple/20 rounded-xl text-xs text-edsync-purple">
                            <strong>Video block</strong> — Paste a
                            YouTube, Vimeo, or direct HTTPS video URL.
                          </div>
                          <input
                            value={vidUrl || ""}
                            onChange={(e) => {
                              const ss = [...draft.sections];
                              ss[i] = {
                                ...ss[i],
                                content: `${e.target.value}|||${vidCaption || ""}`,
                              };
                              setDraft({ ...draft, sections: ss });
                            }}
                            className="edsync-input py-2 text-sm"
                            placeholder="https://youtube.com/watch?v=..."
                          />
                          <input
                            value={vidCaption || ""}
                            onChange={(e) => {
                              const ss = [...draft.sections];
                              ss[i] = {
                                ...ss[i],
                                content: `${vidUrl || ""}|||${e.target.value}`,
                              };
                              setDraft({ ...draft, sections: ss });
                            }}
                            className="edsync-input py-2 text-sm"
                            placeholder="What this video covers..."
                          />
                          {media?.embedUrl && (
                            <div className="aspect-video rounded-xl overflow-hidden border border-edsync-border bg-black mt-1">
                              <iframe
                                src={media.embedUrl}
                                className="w-full h-full"
                                allowFullScreen
                                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                              />
                            </div>
                          )}
                          {media?.kind === "video" && !media.embedUrl && (
                            <video
                              src={media.url}
                              controls
                              className="mt-1 aspect-video w-full rounded-xl border border-edsync-border bg-black"
                            />
                          )}
                          {vidUrl && !media && (
                            <p className="rounded-lg border border-edsync-red/30 bg-edsync-red/10 px-3 py-2 text-xs text-edsync-red">
                              Use a safe HTTPS YouTube/Vimeo URL or direct MP4, WEBM, or MOV file. Scripts, SVG, credentials, and executable links are blocked.
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <LessonBlockEditor
                      value={sec.content || ""}
                      insertTools={SECTION_INSERT_TOOLS}
                      contentTypeLabel={
                        sec.content_type === "quiz"
                          ? "Quiz"
                          : sec.content_type === "activity"
                            ? "Activity"
                            : sec.content_type === "discussion"
                              ? "Discussion"
                              : "Lesson"
                      }
                      onChange={(value) => {
                          const ss = [...draft.sections];
                          ss[i] = { ...ss[i], content: value };
                          setDraft({ ...draft, sections: ss });
                        }}
                      placeholder={
                          sec.content_type === "quiz"
                            ? "Quiz title (questions are managed in the Questions tab)..."
                            : sec.content_type === "activity"
                              ? "Step-by-step activity instructions..."
                              : sec.content_type === "discussion"
                                ? "Discussion prompt or open-ended question..."
                                : "Write your lesson content here..."
                        }
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() => addDraftSection()}
                className="w-full rounded-[2rem] border-2 border-dashed border-edsync-border bg-edsync-card/60 py-5 text-sm font-bold text-edsync-subtle transition-all hover:border-edsync-blue hover:bg-edsync-blue/5 hover:text-edsync-blue"
              >
                Add lesson block
              </button>
            </div>
          )}

          {/* QUESTIONS */}
          {activeTab === "questions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Diagnostic",
                    count: draft.quiz_questions.filter((q) => q.is_diagnostic)
                      .length,
                    color: "purple",
                  },
                  {
                    label: "Micro-Check",
                    count: draft.quiz_questions.filter((q) => q.is_micro_check)
                      .length,
                    color: "cyan",
                  },
                  {
                    label: "Final Quiz",
                    count: draft.quiz_questions.filter((q) => q.is_final_quiz)
                      .length,
                    color: "amber",
                  },
                ].map((stat, i) => (
                  <div key={i} className="edsync-card py-3 px-4">
                    <p className="text-xs text-edsync-subtle">{stat.label}</p>
                    <p
                      className={`font-display font-bold text-2xl text-edsync-${stat.color}`}
                    >
                      {stat.count}
                    </p>
                  </div>
                ))}
              </div>
              {draft.quiz_questions.map((q, i) => (
                <div key={i} className="edsync-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2 flex-wrap">
                      {q.is_diagnostic && (
                        <span className="badge bg-edsync-purple/10 text-edsync-purple border-edsync-purple/20 text-xs">
                          Diagnostic
                        </span>
                      )}
                      {q.is_micro_check && (
                        <span className="badge bg-edsync-cyan/10 text-edsync-cyan border-edsync-cyan/20 text-xs">
                          Micro-Check
                        </span>
                      )}
                      {q.is_final_quiz && (
                        <span className="badge bg-edsync-amber/10 text-edsync-amber border-edsync-amber/20 text-xs">
                          Final Quiz
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          quiz_questions: draft.quiz_questions.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                      aria-label={`Remove question ${i + 1}`}
                      title="Remove question"
                      className="text-edsync-subtle hover:text-edsync-red text-lg leading-none px-2"
                    >
                      ×
                    </button>
                  </div>
                  <p className="font-medium text-edsync-text text-sm mb-3">
                    {i + 1}. {q.question_text}
                  </p>
                  {q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`text-xs px-3 py-2 rounded-lg break-words ${opt.is_correct ? "bg-edsync-emerald/10 text-edsync-emerald border border-edsync-emerald/20" : "bg-edsync-muted/20 text-edsync-subtle"}`}
                        >
                          {opt.is_correct && "✓ "}
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-edsync-subtle mt-2 italic">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}
              {draft.quiz_questions.length === 0 && (
                <div className="edsync-card text-center py-8">
                  <p className="text-edsync-subtle text-sm">
                    No questions yet.{" "}
                    {creationMode !== "manual"
                      ? "Re-generate with AI or add manually."
                      : "Add questions below."}
                  </p>
                </div>
              )}
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    quiz_questions: [
                      ...draft.quiz_questions,
                      {
                        question_text: "New question",
                        question_type: "multiple_choice",
                        options: [
                          { id: "a", text: "Option A", is_correct: false },
                          {
                            id: "b",
                            text: "Option B (correct)",
                            is_correct: true,
                          },
                          { id: "c", text: "Option C", is_correct: false },
                          { id: "d", text: "Option D", is_correct: false },
                        ],
                        explanation: "",
                        difficulty: "intermediate",
                        is_diagnostic: false,
                        is_micro_check: false,
                        is_final_quiz: true,
                      },
                    ],
                  })
                }
                className="w-full py-3 border-2 border-dashed border-edsync-border rounded-2xl text-edsync-subtle hover:border-edsync-blue hover:text-edsync-blue transition-all text-sm"
              >
                + Add Question
              </button>
            </div>
          )}

          {/* GLOSSARY */}
          {activeTab === "glossary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {draft.glossary_terms.map((term, i) => (
                  <div key={i} className="edsync-card">
                    <div className="flex items-start justify-between mb-2">
                      <input
                        value={term.term}
                        onChange={(e) => {
                          const gt = [...draft.glossary_terms];
                          gt[i] = { ...gt[i], term: e.target.value };
                          setDraft({ ...draft, glossary_terms: gt });
                        }}
                        className="edsync-input py-1.5 font-bold text-edsync-text flex-1 mr-2"
                        placeholder="Term..."
                      />
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            glossary_terms: draft.glossary_terms.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                        className="text-edsync-subtle hover:text-edsync-red text-lg flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={term.definition}
                      onChange={(e) => {
                        const gt = [...draft.glossary_terms];
                        gt[i] = { ...gt[i], definition: e.target.value };
                        setDraft({ ...draft, glossary_terms: gt });
                      }}
                      rows={2}
                      className="edsync-textarea text-xs mb-2"
                      placeholder="Definition..."
                    />
                    <input
                      value={term.example}
                      onChange={(e) => {
                        const gt = [...draft.glossary_terms];
                        gt[i] = { ...gt[i], example: e.target.value };
                        setDraft({ ...draft, glossary_terms: gt });
                      }}
                      className="edsync-input py-1.5 text-xs"
                      placeholder="Example usage..."
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    glossary_terms: [
                      ...draft.glossary_terms,
                      { term: "", definition: "", example: "" },
                    ],
                  })
                }
                className="w-full py-3 border-2 border-dashed border-edsync-border rounded-2xl text-edsync-subtle hover:border-edsync-blue hover:text-edsync-blue transition-all text-sm"
              >
                + Add Term
              </button>
            </div>
          )}

          {/* Save Actions — sticky bottom */}
          <div className="rounded-3xl border border-edsync-border bg-edsync-card p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Pages</p>
                <p className="text-sm text-edsync-subtle">Click a block to jump back into editing. Drag reorder comes next.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-edsync-subtle">
                <span>Fit width</span>
                <span className="rounded-full bg-edsync-surface px-2 py-1">{draft.sections.length || 0} pages</span>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {draft.sections.map((section, index) => (
                <button
                  key={`${section.title}-${index}`}
                  type="button"
                  onClick={() => setActiveTab("canvas")}
                  className="min-w-36 rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-left transition hover:border-edsync-blue/40 hover:bg-edsync-card"
                >
                  <span className="text-xs font-bold text-edsync-blue">{index + 1}</span>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-edsync-text">{section.title || "Untitled"}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-edsync-subtle">
                    {section.content_type} - {section.duration_minutes}m
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="sticky bottom-3 pt-4 border-t border-edsync-border bg-edsync-bg">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => save("draft")}
                disabled={saving || !draft.title.trim()}
                className="btn-secondary flex-1 justify-center py-3.5 disabled:opacity-40"
              >
                Save as Draft
              </button>
              <button
                onClick={() => save("published")}
                disabled={saving || !draft.title.trim()}
                className="btn-primary flex-1 justify-center py-3.5 glow-blue disabled:opacity-40"
              >
                {saving ? "Saving..." : "Publish Lesson"}
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
