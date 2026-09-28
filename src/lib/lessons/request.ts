import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/security/http-errors";
import { resolveTenantContext } from "@/lib/tenancy";
import { loadAccessibleLesson, type AccessibleLesson } from "./access";

export async function requireLesson(lessonId: string): Promise<{
  user: SessionUser;
  lesson: AccessibleLesson;
}> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  const lesson = await loadAccessibleLesson({
    lessonId,
    tenantId: context.tenant.id,
    tenantMember: Boolean(context.membership),
    user,
  });
  if (!lesson) throw new NotFoundError("Lesson not found.");
  return { user, lesson };
}

export async function requireStudentLesson(lessonId: string) {
  const access = await requireLesson(lessonId);
  if (access.user.user_metadata.role !== "student") throw new ForbiddenError("Student access required.");
  return access;
}
