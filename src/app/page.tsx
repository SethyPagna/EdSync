import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

  const host = (await headers()).get("host")?.trim().toLowerCase().split(":")[0];
  const isDemoSite = process.env.EDSYNC_DEMO_MODE === "1" &&
    Boolean(host && host === process.env.EDSYNC_DEMO_HOSTNAME?.trim().toLowerCase());
  if (isDemoSite) {
    return <CatalogPage searchParams={Promise.resolve(resolvedSearchParams ?? {})} />;
  }

  const context = await resolveTenantContext(null).catch(() => null);
  if (
    context?.portal?.slug &&
    ["public", "customer", "partner"].includes(context.portal.audience)
  ) {
    redirect(publicLanguageHref(`/org/${context.portal.slug}`, resolvedSearchParams?.language, { tenant: context.tenant.slug }));
  }

  return <CatalogPage searchParams={Promise.resolve(resolvedSearchParams ?? {})} />;
}
