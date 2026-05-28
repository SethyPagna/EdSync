import { redirect } from "next/navigation";
import CatalogPage from "./catalog/page";
import { getSessionUser } from "@/lib/auth/session";
import type { CatalogSearchParams } from "@/lib/catalog/filters";
import { publicLanguageHref } from "@/lib/public/languages";
import { resolveTenantContext } from "@/lib/tenancy";

export default async function RootPage({
  searchParams,
}: {
  searchParams?: Promise<CatalogSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
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
    redirect(publicLanguageHref(`/org/${context.portal.slug}`, resolvedSearchParams?.language));
  }

  return <CatalogPage searchParams={Promise.resolve(resolvedSearchParams ?? {})} />;
}
