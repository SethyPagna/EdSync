import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, GraduationCap } from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { getPublicCopy } from "@/lib/public/i18n";
import { publicLanguageHref } from "@/lib/public/languages";

export default async function PublicLaunchChrome() {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const signedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const publicLanguage = cookieStore.get("edsync-language")?.value;
  const copy = getPublicCopy(publicLanguage);
  const loginHref = publicLanguageHref("/auth/login", publicLanguage);
  const workspaceHref =
    role === "admin"
      ? "/admin/dashboard"
      : role === "teacher"
        ? "/teacher/dashboard"
        : role === "student"
          ? "/student/dashboard"
          : "/auth/login";

  return (
    <div className="edsync-launch-chrome" role="navigation" aria-label="EdSync public navigation">
      <Link href="/" className="edsync-launch-brand" aria-label="EdSync home">
        <span className="edsync-launch-brand-mark">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span>
          <strong>EdSync</strong>
          <small>{copy.brandSubhead}</small>
        </span>
      </Link>

      <div className="edsync-launch-actions">
        <ThemeToggle compact className="edsync-launch-icon" />
        <LanguageMenu compact syncCatalogFilter className="edsync-launch-icon" />
        <Link href={signedIn ? workspaceHref : loginHref} className="edsync-launch-signin">
          <span>{signedIn ? "Workspace" : copy.signIn}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
