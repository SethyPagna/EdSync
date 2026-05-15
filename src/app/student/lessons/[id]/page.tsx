"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import { sanitizeHtml } from "@/lib/security/html";
import type {
  Lesson,
  LessonSection,
  QuizQuestion,
  StudentProgress,
  ChatMessage,
  GlossaryTerm,
} from "@/types";
import toast from "react-hot-toast";

type Phase =
  | "loading"
  | "diagnostic"
  | "learning"
  | "quiz_section"
  | "micro_check"
  | "final_quiz"
  | "reflection"
  | "choose_path"
  | "extended_learning"
  | "complete";

type ReflectionAdvice = {
  strengths: string[];
  likelyGaps: string[];
  nextSteps: string[];
  guidingQuestion: string;
  encouragement: string;
};

type ExtendedQuizOption = {
  text: string;
  is_correct: boolean;
};

type ExtendedQuizQuestion = {
  question: string;
  options: ExtendedQuizOption[];
};

type ExtendedLearningPayload = {
  topic?: unknown;
  content?: unknown;
  quiz?: unknown;
};

function isExtendedQuizQuestion(value: unknown): value is ExtendedQuizQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const question = (value as { question?: unknown }).question;
  const options = (value as { options?: unknown }).options;
  return (
    typeof question === "string" &&
    Array.isArray(options) &&
    options.length >= 2 &&
    options.every(
      (option) =>
        option &&
        typeof option === "object" &&
        !Array.isArray(option) &&
        typeof (option as { text?: unknown }).text === "string" &&
        typeof (option as { is_correct?: unknown }).is_correct === "boolean",
    )
  );
}

type ReflectionRecord = {
  id: string;
  created_at: string;
  section_title: string;
  notes: string;
  confidence: number;
  advice: ReflectionAdvice;
};

