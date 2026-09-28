import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import { isOwnerScoped } from "@/lib/tenancy/ownership";
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

// Class-less threads are tenant-wide, which in the shared default tenant would mean every account.
function openThreadFlag(user: SessionUser, context: TenantContext) {
  return isOwnerScoped(user, context) ? 0 : 1;
}

function optionalId(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 160) throw new BadRequestError(`${label} is invalid.`);
  return value;
}

function validated<T>(parse: () => T, fallback: string): T {
  try {
    return parse();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : fallback);
  }
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
        AND (? = 'admin' OR dt.teacher_id = ? OR (dt.class_id IS NULL AND ? = 1) OR ce.student_id = ?)
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
      openThreadFlag(user, context),
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
        AND (? = 1 OR dt.teacher_id = ? OR (dt.class_id IS NULL AND ? = 1) OR ce.student_id = ?)
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
      openThreadFlag(user, context),
      user.id,
      ...(classId ? [classId] : []),
    ],
  );
  return NextResponse.json({ data: { threads }, error: null });
}

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);

  const body = await readJson<{
    threadId?: unknown;
    classId?: unknown;
    title?: string;
    prompt?: string | null;
    body?: string;
    parentId?: unknown;
  }>(request);
  const threadId = optionalId(body.threadId, "Discussion");
  const classId = optionalId(body.classId, "Class");
  const parentId = optionalId(body.parentId, "Reply target");

  if (!threadId) {
    if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
      throw new ForbiddenError("Teacher access required.");
    }
    const { title, prompt } = validated(
      () => ({
        title: validateDiscussionText(body.title, "Discussion title", DISCUSSION_TITLE_MAX_LENGTH),
        prompt: validateDiscussionText(body.prompt, "Discussion prompt", DISCUSSION_PROMPT_MAX_LENGTH, false),
      }),
      "Invalid discussion.",
    );
    if (classId) {
      const [classRow] = await d1Query<{ id: string; teacher_id: string }>(
        `SELECT c.id, c.teacher_id
           FROM classes c
           ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND c.id = ?
            AND c.is_active = 1
          LIMIT 1`,
        [...classScopeParams(context.tenant.id), classId],
      );
      if (!classRow || !canManageThread(user, classRow.teacher_id)) throw new NotFoundError("Class not found.");
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO discussion_threads (id, class_id, teacher_id, title, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, classId, user.id, title, prompt || null],
    );
    await linkTenantObject({
      tenantId: context.tenant.id,
      portalId: context.portal?.id,
      table: THREAD_TABLE,
      objectId: id,
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  const postBody = validated(
    () => validateDiscussionText(body.body, "Post body", DISCUSSION_POST_MAX_LENGTH),
    "Invalid discussion post.",
  );
  const thread = await requireVisibleThread(user, context, threadId);
  if (!thread) throw new NotFoundError("Discussion not found.");
  if (thread.is_locked && !canManageThread(user, thread.teacher_id)) throw new ForbiddenError("Discussion is locked.");
  if (parentId) {
    const [parent] = await d1Query<{ id: string }>(
      "SELECT id FROM discussion_posts WHERE id = ? AND thread_id = ? LIMIT 1",
      [parentId, threadId],
    );
    if (!parent) throw new BadRequestError("Reply target is not part of this discussion.");
  }
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO discussion_posts (id, thread_id, author_id, parent_id, body, visibility, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'class', '{}', datetime('now'), datetime('now'))`,
    [id, threadId, user.id, parentId, postBody],
  );
  await d1Query("UPDATE discussion_threads SET updated_at = datetime('now') WHERE id = ?", [threadId]);
  return NextResponse.json({ data: { id }, error: null });
});
