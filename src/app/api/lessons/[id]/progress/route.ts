import { NextResponse } from "next/server";
import { saveLessonProgress } from "@/lib/lessons/progress";
import { requireStudentLesson } from "@/lib/lessons/request";
import { readJson, withRoute } from "@/lib/security/http-errors";

type Context = { params: Promise<{ id: string }> };

export const POST = withRoute<Context>(async (request, context) => {
  const { id } = await context.params;
  const { user } = await requireStudentLesson(id);
  const body = await readJson(request);
  const data = await saveLessonProgress({ lessonId: id, studentId: user.id, body });
  return NextResponse.json({ data });
});
