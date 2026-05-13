import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { generateCourseWorkflow } from "@/lib/ai/course-workflow";
import { appendLearningEvent } from "@/lib/learning-events";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);

  const body = (await request.json()) as {
    topic?: string;
    audience?: string;
    durationMinutes?: number;
    tone?: string;
    sourceText?: string;
  };
  if (!body.topic?.trim()) {
    return NextResponse.json({ data: null, error: "Topic is required." }, { status: 400 });
  }

  const draft = await generateCourseWorkflow({
    topic: body.topic,
    audience: body.audience,
    durationMinutes: body.durationMinutes,
    tone: body.tone,
    sourceText: body.sourceText,
  });
  const eventId = await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    sourceType: "ai_course_workflow",
    eventType: "ai.course_workflow.generated",
    payload: {
      topic: body.topic,
      reviewRequired: draft.review.publishRecommendation !== "ready",
      tags: draft.tags,
    },
  });

  return NextResponse.json({
    data: {
      draft,
      eventId,
      reviewRequired: draft.review.publishRecommendation !== "ready",
    },
    error: null,
  });
}
