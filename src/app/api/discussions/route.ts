import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const threadId = params.get("threadId");
  const classId = params.get("classId");

  if (threadId) {
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

  const threads = await d1Query(
    `SELECT dt.*, c.name AS class_name, COUNT(dp.id) AS post_count
       FROM discussion_threads dt
       LEFT JOIN classes c ON c.id = dt.class_id
       LEFT JOIN discussion_posts dp ON dp.thread_id = dt.id
      WHERE ${classId ? "dt.class_id = ?" : "1=1"}
      GROUP BY dt.id
      ORDER BY dt.updated_at DESC`,
    classId ? [classId] : [],
  );
  return NextResponse.json({ data: { threads }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

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
    if (!body.title) {
      return NextResponse.json({ data: null, error: "Discussion title is required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO discussion_threads (id, class_id, teacher_id, title, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, body.classId ?? null, user.id, body.title.trim(), body.prompt ?? null],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  if (!body.body) {
    return NextResponse.json({ data: null, error: "Post body is required." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO discussion_posts (id, thread_id, author_id, parent_id, body, visibility, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'class', '{}', datetime('now'), datetime('now'))`,
    [id, body.threadId, user.id, body.parentId ?? null, body.body.trim()],
  );
  await d1Query("UPDATE discussion_threads SET updated_at = datetime('now') WHERE id = ?", [body.threadId]);
  return NextResponse.json({ data: { id }, error: null });
}
