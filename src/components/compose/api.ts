import type { LessonOutline } from "@/lib/compose/types";

export type OutlineSource = "ai" | "local";

export type OutlineRequest = {
  topic: string;
  sourceText?: string;
  audience?: string;
  level?: LessonOutline["level"];
  language?: string;
  sectionCount?: number;
  questionCount?: number;
  style?: string;
  /** "auto" tries AI and falls back to the local parser. */
  mode?: "auto" | "ai" | "local";
};

export type OutlineResponse = {
  outline: LessonOutline;
  source: OutlineSource;
  warnings: string[];
};

export type ComposeCourseRequest = {
  outline: LessonOutline;
  classId?: string | null;
  publish?: boolean;
  studioDocumentId?: string | null;
};

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

export function requestOutline(request: OutlineRequest, signal?: AbortSignal): Promise<OutlineResponse> {
  return postJson<OutlineResponse>("/api/ai/create-lesson", request, signal);
}

export function createCourseFromOutline(request: ComposeCourseRequest): Promise<{ lessonId: string }> {
  return postJson<{ lessonId: string }>("/api/lessons/compose", request);
}
