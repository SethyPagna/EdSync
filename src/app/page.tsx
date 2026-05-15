import { redirect } from "next/navigation";
import CatalogPage from "./catalog/page";
import { getSessionUser } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/tenancy";

export default async function RootPage({
  searchParams,
}: {
  searchParams?: { q?: string; portal?: string; tenant?: string };
}) {
  const user = await getSessionUser().catch(() => null);

  if (user) {
    redirect(
      user.user_metadata.role === "admin"
        ? "/admin/dashboard"
        : user.user_metadata.role === "teacher"
        ? "/teacher/dashboard"
        : "/student/dashboard",
    );
  }

  const context = await resolveTenantContext(null).catch(() => null);
  if (
    context?.portal?.slug &&
    ["public", "customer", "partner"].includes(context.portal.audience)
  ) {
    redirect(`/org/${context.portal.slug}`);
  }

  return <CatalogPage searchParams={searchParams} />;
}
