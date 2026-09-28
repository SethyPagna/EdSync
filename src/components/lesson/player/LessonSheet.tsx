"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { Button, EmptyState, Sheet } from "@/components/ui";
import { scopedClassHref } from "@/lib/classes/class-scope";
import type { GlossaryTerm, Lesson, LessonSection } from "@/types";
import NotesTool from "./NotesTool";
import TutorTool from "./TutorTool";
import ReflectionTool from "./ReflectionTool";
import ExtendedTool from "./ExtendedTool";

export type LessonTool = "outline" | "notes" | "glossary" | "flashcards" | "tutor" | "reflection" | "extended" | "more";

const TITLES: Record<LessonTool, string> = {
  outline: "Sections", notes: "Lesson notes", glossary: "Glossary", flashcards: "Flashcards",
  tutor: "Ask the tutor", reflection: "Reflection", extended: "Extended learning", more: "More",
};

export default function LessonSheet({ tool, onClose, onTool, lesson, sections, sectionIdx, completedIds, onSelectSection, glossary, missedPrompts, tutorPhase }: {
  tool: LessonTool | null;
  onClose(): void;
  onTool(tool: LessonTool): void;
  lesson: Lesson;
  sections: LessonSection[];
  sectionIdx: number;
  completedIds: string[];
  onSelectSection(index: number): void;
  glossary: GlossaryTerm[];
  missedPrompts: string[];
  tutorPhase: "diagnostic" | "quiz_section" | "final_quiz" | "learning";
}) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const section = sections[sectionIdx];
  const card = glossary[cardIndex];
  const goCard = (offset: number) => { setCardIndex((index) => Math.max(0, Math.min(glossary.length - 1, index + offset))); setFlipped(false); };
  const scoped = (path: string) => lesson.class_id ? scopedClassHref(path, lesson.class_id) : path;
  const links = [
    ["Courses", "/student/lessons"], ["My work", scoped("/student/work")],
    ["Discussions", scoped("/student/discussions")], ["Planner", scoped("/student/planner")],
    ["Progress", scoped("/student/grades")], ["Personal notes", "/student/notes"],
    ["Practice", "/practice?mode=generated_from_materials&ai=1"],
  ];

  return (
    <Sheet open={tool !== null} onClose={onClose} title={tool ? TITLES[tool] : "Lesson tools"}>
      {tool === "outline" && (
        <nav aria-label="Lesson sections" className="space-y-1">
          {sections.map((item, index) => {
            const done = completedIds.includes(item.id);
            const current = index === sectionIdx;
            const available = done || index <= sectionIdx;
            return (
              <button key={item.id} type="button" disabled={!available} onClick={() => { onSelectSection(index); onClose(); }} aria-current={current ? "step" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${current ? "bg-accent-soft text-accent" : "text-fg hover:bg-surface-2"} disabled:cursor-not-allowed disabled:opacity-45`}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs">{done ? <Check className="size-3.5 text-success" /> : index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
            );
          })}
        </nav>
      )}
      {tool === "notes" && <NotesTool lessonId={lesson.id} lessonTitle={lesson.title} section={section} />}
      {tool === "glossary" && (glossary.length ? (
        <div className="space-y-3">
          <Button variant="secondary" icon={Layers3} onClick={() => onTool("flashcards")}>Study cards</Button>
          <dl className="space-y-2">{glossary.map((item) => <div key={item.id} className="rounded-lg border border-line p-3"><dt className="font-medium text-fg">{item.term}</dt><dd className="mt-1 text-sm text-fg-muted">{item.definition}</dd>{item.example && <dd className="mt-1 text-xs text-fg-faint">{item.example}</dd>}</div>)}</dl>
        </div>
      ) : <EmptyState icon={BookOpen} title="No glossary yet" compact />)}
      {tool === "flashcards" && (card ? (
        <div className="space-y-4">
          <p className="text-xs text-fg-muted">{cardIndex + 1} of {glossary.length}</p>
          <button type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Show term" : "Show definition"} className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface p-6 text-center shadow-sm focus-visible:ring-2 focus-visible:ring-focus">
            <span className="text-xs text-fg-faint">{flipped ? "Definition" : "Term"}</span>
            <span className="text-lg font-medium text-fg">{flipped ? card.definition : card.term}</span>
            {flipped && card.example && <span className="text-sm text-fg-muted">{card.example}</span>}
            <span className="text-xs text-fg-faint">Tap to flip</span>
          </button>
          <div className="flex justify-between"><Button icon={ChevronLeft} disabled={cardIndex === 0} onClick={() => goCard(-1)}>Previous</Button><Button iconRight={ChevronRight} disabled={cardIndex === glossary.length - 1} onClick={() => goCard(1)}>Next</Button></div>
        </div>
      ) : <EmptyState icon={Layers3} title="No cards yet" compact />)}
      {tool === "tutor" && <TutorTool lesson={lesson} sections={sections} glossary={glossary} section={section} phase={tutorPhase} />}
      {tool === "reflection" && <ReflectionTool lesson={lesson} sections={sections} section={section} />}
      {tool === "extended" && <ExtendedTool lesson={lesson} missedPrompts={missedPrompts} />}
      {tool === "more" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["flashcards", "tutor", "reflection", "extended"] as LessonTool[]).map((item) => <Button key={item} onClick={() => onTool(item)}>{TITLES[item]}</Button>)}
          </div>
          <nav aria-label="Course workspace" className="space-y-1 border-t border-line pt-3">{links.map(([label, href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg">{label}</Link>)}</nav>
        </div>
      )}
    </Sheet>
  );
}
