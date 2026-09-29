import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { deriveLessonDraft, parseOutline } from "@/lib/compose";
import { d1Batch, d1Query } from "@/lib/db/d1";
import type { D1Statement } from "@/lib/db/d1-adapter";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { BadRequestError, ForbiddenError, NotFoundError, routeErrorResponse } from "@/lib/security/http-errors";
import { DEFAULT_TENANT_ID, resolveTenantContext } from "@/lib/tenancy";

export const preferredRegion = ["hkg1", "sin1"];

type ComposeInput = { outline?: unknown; classId?: unknown; publish?: unknown; studioDocumentId?: unknown };

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") throw new ForbiddenError("Only teachers can create a course.");
    const context = await resolveTenantContext(user);
    await requirePermission(user, context, PERMISSIONS.coursesAuthor);
    const input = await request.json() as ComposeInput;
    if (!input || typeof input !== "object" || !input.outline) throw new BadRequestError("An outline is required.");
    if (typeof input.outline !== "object" || Array.isArray(input.outline) || typeof (input.outline as Record<string, unknown>).title !== "string" || !Array.isArray((input.outline as Record<string, unknown>).sections) || ((input.outline as Record<string, unknown>).sections as unknown[]).length === 0) throw new BadRequestError("The outline needs a title and sections.");
    const parsed = parseOutline(input.outline);
    if (!parsed.outline.title || !parsed.outline.sections.length) throw new BadRequestError("The outline needs a title and section.");
    const classId = typeof input.classId === "string" && input.classId.trim() ? input.classId.trim() : null;
    if (classId) {
      const classes = await d1Query<{ id: string }>(`SELECT c.id FROM classes c
        LEFT JOIN tenant_object_links link ON link.object_table = 'classes' AND link.object_id = c.id
        WHERE c.id = ? AND c.teacher_id = ? AND c.is_active = 1
          AND (link.tenant_id = ? OR (? = ? AND link.id IS NULL)) LIMIT 1`,
      [classId, user.id, context.tenant.id, context.tenant.id, DEFAULT_TENANT_ID]);
      if (!classes.length) throw new ForbiddenError("Choose a class you teach.");
    }
    const studioDocumentId = typeof input.studioDocumentId === "string" && input.studioDocumentId.trim() ? input.studioDocumentId.trim() : null;
    if (studioDocumentId) {
      const documents = await d1Query<{ id: string }>("SELECT id FROM studio_documents WHERE id = ? AND owner_id = ? AND tenant_id = ? LIMIT 1", [studioDocumentId, user.id, context.tenant.id]);
      if (!documents.length) throw new NotFoundError("Design not found.");
    }
    const publish = input.publish === true;
    if (publish) await requirePermission(user, context, PERMISSIONS.coursesPublish);

    const draft = deriveLessonDraft(parsed.outline);
    const lessonId = crypto.randomUUID();
    const sectionIds = draft.sections.map(() => crypto.randomUUID());
    const statements: D1Statement[] = [{
      sql: `INSERT INTO lessons (id, teacher_id, class_id, title, description, objectives, status, difficulty, estimated_duration, tags, prerequisites, source_content, ai_generated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [lessonId, user.id, classId, draft.lesson.title, draft.lesson.description, JSON.stringify(draft.lesson.objectives), publish ? "published" : "draft", draft.lesson.difficulty, draft.lesson.estimated_duration, JSON.stringify(draft.lesson.tags), JSON.stringify(draft.lesson.prerequisites), studioDocumentId ? JSON.stringify({ studioDocumentId }) : null, 0],
    }];
    statements.push({
      sql: "INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id) VALUES (?, ?, ?, 'lessons', ?)",
      params: [crypto.randomUUID(), context.tenant.id, context.portal?.id ?? null, lessonId],
    });
    draft.sections.forEach((section, index) => statements.push({
      sql: `INSERT INTO lesson_sections (id, lesson_id, title, content, content_type, order_index, duration_minutes, is_required, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [sectionIds[index], lessonId, section.title, section.content, section.content_type, section.order_index, section.duration_minutes, section.is_required ? 1 : 0, JSON.stringify(section.metadata ?? {})],
    }));
    draft.quizQuestions.forEach((question) => statements.push({
      sql: `INSERT INTO quiz_questions (id, lesson_id, section_id, question_text, question_type, options, correct_answer, explanation, difficulty, points, is_diagnostic, is_micro_check, is_final_quiz, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [crypto.randomUUID(), lessonId, question.section_index === null ? null : sectionIds[question.section_index], question.question_text, question.question_type, question.options === null ? null : JSON.stringify(question.options), question.correct_answer, question.explanation, question.difficulty, question.points, question.is_diagnostic ? 1 : 0, question.is_micro_check ? 1 : 0, question.is_final_quiz ? 1 : 0, question.order_index],
    }));
    draft.glossary.forEach((term) => statements.push({
      sql: "INSERT INTO glossary_terms (id, lesson_id, term, definition, example) VALUES (?, ?, ?, ?, ?)",
      params: [crypto.randomUUID(), lessonId, term.term, term.definition, term.example],
    }));
    if (classId && publish) statements.push({
      sql: "INSERT INTO lesson_assignments (id, lesson_id, class_id, assigned_by, is_active) VALUES (?, ?, ?, ?, 1)",
      params: [crypto.randomUUID(), lessonId, classId, user.id],
    });
    await d1Batch(statements);
    return NextResponse.json({ lessonId }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
