"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import type { ChatMessage, GlossaryTerm, Lesson, LessonSection } from "@/types";

function responseError(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return "The tutor is unavailable. Try again.";
}

export default function TutorTool({ lesson, sections, glossary, section, phase }: {
  lesson: Lesson;
  sections: LessonSection[];
  glossary: GlossaryTerm[];
  section: LessonSection | undefined;
  phase: "diagnostic" | "quiz_section" | "final_quiz" | "learning";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    const question = input.trim();
    if (!question || busy) return;
    const userMessage: ChatMessage = { role: "user", content: question, timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/socratic", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          lessonTitle: lesson.title,
          lessonObjectives: lesson.objectives,
          currentSection: section?.title,
          currentPhase: phase,
          sections: sections.map((item) => ({ title: item.title, content: item.content, content_type: item.content_type })),
          glossary: glossary.map((item) => ({ term: item.term, definition: item.definition, example: item.example })),
          conversationHistory: nextMessages.map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const payload = await response.json().catch(() => null) as { hint?: unknown; error?: unknown } | null;
      if (!response.ok || typeof payload?.hint !== "string" || !payload.hint.trim()) throw new Error(responseError(payload?.error));
      const assistantMessage: ChatMessage = { role: "assistant", content: payload.hint, timestamp: new Date().toISOString() };
      setMessages([...nextMessages, assistantMessage]);
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        await client.from("socratic_interactions").insert({
          student_id: user.id,
          lesson_id: lesson.id,
          section_id: section?.id ?? null,
          student_question: question,
          hint_response: assistantMessage.content,
          conversation_history: [...nextMessages, assistantMessage],
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The tutor is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {messages.length === 0 && <EmptyState icon={Sparkles} title="Ask about this lesson" compact />}
      <ol aria-label="Tutor conversation" className="space-y-3">
        {messages.map((message, index) => (
          <li key={`${message.timestamp}-${index}`} className={`max-w-[95%] rounded-xl p-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-accent-soft text-fg" : "bg-surface-2 text-fg"}`}>
            <span className="mb-1 block text-xs font-medium text-fg-muted">{message.role === "user" ? "You" : "Tutor"}</span>
            {message.content}
          </li>
        ))}
      </ol>
      {busy && <p role="status" className="text-sm text-fg-muted">Thinking…</p>}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <div className="flex gap-2 border-t border-line pt-3">
        <input aria-label="Ask the tutor" className="input min-w-0 flex-1" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void ask(); } }} placeholder="What are you curious about?" />
        <Button aria-label="Send question" icon={Send} variant="primary" loading={busy} disabled={!input.trim()} onClick={() => void ask()}>Ask</Button>
      </div>
    </div>
  );
}
