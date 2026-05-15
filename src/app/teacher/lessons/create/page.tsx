"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Languages } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import { safeVideoEmbedUrl } from "@/lib/security/media";
import type { AILessonDraft, ContentType, DifficultyLevel } from "@/types";

// ─── Types ────────────────────────────────────────────────────
type CreationMode = "ai_collab" | "ai_full" | "manual";
type ImportMode = "objectives" | "text" | "url" | "file";
type Step = "choose" | "import" | "generating" | "edit";
type GenerationDepth = "quick" | "standard" | "zero_to_expert";
type LanguageStyle = "student_friendly" | "professional" | "speaking" | "simple";

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
  "Designing lesson framework and section types...",
  "Writing section content (text, video, image)...",
  "Generating quiz questions (diagnostic, micro-checks, final)...",
  "Building glossary from key terms...",
  "Organizing and finalizing lesson...",
];

// ─── Main Component ───────────────────────────────────────────
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
  const [variants, setVariants] = useState<AILessonDraft[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [genStep, setGenStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedKind, setUploadedKind] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "sections" | "questions" | "glossary"
  >("overview");
  const [analysisInfo, setAnalysisInfo] = useState<{
    main_topic?: string;
    key_concepts?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyAiDraft = (ai: AILessonDraft) => {
    setDraft({
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
    });
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
    router.push(`/teacher/lessons/${lesson.id}`);
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto animate-fade-in overflow-x-clip">
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
          ← Back
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-edsync-text">
            Lesson Creation Studio
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
      </div>

      {/* Step pill tracker */}
      {step !== "choose" && (
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          {[
            {
              key: "mode",
              label:
                creationMode === "manual"
                  ? "Manual"
                  : creationMode === "ai_full"
                    ? "Full AI"
                    : "AI Collab",
            },
            ...(creationMode !== "manual"
              ? [{ key: "import", label: "Import" }]
              : []),
            { key: "edit", label: "Edit" },
          ].map((pill, i) => (
            <span
              key={pill.key}
              className={`px-3 py-1 rounded-full font-medium ${
                (step === "import" && i <= 1) ||
                (step === "edit" && i <= 2) ||
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
        <div className="space-y-4 animate-slide-up">
          <p className="text-edsync-text font-medium mb-6">
            How would you like to create this lesson?
          </p>
          {[
            {
              mode: "ai_collab" as const,
              title: "AI + Teacher Collaboration",
              desc: "AI generates a structured lesson draft. You review, edit, and refine every section to make it yours.",
              badge: "Recommended",
              badgeColor:
                "bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20",
            },
            {
              mode: "ai_full" as const,
              title: "Fully AI-Generated",
              desc: "AI creates a complete, ready-to-publish lesson. Review and approve before going live.",
              badge: "Fastest",
              badgeColor:
                "bg-edsync-purple/10 text-edsync-purple border-edsync-purple/20",
            },
            {
              mode: "manual" as const,
              title: "Create from Scratch",
              desc: "Build your lesson entirely yourself. Full creative control with no AI involvement.",
              badge: "Full Control",
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
              className={`w-full p-5 rounded-2xl border-2 text-left transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${
                creationMode === opt.mode
                  ? "border-edsync-blue bg-edsync-blue/5"
                  : "border-edsync-border bg-edsync-card hover:border-edsync-muted"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-bold text-edsync-text">
                      {opt.title}
                    </span>
                    <span className={`badge text-xs ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-edsync-subtle text-sm">{opt.desc}</p>
                </div>
                <span className="text-edsync-blue text-lg mt-1">→</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── STEP: IMPORT ── */}
      {step === "import" && (
        <div className="animate-slide-up space-y-6">
          {/* Source type picker */}
          <div className="edsync-card">
            <h2 className="font-display font-bold text-xl text-edsync-text mb-2">
              {creationMode === "ai_collab"
                ? "Give AI a starting point"
                : "What should the AI base your lesson on?"}
            </h2>
            <p className="text-edsync-subtle text-sm mb-5">
              AI will use this to generate your lesson structure.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                {
                  mode: "objectives" as const,
                  label: "Objectives",
                  desc: "Describe what students learn",
                },
                {
                  mode: "text" as const,
                  label: "Paste Text",
                  desc: "Article, notes, or content",
                },
                {
                  mode: "url" as const,
                  label: "URL",
                  desc: "Paste a web link",
                },
                {
                  mode: "file" as const,
                  label: "Upload Media",
                  desc: "Docs, data, image, video",
                },
              ].map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setImportMode(opt.mode);
                    if (opt.mode === "file") fileRef.current?.click();
                  }}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
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
                      ? 'e.g. "Students will understand photosynthesis including light-dependent and light-independent reactions. They should be able to explain how plants convert sunlight to energy and identify the role of chlorophyll."'
                      : importMode === "text"
                        ? "Paste your article, notes, textbook excerpt, or any content here..."
                        : "https://example.com/article-to-use-as-lesson-basis"
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
                    ? "Phase 1: Content analysis complete, generating sections..."
                    : "Phase 2: Writing quiz questions and glossary..."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: EDIT ── */}
      {step === "edit" && (
        <div className="animate-slide-up space-y-6">
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

          {/* Tabs */}
          <div className="flex gap-2 border-b border-edsync-border pb-0 overflow-x-auto -mx-1 px-1">
            {[
              { key: "overview" as const, label: "Overview" },
              {
                key: "sections" as const,
                label: `Sections (${draft.sections.length})`,
              },
              {
                key: "questions" as const,
                label: `Questions (${draft.quiz_questions.length})`,
              },
              {
                key: "glossary" as const,
                label: `Glossary (${draft.glossary_terms.length})`,
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

          {/* SECTIONS */}
          {activeTab === "sections" && (
            <div className="space-y-4">
              {draft.sections.map((sec, i) => (
                <div key={i} className="edsync-card">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-lg bg-edsync-blue/20 text-edsync-blue text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) => {
                        const ss = [...draft.sections];
                        ss[i] = { ...ss[i], title: e.target.value };
                        setDraft({ ...draft, sections: ss });
                      }}
                      className="edsync-input py-2 flex-1 min-w-[12rem] font-semibold"
                      placeholder="Section title..."
                    />
                    <select
                      value={sec.content_type}
                      onChange={(e) => {
                        const ss = [...draft.sections];
                        ss[i] = {
                          ...ss[i],
                          content_type: e.target.value as ContentType,
                        };
                        setDraft({ ...draft, sections: ss });
                      }}
                      className="edsync-input py-2 w-full sm:w-36 text-sm sm:flex-shrink-0"
                    >
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="quiz">Quiz</option>
                      <option value="activity">Activity</option>
                      <option value="discussion">Discussion</option>
                    </select>
                    <input
                      type="number"
                      value={sec.duration_minutes}
                      min={1}
                      onChange={(e) => {
                        const ss = [...draft.sections];
                        ss[i] = {
                          ...ss[i],
                          duration_minutes: Number(e.target.value),
                        };
                        setDraft({ ...draft, sections: ss });
                      }}
                      className="edsync-input py-2 w-full sm:w-24 text-sm sm:flex-shrink-0"
                      placeholder="min"
                      title="Duration (minutes)"
                    />
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          sections: draft.sections.filter((_, j) => j !== i),
                        })
                      }
                      className="text-edsync-subtle hover:text-edsync-red text-sm sm:text-lg sm:flex-shrink-0 sm:ml-auto"
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
                      return (
                        <div className="space-y-2">
                          <div className="p-3 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl text-xs text-edsync-blue">
                            <strong>Image Section</strong> — Paste an image URL,
                            or use the search term below to find one
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
                          {imgUrl && imgUrl.startsWith("http") && (
                            <img
                              src={imgUrl}
                              alt="Preview"
                              className="w-full max-h-48 object-contain rounded-xl border border-edsync-border mt-1"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                        </div>
                      );
                    })()
                  ) : sec.content_type === "video" ? (
                    (() => {
                      const [vidUrl, vidCaption] = (sec.content || "").split(
                        "|||",
                      );
                      const embed = safeVideoEmbedUrl(vidUrl);
                      return (
                        <div className="space-y-2">
                          <div className="p-3 bg-edsync-purple/5 border border-edsync-purple/20 rounded-xl text-xs text-edsync-purple">
                            <strong>Video Section</strong> — Paste a
                            YouTube/Vimeo URL
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
                          {embed && (
                            <div className="aspect-video rounded-xl overflow-hidden border border-edsync-border bg-black mt-1">
                              <iframe
                                src={embed}
                                className="w-full h-full"
                                allowFullScreen
                              />
                            </div>
                          )}
                          {vidUrl &&
                            !embed &&
                            vidUrl.includes("youtube.com/results") && (
                              <a
                                href={vidUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-edsync-blue hover:underline block mt-1"
                              >
                                Search YouTube for this topic →
                              </a>
                            )}
                        </div>
                      );
                    })()
                  ) : (
                    <textarea
                      value={sec.content || ""}
                      onChange={(e) => {
                        const ss = [...draft.sections];
                        ss[i] = { ...ss[i], content: e.target.value };
                        setDraft({ ...draft, sections: ss });
                      }}
                      rows={6}
                      className="edsync-textarea text-sm"
                      placeholder={
                        sec.content_type === "quiz"
                          ? "Quiz title (questions are managed in the Questions tab)..."
                          : sec.content_type === "activity"
                            ? "Step-by-step activity instructions..."
                            : sec.content_type === "discussion"
                              ? "Discussion prompt or open-ended question..."
                              : "Write your section content here..."
                      }
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    sections: [
                      ...draft.sections,
                      {
                        title: "New Section",
                        content: "",
                        content_type: "text",
                        duration_minutes: 5,
                      },
                    ],
                  })
                }
                className="w-full py-4 border-2 border-dashed border-edsync-border rounded-2xl text-edsync-subtle hover:border-edsync-blue hover:text-edsync-blue transition-all text-sm"
              >
                + Add Section
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
      )}
    </div>
  );
}