function stripHtmlTags(content: string) {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeLessonHtml(content: string) {
  return sanitizeHtml(content);
}

// ── Content renderers ──────────────────────────────────────────

function renderContent(html: string) {
  // If it looks like HTML use dangerouslySetInnerHTML, otherwise treat as plain text
  const isHtml = html.includes("<");
  if (isHtml) {
    const safeHtml = sanitizeLessonHtml(html);
    return (
      <div
        className="lesson-prose"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }
  // Preserve line-based formatting so text-only diagrams and lists stay readable.
  return <div className="lesson-prose whitespace-pre-line">{html}</div>;
}

function TextContent({ content }: { content: string }) {
  return <div className="py-2">{renderContent(content)}</div>;
}

function ImageContent({ content, title }: { content: string; title: string }) {
  const [imgUrl, caption] = content.split("|||");
  if (!imgUrl)
    return (
      <div className="py-4 text-center text-edsync-subtle">
        <p className="text-sm">Image content — no URL set</p>
      </div>
    );
  return (
    <div className="py-2">
      <Image
        src={imgUrl}
        alt={caption || title}
        width={1200}
        height={675}
        sizes="(max-width: 768px) 100vw, 960px"
        className="h-auto max-h-[500px] w-full rounded-xl border border-edsync-border object-contain"
      />
      {caption && (
        <p className="text-sm text-edsync-subtle text-center mt-2 italic">
          {caption}
        </p>
      )}
    </div>
  );
}

function VideoContent({ content }: { content: string }) {
  const [rawUrl, caption] = content.split("|||");
  const getEmbed = (raw: string) => {
    const ytMatch = raw.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vmMatch = raw.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
    return raw;
  };
  const embed = rawUrl ? getEmbed(rawUrl) : "";
  const isEmbeddable =
    embed.includes("youtube.com/embed") || embed.includes("vimeo.com/video");

  if (!rawUrl)
    return (
      <div className="py-4 text-center text-edsync-subtle">
        <p className="text-sm">No video URL set</p>
      </div>
    );
  return (
    <div className="py-2">
      {isEmbeddable ? (
        <div className="aspect-video rounded-xl overflow-hidden border border-edsync-border bg-black">
          <iframe
            src={embed}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
          />
        </div>
      ) : (
        <a
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-edsync-surface border border-edsync-border rounded-xl hover:border-edsync-blue transition-colors"
        >
          <div>
            <p className="font-medium text-edsync-text">Watch Video</p>
            <p className="text-xs text-edsync-subtle truncate">{rawUrl}</p>
          </div>
        </a>
      )}
      {caption && (
        <p className="text-sm text-edsync-subtle text-center mt-2 italic">
          {caption}
        </p>
      )}
    </div>
  );
}

function ActivityContent({ content }: { content: string }) {
  return (
    <div className="py-2">
      <div className="p-4 bg-edsync-emerald/5 border border-edsync-emerald/20 rounded-xl mb-3">
        <p className="text-xs text-edsync-emerald font-semibold mb-1">
          ACTIVITY
        </p>
      </div>
      {renderContent(content)}
    </div>
  );
}

function DiscussionContent({ content }: { content: string }) {
  const [response, setResponse] = useState("");
  return (
    <div className="py-2">
      <div className="p-4 bg-edsync-purple/5 border border-edsync-purple/20 rounded-xl mb-4">
        <p className="text-xs text-edsync-purple font-semibold mb-2">
          DISCUSSION PROMPT
        </p>
        {renderContent(content)}
      </div>
      <div>
        <label className="block text-sm font-medium text-edsync-text mb-2">
          Your thoughts (optional):
        </label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          className="edsync-textarea text-sm"
          placeholder="Share your thoughts..."
        />
      </div>
    </div>
  );
}

// ── Answer component for each question type ────────────────────
type AnswerState = { [questionId: string]: string };

function QuestionItem({
  q,
  answers,
  setAnswers,
  submitted,
  index,
}: {
  q: QuizQuestion;
  answers: AnswerState;
  setAnswers: (a: AnswerState) => void;
  submitted: boolean;
  index: number;
}) {
  const ans = answers[q.id] || "";
  const setAns = (val: string) =>
    !submitted && setAnswers({ ...answers, [q.id]: val });

  const isCorrect = () => {
    if (
      q.question_type === "multiple_choice" ||
      q.question_type === "true_false"
    ) {
      return q.options?.find((o) => o.id === ans)?.is_correct === true;
    }
    if (q.question_type === "fill_blank") {
      return (
        (q.correct_answer || "").toLowerCase().trim() ===
        ans.toLowerCase().trim()
      );
    }
    return true; // short/long answer always "accepted"
  };
  const correct = submitted && isCorrect();
  const wrong =
    submitted &&
    !isCorrect() &&
    q.question_type !== "short_answer" &&
    q.question_type !== "long_answer";

  return (
    <div
      className={`edsync-card transition-all ${submitted && correct ? "border-edsync-emerald/40" : submitted && wrong ? "border-edsync-red/40" : ""}`}
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-edsync-blue/20 text-edsync-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {q.is_diagnostic && (
              <span className="badge bg-edsync-purple/10 text-edsync-purple border-edsync-purple/20 text-xs">
                Pre-check
              </span>
            )}
            {q.is_micro_check && (
              <span className="badge bg-edsync-cyan/10 text-edsync-cyan border-edsync-cyan/20 text-xs">
                Check
              </span>
            )}
            {q.is_final_quiz && (
              <span className="badge bg-edsync-amber/10 text-edsync-amber border-edsync-amber/20 text-xs">
                Final
              </span>
            )}
          </div>
          <p className="font-medium text-edsync-text text-sm leading-relaxed">
            {q.question_text}
          </p>
        </div>
        {submitted && (
          <span
            className={`text-lg flex-shrink-0 ${correct ? "text-edsync-emerald" : wrong ? "text-edsync-red" : "text-edsync-amber"}`}
          >
            {correct ? "✓" : wrong ? "✗" : ""}
          </span>
        )}
      </div>

      {/* Multiple choice */}
      {(q.question_type === "multiple_choice" ||
        q.question_type === "true_false") &&
        q.options && (
          <div className="space-y-2">
            {q.options.map((opt) => {
              const selected = ans === opt.id;
              const showCorrect = submitted && opt.is_correct;
              const showWrong = submitted && selected && !opt.is_correct;
              return (
                <button
                  key={opt.id}
                  onClick={() => setAns(opt.id)}
                  disabled={submitted}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center gap-3 ${
                    showCorrect
                      ? "bg-edsync-emerald/10 border-edsync-emerald text-edsync-emerald"
                      : showWrong
                        ? "bg-edsync-red/10 border-edsync-red text-edsync-red"
                        : selected
                          ? "bg-edsync-blue/10 border-edsync-blue text-edsync-text"
                          : submitted
                            ? "bg-edsync-surface border-edsync-border text-edsync-subtle cursor-default"
                            : "bg-edsync-surface border-edsync-border text-edsync-subtle hover:border-edsync-muted hover:text-edsync-text"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      showCorrect
                        ? "border-edsync-emerald bg-edsync-emerald text-white"
                        : showWrong
                          ? "border-edsync-red bg-edsync-red text-white"
                          : selected
                            ? "border-edsync-blue bg-edsync-blue text-white"
                            : "border-edsync-border"
                    }`}
                  >
                    {showCorrect
                      ? "✓"
                      : showWrong
                        ? "✗"
                        : selected
                          ? "●"
                          : opt.id.toUpperCase()}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}

      {/* Fill in the blank */}
      {q.question_type === "fill_blank" && (
        <div>
          <input
            value={ans}
            onChange={(e) => setAns(e.target.value)}
            disabled={submitted}
            className={`edsync-input py-2 text-sm ${submitted && correct ? "border-edsync-emerald bg-edsync-emerald/10 text-edsync-emerald" : submitted && !correct ? "border-edsync-red bg-edsync-red/10 text-edsync-red" : ""}`}
            placeholder="Type your answer..."
          />
          {submitted && q.correct_answer && (
            <p className="text-xs text-edsync-emerald mt-1">
              ✓ Answer: <span className="font-medium">{q.correct_answer}</span>
            </p>
          )}
        </div>
      )}

      {/* Short answer */}
      {q.question_type === "short_answer" && (
        <div>
          <textarea
            value={ans}
            onChange={(e) => setAns(e.target.value)}
            disabled={submitted}
            rows={3}
            className="edsync-textarea text-sm"
            placeholder="Write your answer (2-4 sentences)..."
          />
          {submitted && q.correct_answer && (
            <div className="mt-2 p-3 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl">
              <p className="text-xs text-edsync-blue font-medium mb-1">
                Key points
              </p>
              <p className="text-xs text-edsync-subtle">{q.correct_answer}</p>
            </div>
          )}
        </div>
      )}

      {/* Long answer */}
      {q.question_type === "long_answer" && (
        <div>
          <textarea
            value={ans}
            onChange={(e) => setAns(e.target.value)}
            disabled={submitted}
            rows={6}
            className="edsync-textarea text-sm"
            placeholder="Write a detailed response..."
          />
          {submitted && q.correct_answer && (
            <div className="mt-2 p-3 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl">
              <p className="text-xs text-edsync-blue font-medium mb-1">
                Rubric / Criteria
              </p>
              <p className="text-xs text-edsync-subtle">{q.correct_answer}</p>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      {submitted && q.explanation && (
        <div className="mt-3 p-3 bg-edsync-muted/20 border border-edsync-border rounded-xl">
          <p className="text-xs font-medium text-edsync-blue mb-0.5">
            Explanation
          </p>
          <p className="text-xs text-edsync-subtle">{q.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Quiz section renderer ──────────────────────────────────────
function QuizSection({
  questions,
  title,
  onComplete,
}: {
  questions: QuizQuestion[];
  title: string;
  onComplete: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const allAnswered = questions.every((q) => answers[q.id]);

  const submit = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (
        q.question_type === "multiple_choice" ||
        q.question_type === "true_false"
      ) {
        if (q.options?.find((o) => o.id === answers[q.id])?.is_correct)
          correct++;
      } else if (q.question_type === "fill_blank") {
        if (
          (q.correct_answer || "").toLowerCase().trim() ===
          (answers[q.id] || "").toLowerCase().trim()
        )
          correct++;
      } else {
        correct++; // short/long always counted
      }
    });
    const sc =
      questions.length > 0
        ? Math.round((correct / questions.length) * 100)
        : 100;
    setScore(sc);
    setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-edsync-amber/5 border border-edsync-amber/20 rounded-xl">
        <p className="text-sm font-semibold text-edsync-amber">
          {title || "Quiz"}
        </p>
      </div>
      {questions.map((q, i) => (
        <QuestionItem
          key={q.id}
          q={q}
          answers={answers}
          setAnswers={setAnswers}
          submitted={submitted}
          index={i}
        />
      ))}
      {!submitted ? (
        <button
          onClick={submit}
          disabled={!allAnswered}
          className="btn-primary w-full justify-center py-3.5 disabled:opacity-40"
        >
          Submit Answers →
        </button>
      ) : (
        <div className="edsync-card text-center py-6">
          <p className="font-display font-bold text-3xl mb-2">
            <span
              className={
                score !== null && score >= 80
                  ? "text-edsync-emerald"
                  : score !== null && score >= 60
                    ? "text-edsync-amber"
                    : "text-edsync-red"
              }
            >
              {score}%
            </span>
          </p>
          <p className="text-edsync-subtle text-sm mb-4">
            {score !== null && score >= 80
              ? "Excellent work!"
              : score !== null && score >= 60
                ? "Good effort!"
                : "Keep practicing!"}
          </p>
          <button
            onClick={() => onComplete(score || 0)}
            className="btn-primary"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Student Lesson Page ───────────────────────────────────
export default function StudentLesson() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  const edsync = useMemo(() => createClient(), []);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sectionIdx, setSectionIdx] = useState(0);

  const [diagAnswers, setDiagAnswers] = useState<AnswerState>({});
  const [diagSubmitted, setDiagSubmitted] = useState(false);
  const [finalAnswers, setFinalAnswers] = useState<AnswerState>({});
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  // Reflection coaching states
  const [reflectionNotes, setReflectionNotes] = useState("");
  const [reflectionConfidence, setReflectionConfidence] = useState(3);
  const [reflectionAdvice, setReflectionAdvice] =
    useState<ReflectionAdvice | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);

  // Extended learning states
  const [extendedTopic, setExtendedTopic] = useState<string>("");
  const [extendedContent, setExtendedContent] = useState<string>("");
  const [extendedQuiz, setExtendedQuiz] = useState<ExtendedQuizQuestion[] | null>(null);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [extendedQuizAnswers, setExtendedQuizAnswers] = useState<AnswerState>(
    {},
  );
  const [extendedQuizSubmitted, setExtendedQuizSubmitted] = useState(false);

  // Quiz performance tracking
  const [quizPerformance, setQuizPerformance] = useState<{
    score: number;
    incorrectQuestions: QuizQuestion[];
  } | null>(null);

  const [showGlossary, setShowGlossary] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Section quiz state
  const [sectionQs, setSectionQs] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Memoized filtered questions for performance
  const diagQs = useMemo(
    () => questions.filter((q) => q.is_diagnostic),
    [questions],
  );
  const finalQs = useMemo(
    () => questions.filter((q) => q.is_final_quiz),
    [questions],
  );
  const loadLesson = useCallback(async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;

    let lessonData: Lesson | null = null;
    let sectionsData: LessonSection[] = [];
    let questionsData: QuizQuestion[] = [];
    let glossaryData: GlossaryTerm[] = [];

    try {
      const lessonRes = await edsync
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .single();
      lessonData = lessonRes.data;
    } catch (error) {
      console.error("Error loading lesson:", error);
      toast.error("Failed to load lesson");
      return;
    }

    try {
      const sectionsRes = await edsync
        .from("lesson_sections")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index");
      sectionsData = sectionsRes.data || [];
    } catch (error) {
      console.error("Error loading sections:", error);
      sectionsData = [];
    }

    try {
      const questionsRes = await edsync
        .from("quiz_questions")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index");
      questionsData = questionsRes.data || [];
    } catch (error) {
      console.error("Error loading questions:", error);
      questionsData = [];
    }

    try {
      const glossaryRes = await edsync
        .from("glossary_terms")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("term");
      glossaryData = glossaryRes.data || [];
    } catch (error) {
      console.error("Error loading glossary:", error);
      glossaryData = [];
    }

    setLesson(lessonData);
    setSections(sectionsData);
    setQuestions(questionsData);
    setGlossary(glossaryData);

    try {
      const progressRes = await edsync
        .from("student_progress")
        .select("*")
        .eq("student_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      const p = progressRes.data;
      if (p) {
        setProgress(p);
        if (p.status === "completed") setPhase("complete");
        else {
          // Resume: find which section we left off on
          const completedIds: string[] = p.sections_completed || [];
          const nextIdx = sectionsData.findIndex((section) => !completedIds.includes(section.id));
          setSectionIdx(nextIdx === -1 ? 0 : nextIdx);
          setPhase(p.diagnostic_completed ? "learning" : "diagnostic");
        }
      } else {
        const { data: np } = await edsync
          .from("student_progress")
          .insert({
            student_id: user.id,
            lesson_id: lessonId,
            status: "in_progress",
            sections_completed: [],
            started_at: new Date().toISOString(),
          })
          .select()
          .single();
        setProgress(np);
        setPhase("diagnostic");
      }
    } catch (error) {
      console.error("Error loading progress:", error);
      // If progress fails, start fresh without progress tracking
      setProgress(null);
      setPhase("diagnostic");
      toast.error("Progress tracking unavailable, starting fresh");
    }
  }, [edsync, lessonId]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  const completeDiagnostic = async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user || !progress) return;
    let correct = 0;
    diagQs.forEach((q) => {
      if (
        q.question_type === "multiple_choice" ||
        q.question_type === "true_false"
      ) {
        if (q.options?.find((o) => o.id === diagAnswers[q.id])?.is_correct)
          correct++;
      } else if (q.question_type === "fill_blank") {
        if (
          (q.correct_answer || "").toLowerCase().trim() ===
          (diagAnswers[q.id] || "").toLowerCase().trim()
        )
          correct++;
      } else correct++;
    });
    const score =
      diagQs.length > 0 ? Math.round((correct / diagQs.length) * 100) : 100;
    await edsync
      .from("student_progress")
      .update({ diagnostic_completed: true, diagnostic_score: score })
      .eq("id", progress.id);
    setProgress((p) =>
      p ? { ...p, diagnostic_completed: true, diagnostic_score: score } : p,
    );
    setPhase("learning");
    toast.success(`Pre-check done! ${Math.round(score)}% ready`);
  };

  const checkSectionQuiz = async (sec: LessonSection) => {
    // Look for quiz_questions with this section_id (no is_micro_check flag — it's inline)
    const inlineQs = questions.filter(
      (q) =>
        q.section_id === sec.id &&
        !q.is_micro_check &&
        !q.is_final_quiz &&
        !q.is_diagnostic,
    );
    if (inlineQs.length > 0) {
      setSectionQs(inlineQs);
      setPhase("quiz_section");
    } else {
      // Check for micro_check questions for this section
      const microQs = questions.filter(
        (q) => q.is_micro_check && q.section_id === sec.id,
      );
      if (microQs.length > 0) {
        setSectionQs(microQs);
        setPhase("micro_check");
      } else {
        advanceSection();
      }
    }
  };

  const completeSection = async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user || !progress) return;
    const sec = sections[sectionIdx];
    const newCompleted = [...(progress.sections_completed || []), sec.id];
    await edsync
      .from("student_progress")
      .update({ sections_completed: newCompleted })
      .eq("id", progress.id);
    setProgress((p) => (p ? { ...p, sections_completed: newCompleted } : p));
    await checkSectionQuiz(sec);
  };

  const advanceSection = () => {
    if (sectionIdx < sections.length - 1) {
      setSectionIdx((i) => i + 1);
      setPhase("learning");
    } else {
      if (finalQs.length > 0) setPhase("final_quiz");
      else finishLesson(100);
    }
  };

  const completeLesson = async (score: number) => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user || !progress) return;
    await edsync
      .from("student_progress")
      .update({
        status: "completed",
        final_quiz_score: score,
        score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", progress.id);
    if (lesson?.id) {
      await fetch("/api/grades/lesson-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, score }),
      }).catch(() => null);
    }
    const xp = Math.max(10, Math.round(score / 10));
    const { error } = await edsync.rpc("increment_xp", {
      user_id: user.id,
      xp,
    });
    if (error) {
      const { data: prof } = await edsync
        .from("profiles")
        .select("total_xp, streak_days")
        .eq("id", user.id)
        .single();
      if (prof)
        await edsync
          .from("profiles")
          .update({
            total_xp: (prof.total_xp || 0) + xp,
            streak_days: Math.max(1, prof.streak_days || 0),
            last_active_at: new Date().toISOString(),
          })
          .eq("id", user.id);
    } else {
      await edsync
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    setProgress((p) =>
      p ? { ...p, status: "completed", final_quiz_score: score, score } : p,
    );
    setPhase("complete");
    toast.success(` Lesson complete! Score: ${Math.round(score)}%`);
  };

  const finishLesson = async (score: number) => {
    setFinalScore(score);
    setReflectionSubmitted(false);
    setReflectionAdvice(null);
    setReflectionConfidence(3);
    setReflectionNotes("");
    setPhase("reflection");
  };

  const submitReflection = async () => {
    if (!reflectionNotes.trim() || reflectionLoading) {
      if (!reflectionNotes.trim()) {
        toast.error("Please share what you learned before getting coaching.");
      }
      return;
    }

    setReflectionLoading(true);
    const now = new Date().toISOString();
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setReflectionLoading(false);
      toast.error("Please sign in again to save your reflection.");
      return;
    }
    const userId = user.id;

    try {
      const lectureContext = sections
        .map(
          (section) =>
            `${section.title}: ${stripHtmlTags(section.content || "")}`,
        )
        .join("\n\n")
        .slice(0, 7000);

      const response = await fetch("/api/ai/reflection-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reflection: reflectionNotes.trim(),
          confidence: reflectionConfidence,
          lessonTitle: lesson?.title,
          lessonObjectives: lesson?.objectives,
          currentSection: sections[sectionIdx]?.title ?? "Whole lesson",
          lectureContext,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.advice) {
        throw new Error(data?.error || "No coaching returned");
      }

      const advice = data.advice as ReflectionAdvice;
      const record: ReflectionRecord = {
        id: typeof crypto !== "undefined" ? crypto.randomUUID() : now,
        created_at: now,
        section_title: sections[sectionIdx]?.title ?? "Whole lesson",
        notes: reflectionNotes.trim(),
        confidence: reflectionConfidence,
        advice,
      };

      if (progress) {
        const metadata =
          progress.metadata &&
          typeof progress.metadata === "object" &&
          !Array.isArray(progress.metadata)
            ? (progress.metadata as Record<string, unknown>)
            : {};

        const existing = Array.isArray(metadata.reflections)
          ? (metadata.reflections as ReflectionRecord[])
          : [];

        const nextMetadata = {
          ...metadata,
          reflections: [...existing.slice(-19), record],
        };

        const { error } = await edsync
          .from("student_progress")
          .update({ metadata: nextMetadata, last_active: now })
          .eq("id", progress.id);

        if (error) {
          console.error("Failed to save reflection metadata:", error);
          toast.error("Coaching generated, but reflection was not saved.");
        } else {
          const { error: reflectionError } = await edsync
            .from("learning_reflections")
            .insert({
              student_id: userId,
              lesson_id: lesson?.id ?? null,
              confidence: reflectionConfidence,
              reflection: reflectionNotes.trim(),
              ai_feedback: advice.encouragement,
              next_step: advice.nextSteps[0] ?? advice.guidingQuestion,
            });

          if (reflectionError) {
            console.error("Failed to save reflection row:", reflectionError);
          }

          setProgress((p) =>
            p ? { ...p, metadata: nextMetadata, last_active: now } : p,
          );
        }
      }

      setReflectionAdvice(advice);
      setReflectionSubmitted(true);
      toast.success("AI coaching is ready.");
    } catch (error) {
      console.error("Reflection coaching error:", error);
      toast.error("Could not generate coaching right now. Please try again.");
    }

    setReflectionLoading(false);
  };

  const submitFinalQuiz = async () => {
    let earnedPoints = 0;
    let possiblePoints = 0;
    const incorrectQuestions: QuizQuestion[] = [];

    finalQs.forEach((q) => {
      const points = Math.max(1, Number(q.points || 1));
      possiblePoints += points;
      let isCorrect = false;
      if (
        q.question_type === "multiple_choice" ||
        q.question_type === "true_false"
      ) {
        isCorrect =
          q.options?.find((o) => o.id === finalAnswers[q.id])?.is_correct ===
          true;
      } else if (q.question_type === "fill_blank") {
        isCorrect =
          (q.correct_answer || "").toLowerCase().trim() ===
          (finalAnswers[q.id] || "").toLowerCase().trim();
      } else {
        isCorrect = true; // short/long always counted as correct
      }

      if (isCorrect) {
        earnedPoints += points;
      } else {
        incorrectQuestions.push(q);
      }
    });

    const score =
      possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 100;

    setFinalScore(score);
    setFinalSubmitted(true);
    setQuizPerformance({ score, incorrectQuestions });
    setReflectionSubmitted(false);
    setReflectionAdvice(null);
    setReflectionConfidence(3);
    setReflectionNotes("");
    setPhase("reflection");
  };

  const sendSocratic = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const question = chatInput;
    const userMsg: ChatMessage = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          lessonTitle: lesson?.title,
          lessonObjectives: lesson?.objectives,
          currentSection: sections[sectionIdx]?.title,
          currentPhase: phase,
          sections: sections.map((s) => ({
            title: s.title,
            content: s.content,
            content_type: s.content_type,
          })),
          glossary: glossary.map((g) => ({
            term: g.term,
            definition: g.definition,
            example: g.example,
          })),
          conversationHistory: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.hint || "Great question! Let me guide you through it...",
        timestamp: new Date().toISOString(),
      };

      setChatMessages([...newMessages, aiMsg]);

      const {
        data: { user },
      } = await edsync.auth.getUser();

      if (user) {
        await edsync.from("socratic_interactions").insert({
          student_id: user.id,
          lesson_id: lessonId,
          student_question: question,
          hint_response: aiMsg.content,
          conversation_history: [...newMessages, aiMsg],
        });
      }
    } catch {
      toast.error("Could not get hint right now");
    }

    setChatLoading(false);
  };

  const generateExtendedLearning = async () => {
    setExtendedLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const res = await fetch("/api/ai/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: (() => {
            let prompt =
              "Generate extended learning content for this lesson. First, suggest an appropriate extension topic related to the lesson. Then, write 1 paragraphs of educational content about that topic. Finally, create a short multiple choice quiz with 3 questions, each with 4 options and one correct answer. Format the response as JSON with keys: topic, content, quiz (array of {question, options: [{text: string, is_correct: boolean}]}). Do not include any other text, just the JSON.";

            if (quizPerformance) {
              const { score, incorrectQuestions } = quizPerformance;
              const incorrectList = incorrectQuestions
                .map((q) => q.question_text)
                .join("; ");
              prompt += ` The student scored ${score}% on the final quiz and struggled with these questions: ${incorrectList}. Focus the extended learning content specifically on these topics/concepts they got wrong to help them improve.`;
            }

            return prompt;
          })(),
          lessonTitle: lesson?.title,
          lessonObjectives: lesson?.objectives,
          conversationHistory: [],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      const response = data.hint || "";

      // Clean markdown code blocks
      const cleanResponse = response
        .replace(/```(?:json)?\s*/g, "")
        .replace(/```\s*$/g, "")
        .trim();

      // Try to parse the cleaned response as JSON
      let parsed: ExtendedLearningPayload;
      try {
        parsed = JSON.parse(cleanResponse);
      } catch {
        // If that fails, try to extract JSON with regex
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            console.log("Error parsing JSON:", response);
            throw new Error("Invalid JSON structure in AI response");
          }
        } else {
          console.log("AI response:", response);
          throw new Error("No JSON found in AI response");
        }
      }

      // Validate structure
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Parsed response is not an object");
      }

      const topic =
        typeof parsed.topic === "string"
          ? parsed.topic
          : "Extended Learning Topic";
      const content =
        typeof parsed.content === "string"
          ? parsed.content
          : "Extended learning content could not be generated properly.";

      let quiz: ExtendedQuizQuestion[] = [];
      if (Array.isArray(parsed.quiz)) {
        quiz = parsed.quiz.filter(isExtendedQuizQuestion);
      }

      if (quiz.length === 0) {
        // Provide a fallback quiz if none valid
        quiz = [
          {
            question:
              "What is the main topic of this extended learning section?",
            options: [
              { text: "The provided topic", is_correct: true },
              { text: "Something unrelated", is_correct: false },
              { text: "A different subject", is_correct: false },
              { text: "None of the above", is_correct: false },
            ],
          },
        ];
      }

      setExtendedTopic(topic);
      setExtendedContent(content);
      setExtendedQuiz(quiz);
      setExtendedQuizAnswers({});
      setExtendedQuizSubmitted(false);

      toast.success("Extended learning content generated successfully!");
    } catch (error) {
      console.error("Error generating extended learning:", error);
      const isAbortError =
        (error instanceof Error || error instanceof DOMException) &&
        error.name === "AbortError";
      if (isAbortError) {
        setExtendedTopic("Timeout");
        setExtendedContent("The request timed out. Please try again.");
        setExtendedQuiz([]);
        setExtendedQuizAnswers({});
        setExtendedQuizSubmitted(false);
        toast.error("Request timed out. Please try again.");
      } else {
        // Fallback content showing incorrect questions
        const fallbackTopic = "Review of Challenging Topics";
        let fallbackContent =
          "Let's review the questions you found challenging in the final quiz:\n\n";

        if (quizPerformance && quizPerformance.incorrectQuestions.length > 0) {
          quizPerformance.incorrectQuestions.forEach((q, i) => {
            fallbackContent += `${i + 1}. ${q.question_text}\n`;
            if (q.correct_answer) {
              fallbackContent += `   Correct answer: ${q.correct_answer}\n`;
            }
            if (q.explanation) {
              fallbackContent += `   Explanation: ${q.explanation}\n`;
            }
            fallbackContent += "\n";
          });
          fallbackContent +=
            "Take some time to review these concepts and try the quiz again if you'd like.";
        } else {
          fallbackContent =
            "Could not generate extended learning content at this time. Please try again.";
        }

        setExtendedTopic(fallbackTopic);
        setExtendedContent(fallbackContent);
        setExtendedQuiz([]);
        setExtendedQuizAnswers({});
        setExtendedQuizSubmitted(false);

        toast.error(
          "Failed to generate extended learning content. Showing review of challenging questions instead.",
        );
      }
    }
    setExtendedLoading(false);
  };

  const currentSection = sections[sectionIdx];

  // Progress calculation
  const totalSteps =
    (diagQs.length > 0 ? 1 : 0) +
    sections.length +
    (finalQs.length > 0 ? 1 : 0);
  const doneSteps =
    (progress?.diagnostic_completed ? 1 : 0) +
    (progress?.sections_completed?.length || 0) +
    (phase === "reflection" ||
    phase === "choose_path" ||
    phase === "extended_learning" ||
    progress?.status === "completed"
      ? 1
      : 0);
  const progressPct =
    totalSteps > 0
      ? Math.min(100, Math.round((doneSteps / totalSteps) * 100))
      : 0;

  if (phase === "loading")
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-edsync-blue/30 border-t-edsync-blue rounded-full animate-spin mx-auto mb-4" />
          <p className="text-edsync-subtle">Loading your lesson...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-edsync-surface border-b border-edsync-border">
        <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
          <button
            onClick={() => router.push("/student/dashboard")}
            className="btn-ghost text-sm py-1.5 flex-shrink-0"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-edsync-subtle truncate">
              {lesson?.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-1.5 bg-edsync-border rounded-full">
                <div
                  className="h-full bg-edsync-blue rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-edsync-blue font-medium flex-shrink-0">
                {progressPct}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {glossary.length > 0 && (
              <button
                onClick={() => {
                  setShowGlossary((v) => !v);
                  setShowChat(false);
                }}
                className={`btn-ghost text-xs py-1.5 px-3 ${showGlossary ? "text-edsync-blue" : ""}`}
              >
                Glossary
              </button>
            )}
            <button
              onClick={() => {
                setShowChat((v) => !v);
                setShowGlossary(false);
              }}
              className={`btn-primary text-xs py-1.5 px-3 relative ${showChat ? "ring-2 ring-white/20" : ""}`}
            >
              Ask
              {chatMessages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-edsync-amber rounded-full text-xs flex items-center justify-center text-black font-bold">
                  {chatMessages.filter((m) => m.role === "assistant").length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section breadcrumb nav (during learning) ── */}
      {(phase === "learning" ||
        phase === "quiz_section" ||
        phase === "micro_check" ||
        phase === "extended_learning") &&
        sections.length > 0 && (
          <div className="bg-edsync-surface border-b border-edsync-border px-4 py-2">
            <div className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto items-center">
              {sections.map((s, i) => {
                const done = (progress?.sections_completed || []).includes(
                  s.id,
                );
                const current = i === sectionIdx;
                const canNavigate =
                  done ||
                  i < sectionIdx ||
                  current ||
                  phase === "extended_learning";
                return (
                  <button
                    key={s.id}
                    disabled={!canNavigate}
                    onClick={() => {
                      if (!canNavigate) return;
                      setSectionIdx(i);
                      setPhase(
                        phase === "extended_learning"
                          ? "extended_learning"
                          : "learning",
                      );
                    }}
                    title={
                      canNavigate
                        ? `Go to: ${s.title}`
                        : "Complete previous sections first"
                    }
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      current
                        ? "bg-edsync-blue text-white shadow-sm"
                        : done
                          ? "bg-edsync-emerald/20 text-edsync-emerald border border-edsync-emerald/30 hover:bg-edsync-emerald/30 cursor-pointer"
                          : canNavigate
                            ? "bg-edsync-card text-edsync-subtle border border-edsync-border hover:border-edsync-blue hover:text-edsync-blue cursor-pointer"
                            : "bg-edsync-card text-edsync-subtle/40 border border-edsync-border/40 cursor-not-allowed"
                    }`}
                  >
                    {done && !current ? "✓ " : null}
                    {s.title.length > 18 ? s.title.slice(0, 16) + "…" : s.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6">
        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0 animate-fade-in">
          {/* DIAGNOSTIC */}
          {phase === "diagnostic" &&
            (() => {
              return (
                <div>
                  <div className="edsync-card mb-6 border-edsync-blue/30 bg-edsync-blue/5">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <h2 className="font-display font-bold text-xl text-edsync-text">
                          Pre-Check Survey
                        </h2>
                        <p className="text-edsync-subtle text-sm">
                          Helps us personalize your learning. No grade!
                        </p>
                      </div>
                    </div>
                  </div>
                  {diagQs.length === 0 ? (
                    <div className="edsync-card text-center py-10">
                      <p className="text-edsync-text font-medium mb-4">
                        Ready to start! No pre-check for this lesson.
                      </p>
                      <button
                        onClick={completeDiagnostic}
                        className="btn-primary"
                      >
                        Begin Lesson →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {diagQs.map((q, i) => (
                        <QuestionItem
                          key={q.id}
                          q={q}
                          answers={diagAnswers}
                          setAnswers={setDiagAnswers}
                          submitted={diagSubmitted}
                          index={i}
                        />
                      ))}
                      {!diagSubmitted ? (
                        <button
                          onClick={() => setDiagSubmitted(true)}
                          disabled={!diagQs.every((q) => diagAnswers[q.id])}
                          className="btn-primary w-full justify-center py-4 disabled:opacity-40"
                        >
                          Submit Pre-Check →
                        </button>
                      ) : (
                        <div className="edsync-card text-center py-6">
                          <p className="text-edsync-emerald font-semibold mb-3">
                            Pre-check submitted!
                          </p>
                          <button
                            onClick={completeDiagnostic}
                            className="btn-primary"
                          >
                            Start Lesson →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* LEARNING */}
          {phase === "learning" && currentSection && (
            <div>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-edsync-border">
                <span className="w-8 h-8 rounded-xl bg-edsync-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {sectionIdx + 1}
                </span>
                <div>
                  <p className="text-xs text-edsync-subtle uppercase tracking-wide font-medium">
                    Section {sectionIdx + 1} of {sections.length}
                  </p>
                  <h2 className="font-display font-bold text-2xl text-edsync-text">
                    {currentSection.title}
                  </h2>
                </div>
                {currentSection.duration_minutes && (
                  <span className="ml-auto text-xs text-edsync-subtle bg-edsync-card border border-edsync-border px-2 py-1 rounded-lg flex-shrink-0">
                    ~{currentSection.duration_minutes} min
                  </span>
                )}
              </div>

              {/* Content by type */}
              <div className="mb-8">
                {currentSection.content_type === "text" && (
                  <TextContent content={currentSection.content || ""} />
                )}
                {currentSection.content_type === "image" && (
                  <ImageContent
                    content={currentSection.content || ""}
                    title={currentSection.title}
                  />
                )}
                {currentSection.content_type === "video" && (
                  <VideoContent content={currentSection.content || ""} />
                )}
                {currentSection.content_type === "activity" && (
                  <ActivityContent content={currentSection.content || ""} />
                )}
                {currentSection.content_type === "discussion" && (
                  <DiscussionContent content={currentSection.content || ""} />
                )}
                {currentSection.content_type === "quiz" &&
                  (() => {
                    const qsForSection = questions.filter(
                      (q) =>
                        q.section_id === currentSection.id &&
                        !q.is_final_quiz &&
                        !q.is_diagnostic,
                    );
                    return qsForSection.length > 0 ? (
                      <QuizSection
                        questions={qsForSection}
                        title={currentSection.content || "Section Quiz"}
                        onComplete={() => {
                          advanceSection();
                        }}
                      />
                    ) : (
                      <p className="text-edsync-subtle text-sm text-center py-8">
                        No quiz questions for this section yet.
                      </p>
                    );
                  })()}
              </div>

              {currentSection.content_type !== "quiz" && (
                <div className="flex gap-3">
                  {sectionIdx > 0 && (
                    <button
                      onClick={() => {
                        setSectionIdx((i) => i - 1);
                        setPhase("learning");
                      }}
                      className="btn-secondary py-4 px-6 flex-shrink-0"
                    >
                      ← Previous
                    </button>
                  )}
                  <button
                    onClick={completeSection}
                    className="btn-primary flex-1 justify-center py-4 text-base"
                  >
                    {sectionIdx < sections.length - 1
                      ? `Next Section →`
                      : finalQs.length > 0
                        ? "Take Final Quiz →"
                        : "Complete Lesson →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INLINE QUIZ (section quiz phase) */}
          {phase === "quiz_section" && (
            <div>
              <div className="edsync-card mb-6 border-edsync-amber/30 bg-edsync-amber/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="font-display font-bold text-xl text-edsync-text">
                        Section Quiz
                      </h2>
                      <p className="text-edsync-subtle text-sm">
                        Answer these questions about what you just learned
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPhase("learning");
                    }}
                    className="btn-ghost text-sm py-1.5 px-3 flex-shrink-0"
                  >
                    ← Back to Review
                  </button>
                </div>
              </div>
              <QuizSection
                questions={sectionQs}
                title="Section Quiz"
                onComplete={() => advanceSection()}
              />
            </div>
          )}

          {/* MICRO CHECK */}
          {phase === "micro_check" && (
            <div>
              <div className="edsync-card mb-6 border-edsync-cyan/30 bg-edsync-cyan/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="font-display font-bold text-xl text-edsync-text">
                        Quick Check
                      </h2>
                      <p className="text-edsync-subtle text-sm">
                        Short check before moving on
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPhase("learning");
                    }}
                    className="btn-ghost text-sm py-1.5 px-3 flex-shrink-0"
                  >
                    ← Back to Review
                  </button>
                </div>
              </div>
              <QuizSection
                questions={sectionQs}
                title="Micro-Check"
                onComplete={() => {
                  setPhase("learning");
                  advanceSection();
                }}
              />
            </div>
          )}

          {/* FINAL QUIZ */}
          {phase === "final_quiz" &&
            (() => {
              return (
                <div>
                  <div className="edsync-card mb-6 border-edsync-amber/30 bg-edsync-amber/5">
                    <div className="flex items-center gap-3 mb-1">
                      <div>
                        <h2 className="font-display font-bold text-xl text-edsync-text">
                          End-of-Lesson Quiz
                        </h2>
                        <p className="text-edsync-subtle text-sm">
                          Show what you've learned! {finalQs.length} questions
                        </p>
                      </div>
                    </div>
                  </div>
                  {finalQs.length === 0 ? (
                    <div className="edsync-card text-center py-10">
                      <button
                        onClick={() => finishLesson(100)}
                        className="btn-primary"
                      >
                        Complete Lesson ✓
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {finalQs.map((q, i) => (
                        <QuestionItem
                          key={q.id}
                          q={q}
                          answers={finalAnswers}
                          setAnswers={setFinalAnswers}
                          submitted={finalSubmitted}
                          index={i}
                        />
                      ))}
                      {!finalSubmitted ? (
                        <button
                          onClick={submitFinalQuiz}
                          disabled={!finalQs.every((q) => finalAnswers[q.id])}
                          className="btn-primary w-full justify-center py-4 disabled:opacity-40"
                        >
                          Submit Final Quiz →
                        </button>
                      ) : (
                        <div className="edsync-card text-center py-6">
                          <p className="text-edsync-emerald font-semibold text-lg">
                            Quiz submitted!
                          </p>
                          <p className="text-edsync-subtle text-sm mt-1">
                            Loading results...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* REFLECTION */}
          {phase === "reflection" && finalScore !== null && (
            <div className="space-y-6">
              <div className="edsync-card border-edsync-blue/30 bg-edsync-blue/5">
                <h2 className="font-display font-bold text-xl text-edsync-text mb-2">
                  Reflect Before You Move On
                </h2>
                <p className="text-edsync-subtle text-sm">
                  Share what you learned from this lecture and EdSync AI will
                  coach your next best step.
                </p>
                <p className="text-edsync-subtle text-sm mt-2">
                  Current lesson score:{" "}
                  <span className="font-semibold text-edsync-blue">
                    {finalScore}%
                  </span>
                </p>
              </div>

              <div className="edsync-card">
                <label className="block text-sm font-medium text-edsync-text mb-2">
                  What did you learn? Add your notes and mention anything still
                  confusing.
                </label>
                <textarea
                  value={reflectionNotes}
                  onChange={(e) => setReflectionNotes(e.target.value)}
                  rows={7}
                  className="edsync-textarea text-sm"
                  placeholder="Example: I now understand how X connects to Y, but I still get confused when..."
                />

                <div className="mt-4">
                  <p className="text-sm font-medium text-edsync-text mb-2">
                    Confidence right now (1 = low, 5 = high)
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => setReflectionConfidence(score)}
                        className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                          reflectionConfidence === score
                            ? "bg-edsync-blue border-edsync-blue text-white"
                            : "bg-edsync-surface border-edsync-border text-edsync-subtle hover:border-edsync-blue hover:text-edsync-text"
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={submitReflection}
                    disabled={reflectionLoading || !reflectionNotes.trim()}
                    className="btn-primary py-3 px-5 disabled:opacity-40"
                  >
                    {reflectionLoading
                      ? "Generating Coaching..."
                      : reflectionSubmitted
                        ? "Refresh Coaching"
                        : "Get AI Coaching"}
                  </button>
                  <button
                    onClick={() => setPhase("choose_path")}
                    className="btn-ghost py-3 px-5"
                  >
                    Skip for now
                  </button>
                </div>
              </div>

              {reflectionAdvice && (
                <div className="edsync-card border-edsync-emerald/30 bg-edsync-emerald/5">
                  <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
                    Your AI Coaching Summary
                  </h3>
                  <p className="text-sm text-edsync-subtle mb-4">
                    {reflectionAdvice.encouragement}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-xl border border-edsync-emerald/20 bg-edsync-surface">
                      <p className="text-xs font-semibold text-edsync-emerald mb-2">
                        You Are Doing Well In
                      </p>
                      <ul className="text-sm text-edsync-text space-y-1">
                        {reflectionAdvice.strengths.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-xl border border-edsync-amber/20 bg-edsync-surface">
                      <p className="text-xs font-semibold text-edsync-amber mb-2">
                        Concepts To Revisit
                      </p>
                      <ul className="text-sm text-edsync-text space-y-1">
                        {reflectionAdvice.likelyGaps.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-xl border border-edsync-blue/20 bg-edsync-surface">
                      <p className="text-xs font-semibold text-edsync-blue mb-2">
                        Next 10 Minutes
                      </p>
                      <ul className="text-sm text-edsync-text space-y-1">
                        {reflectionAdvice.nextSteps.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-xl border border-edsync-purple/20 bg-edsync-purple/5">
                    <p className="text-xs font-semibold text-edsync-purple mb-1">
                      Guiding Question
                    </p>
                    <p className="text-sm text-edsync-text italic">
                      {reflectionAdvice.guidingQuestion}
                    </p>
                  </div>

                  <button
                    onClick={() => setPhase("choose_path")}
                    className="btn-primary mt-5"
                  >
                    Continue →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CHOOSE PATH */}
          {phase === "choose_path" && finalScore !== null && (
            <div className="edsync-card text-center py-8">
              <div className="w-16 h-16 bg-edsync-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-edsync-blue text-2xl">🎯</span>
              </div>
              <h2 className="font-display font-bold text-2xl text-edsync-text mb-2">
                Lesson Complete!
              </h2>
              <p className="text-edsync-subtle mb-6">
                Your final score:{" "}
                <span className="font-semibold text-edsync-blue">
                  {finalScore}%
                </span>
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => completeLesson(finalScore)}
                  className="btn-secondary py-3 px-6"
                >
                  Complete Lesson ✓
                </button>
                <button
                  onClick={() => {
                    setPhase("extended_learning");
                    generateExtendedLearning();
                  }}
                  className="btn-primary py-3 px-6"
                >
                  Extended Learning →
                </button>
              </div>
              <p className="text-xs text-edsync-subtle mt-4">
                "Extended Learning" generates AI-powered additional content to
                deepen your understanding.
              </p>
            </div>
          )}

          {/* EXTENDED LEARNING */}
          {phase === "extended_learning" && (
            <div>
              <div className="edsync-card mb-6 border-edsync-purple/30 bg-edsync-purple/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="font-display font-bold text-xl text-edsync-text">
                        Extended Learning
                      </h2>
                      <p className="text-edsync-subtle text-sm">
                        AI-generated content to deepen your understanding
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => completeLesson(finalScore || 100)}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    Complete Lesson ✓
                  </button>
                </div>
              </div>

              {extendedLoading ? (
                <div className="edsync-card text-center py-12">
                  <div className="w-16 h-16 border-4 border-edsync-blue/30 border-t-edsync-blue rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-edsync-subtle">
                    Generating extended learning content...
                  </p>
                  <p className="text-xs text-edsync-subtle mt-2">
                    This may take up to 30 seconds
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Topic */}
                  <div className="edsync-card">
                    <h3 className="font-semibold text-edsync-text mb-3">
                      {extendedTopic}
                    </h3>
                    <div className="lesson-prose">
                      {extendedContent.split("\n\n").map((para, i) => (
                        <p key={i} className="mb-3">
                          {para}
                        </p>
                      ))}
                    </div>
                    {extendedTopic === "Error" ||
                    extendedTopic === "Timeout" ? (
                      <button
                        onClick={generateExtendedLearning}
                        className="btn-primary mt-4"
                      >
                        Try Again
                      </button>
                    ) : null}
                  </div>

                  {/* Quiz */}
                  {extendedQuiz && extendedQuiz.length > 0 && (
                    <div className="edsync-card">
                      <h3 className="font-semibold text-edsync-text mb-4">
                        Knowledge Check
                      </h3>
                      <div className="space-y-4">
                        {extendedQuiz.map((q, i) => {
                          const ans = extendedQuizAnswers[q.question] || "";
                          const setAns = (val: string) =>
                            !extendedQuizSubmitted &&
                            setExtendedQuizAnswers({
                              ...extendedQuizAnswers,
                              [q.question]: val,
                            });

                          return (
                            <div
                              key={i}
                              className="border border-edsync-border rounded-xl p-4"
                            >
                              <p className="font-medium text-edsync-text mb-3">
                                {q.question}
                              </p>
                              <div className="space-y-2">
                                {q.options.map((opt, j) => {
                                  const selected = ans === opt.text;
                                  const showCorrect =
                                    extendedQuizSubmitted && opt.is_correct;
                                  const showWrong =
                                    extendedQuizSubmitted &&
                                    selected &&
                                    !opt.is_correct;
                                  return (
                                    <button
                                      key={j}
                                      onClick={() => setAns(opt.text)}
                                      disabled={extendedQuizSubmitted}
                                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center gap-3 ${
                                        showCorrect
                                          ? "bg-edsync-emerald/10 border-edsync-emerald text-edsync-emerald"
                                          : showWrong
                                            ? "bg-edsync-red/10 border-edsync-red text-edsync-red"
                                            : selected
                                              ? "bg-edsync-blue/10 border-edsync-blue text-edsync-text"
                                              : extendedQuizSubmitted
                                                ? "bg-edsync-surface border-edsync-border text-edsync-subtle cursor-default"
                                                : "bg-edsync-surface border-edsync-border text-edsync-subtle hover:border-edsync-blue hover:text-edsync-text"
                                      }`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                          showCorrect
                                            ? "border-edsync-emerald bg-edsync-emerald text-white"
                                            : showWrong
                                              ? "border-edsync-red bg-edsync-red text-white"
                                              : selected
                                                ? "border-edsync-blue bg-edsync-blue text-white"
                                                : "border-edsync-border"
                                        }`}
                                      >
                                        {showCorrect
                                          ? "✓"
                                          : showWrong
                                            ? "✗"
                                            : selected
                                              ? "●"
                                              : String.fromCharCode(65 + j)}
                                      </span>
                                      {opt.text}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {!extendedQuizSubmitted ? (
                          <button
                            onClick={() => setExtendedQuizSubmitted(true)}
                            disabled={
                              !extendedQuiz.every(
                                (q) => extendedQuizAnswers[q.question],
                              )
                            }
                            className="btn-primary w-full justify-center py-3.5 disabled:opacity-40"
                          >
                            Submit Answers →
                          </button>
                        ) : (
                          <div className="edsync-card text-center py-6">
                            <p className="font-display font-bold text-3xl mb-2">
                              <span className="text-edsync-emerald">
                                {Math.round(
                                  (extendedQuiz.filter((q) => {
                                    const ans = extendedQuizAnswers[q.question];
                                    return q.options.find(
                                      (opt) => opt.text === ans,
                                    )?.is_correct;
                                  }).length /
                                    extendedQuiz.length) *
                                    100,
                                )}
                                %
                              </span>
                            </p>
                            <p className="text-edsync-subtle text-sm mb-4">
                              Great effort!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* COMPLETE */}
          {phase === "complete" && (
            <div className="text-center py-12 animate-slide-up">
              <div className="w-24 h-24 bg-edsync-emerald/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow-emerald">
                <span className="text-edsync-emerald font-semibold">Done</span>
              </div>
              <h2 className="font-display font-bold text-4xl text-edsync-text mb-3">
                Lesson Complete!
              </h2>
              <p className="text-edsync-subtle text-lg mb-4">
                Amazing work finishing this lesson.
              </p>
              {progress?.final_quiz_score !== null &&
                progress?.final_quiz_score !== undefined && (
                  <p className="font-display font-bold text-6xl mb-6">
                    <span
                      className={
                        progress.final_quiz_score >= 80
                          ? "text-edsync-emerald"
                          : progress.final_quiz_score >= 60
                            ? "text-edsync-amber"
                            : "text-edsync-red"
                      }
                    >
                      {Math.round(progress.final_quiz_score)}%
                    </span>
                  </p>
                )}
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => router.push("/student/dashboard")}
                  className="btn-secondary"
                >
                  ← Dashboard
                </button>
                <button
                  onClick={() => {
                    setPhase("learning");
                    setSectionIdx(0);
                  }}
                  className="btn-ghost"
                >
                  Review Lesson
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── SIDEBARS ── */}
        {showGlossary && !showChat && (
          <div className="w-72 flex-shrink-0 sticky top-28 self-start animate-fade-in">
            <div className="edsync-card max-h-[calc(100vh-10rem)] flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-edsync-border">
                <div>
                  <h3 className="font-semibold text-edsync-text">Glossary</h3>
                  <p className="text-xs text-edsync-subtle">
                    {glossary.length} terms
                  </p>
                </div>
                <button
                  onClick={() => setShowGlossary(false)}
                  className="text-edsync-subtle hover:text-edsync-text text-xl"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {glossary.length === 0 ? (
                  <p className="text-edsync-subtle text-sm text-center py-6">
                    No glossary for this lesson
                  </p>
                ) : (
                  glossary.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-edsync-surface rounded-xl border border-edsync-border"
                    >
                      <p className="font-semibold text-edsync-text text-sm">
                        {t.term}
                      </p>
                      <p className="text-xs text-edsync-subtle mt-1">
                        {t.definition}
                      </p>
                      {t.example && (
                        <p className="text-xs text-edsync-cyan mt-1 italic">
                          e.g. {t.example}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showChat && (
          <div className="w-80 flex-shrink-0 sticky top-28 self-start animate-fade-in">
            <div className="edsync-card max-h-[calc(100vh-10rem)] flex flex-col">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-edsync-border">
                <div>
                  <h3 className="font-semibold text-edsync-text">
                    Ask Socratic
                  </h3>
                  <p className="text-xs text-edsync-subtle">
                    {[
                      "quiz_section",
                      "micro_check",
                      "final_quiz",
                      "diagnostic",
                    ].includes(phase)
                      ? "Quiz mode — hints only, no direct answers"
                      : "Ask anything about the lesson"}
                  </p>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-edsync-subtle hover:text-edsync-text text-xl"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[200px]">
                {chatMessages.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-edsync-subtle text-sm">
                      I help you think, not just give answers.
                    </p>
                    <p className="text-xs text-edsync-subtle mt-1">
                      Ask me anything about this lesson!
                    </p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={
                      msg.role === "user"
                        ? "chat-bubble-user"
                        : "chat-bubble-ai"
                    }
                  >
                    {msg.role === "assistant" && (
                      <p className="text-xs text-edsync-blue font-medium mb-1">
                        Socratic
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-bubble-ai">
                    <div className="flex gap-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 pt-2 border-t border-edsync-border">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendSocratic()}
                  placeholder="What are you stuck on?"
                  className="edsync-input flex-1 py-2 text-sm"
                />
                <button
                  onClick={sendSocratic}
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn-primary px-3 py-2"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
