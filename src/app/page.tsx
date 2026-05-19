import { redirect } from "next/navigation";
import CatalogPage from "./catalog/page";
import { getSessionUser } from "@/lib/auth/session";
import { publicLanguageHref } from "@/lib/public/languages";
import { resolveTenantContext } from "@/lib/tenancy";

type RootSearchParams = {
  q?: string;
  portal?: string;
  tenant?: string;
  price?: string;
  category?: string;
  difficulty?: string;
  language?: string;
  courseLanguage?: string;
  duration?: string;
};

export default async function RootPage({
  searchParams,
}: {
  searchParams?: RootSearchParams;
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
    redirect(publicLanguageHref(`/org/${context.portal.slug}`, searchParams?.language));
  }

  return <CatalogPage searchParams={searchParams} />;
}
