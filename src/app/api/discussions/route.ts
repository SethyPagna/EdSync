import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import {
  DISCUSSION_POST_MAX_LENGTH,
  DISCUSSION_PROMPT_MAX_LENGTH,
  DISCUSSION_TITLE_MAX_LENGTH,
  validateDiscussionText,
} from "@/lib/discussions/validation";
import type { SessionUser } from "@/lib/auth/session";

const CLASS_TABLE = "classes";
const THREAD_TABLE = "discussion_threads";

function classScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: CLASS_TABLE, tenantId });
}

function threadScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: THREAD_TABLE, tenantId });
}

function classPredicateParams(tenantId: string) {
  return classScopeParams(tenantId).slice(1);
}

function threadPredicateParams(tenantId: string) {
  return threadScopeParams(tenantId).slice(1);
}

function canManageThread(user: SessionUser, teacherId: string) {
  return user.user_metadata.role === "admin" || teacherId === user.id;
}

async function requireVisibleThread(user: SessionUser, context: TenantContext, threadId: string) {
  const [thread] = await d1Query<{ id: string; teacher_id: string; is_locked: number }>(
    `SELECT dt.id, dt.teacher_id, dt.is_locked
       FROM discussion_threads dt
       ${tenantObjectJoin({ objectTable: THREAD_TABLE, objectAlias: "dt", linkAlias: "thread_link" })}
       LEFT JOIN classes c ON c.id = dt.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
       LEFT JOIN class_enrollments ce
         ON ce.class_id = dt.class_id
        AND ce.student_id = ?
        AND ce.is_active = 1
      WHERE dt.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "thread_link" })}
          OR (dt.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (? = 'admin' OR dt.teacher_id = ? OR dt.class_id IS NULL OR ce.student_id = ?)
      LIMIT 1`,
    [
      THREAD_TABLE,
      CLASS_TABLE,
      user.id,
      threadId,
      ...threadPredicateParams(context.tenant.id),
      ...classPredicateParams(context.tenant.id),
      user.user_metadata.role,
      user.id,
      user.id,
    ],
  );
  return thread ?? null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);

  const params = new URL(request.url).searchParams;
  const threadId = params.get("threadId");
  const classId = params.get("classId");

  if (threadId) {
    const thread = await requireVisibleThread(user, context, threadId);
    if (!thread) return NextResponse.json({ data: null, error: "Discussion not found." }, { status: 404 });

    const posts = await d1Query(
      `SELECT dp.*, p.full_name, p.role
         FROM discussion_posts dp
         JOIN profiles p ON p.id = dp.author_id
        WHERE dp.thread_id = ?
        ORDER BY dp.created_at ASC`,
      [threadId],
    );
    return NextResponse.json({ data: { posts }, error: null });
  }

  const isAdmin = user.user_metadata.role === "admin";
  const isTeacher = user.user_metadata.role === "teacher";
  const threads = await d1Query(
    `SELECT dt.*, c.name AS class_name, COUNT(dp.id) AS post_count
       FROM discussion_threads dt
       ${tenantObjectJoin({ objectTable: THREAD_TABLE, objectAlias: "dt", linkAlias: "thread_link" })}
       LEFT JOIN classes c ON c.id = dt.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
       LEFT JOIN class_enrollments ce
         ON ce.class_id = dt.class_id
        AND ce.student_id = ?
        AND ce.is_active = 1
       LEFT JOIN discussion_posts dp ON dp.thread_id = dt.id
      WHERE (${tenantObjectPredicate({ linkAlias: "thread_link" })}
          OR (dt.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (? = 1 OR dt.teacher_id = ? OR dt.class_id IS NULL OR ce.student_id = ?)
        ${classId ? "AND dt.class_id = ?" : ""}
      GROUP BY dt.id
      ORDER BY dt.updated_at DESC`,
    [
      THREAD_TABLE,
      CLASS_TABLE,
      user.id,
      ...threadPredicateParams(context.tenant.id),
      ...classPredicateParams(context.tenant.id),
      isAdmin ? 1 : 0,
      isTeacher ? user.id : "",
      user.id,
      ...(classId ? [classId] : []),
    ],
  );
  return NextResponse.json({ data: { threads }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);

  const body = (await request.json()) as {
    threadId?: string;
    classId?: string | null;
    title?: string;
    prompt?: string | null;
    body?: string;
    parentId?: string | null;
  };

  if (!body.threadId) {
    if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
      return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
    }
    let title: string;
    let prompt: string;
    try {
      title = validateDiscussionText(body.title, "Discussion title", DISCUSSION_TITLE_MAX_LENGTH);
      prompt = validateDiscussionText(body.prompt, "Discussion prompt", DISCUSSION_PROMPT_MAX_LENGTH, false);
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid discussion." },
        { status: 400 },
      );
    }
    if (body.classId) {
      const [classRow] = await d1Query<{ id: string; teacher_id: string }>(
        `SELECT c.id, c.teacher_id
           FROM classes c
           ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND c.id = ?
            AND c.is_active = 1
          LIMIT 1`,
        [...classScopeParams(context.tenant.id), body.classId],
      );
      if (!classRow || !canManageThread(user, classRow.teacher_id)) {
        return NextResponse.json({ data: null, error: "Class not found." }, { status: 404 });
      }
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO discussion_threads (id, class_id, teacher_id, title, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, body.classId ?? null, user.id, title, prompt || null],
    );
    await linkTenantObject({
      tenantId: context.tenant.id,
      portalId: context.portal?.id,
      table: THREAD_TABLE,
      objectId: id,
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  let postBody: string;
  try {
    postBody = validateDiscussionText(body.body, "Post body", DISCUSSION_POST_MAX_LENGTH);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid discussion post." },
      { status: 400 },
    );
  }
  const thread = await requireVisibleThread(user, context, body.threadId);
  if (!thread) return NextResponse.json({ data: null, error: "Discussion not found." }, { status: 404 });
  if (thread.is_locked && !canManageThread(user, thread.teacher_id)) {
    return NextResponse.json({ data: null, error: "Discussion is locked." }, { status: 403 });
  }
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO discussion_posts (id, thread_id, author_id, parent_id, body, visibility, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'class', '{}', datetime('now'), datetime('now'))`,
    [id, body.threadId, user.id, body.parentId ?? null, postBody],
  );
  await d1Query("UPDATE discussion_threads SET updated_at = datetime('now') WHERE id = ?", [body.threadId]);
  return NextResponse.json({ data: { id }, error: null });
}
