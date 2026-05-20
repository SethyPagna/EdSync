"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { normalizeUserRole } from "@/lib/auth/roles";
import { normalizeOrganizationCode, validateOrganizationCode } from "@/lib/auth/organization-code";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { getPublicAuthCopy } from "@/lib/public/auth-copy";
import { getPublicCopy } from "@/lib/public/i18n";
import { usePublicLanguagePreference } from "@/lib/public/use-public-language";
import { ArrowRight, Building2, GraduationCap, ShieldCheck, UserRound } from "lucide-react";

type AccountType = "organization" | "individual";
type OrganizationLookup = {
  slug: string;
  name: string;
  portalSlug: string | null;
  portalName: string | null;
  ssoEnabled: boolean;
};

function LoginForm() {
  const searchParams = useSearchParams();
  const { language, querySuffix } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicCopy(language), [language]);
  const authCopy = useMemo(() => getPublicAuthCopy(language), [language]);
  const presetOrganization = normalizeOrganizationCode(searchParams.get("org") || searchParams.get("tenant") || "");
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [accountType, setAccountType] = useState<AccountType>(presetOrganization ? "organization" : "individual");
  const [organizationCode, setOrganizationCode] = useState(presetOrganization);
  const [organizationLookup, setOrganizationLookup] = useState<OrganizationLookup | null>(null);
  const [organizationStatus, setOrganizationStatus] = useState<"idle" | "checking" | "found" | "missing">(
    presetOrganization ? "checking" : "idle",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const waitingForOrganization =
    accountType === "organization" && organizationStatus === "checking";

  useEffect(() => {
    if (accountType !== "organization" || !organizationCode.trim()) {
      setOrganizationLookup(null);
      setOrganizationStatus("idle");
      return;
    }
    let code: string;
    try {
      code = validateOrganizationCode(organizationCode);
    } catch {
      setOrganizationLookup(null);
      setOrganizationStatus("missing");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setOrganizationStatus("checking");
      fetch(`/api/auth/organizations?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload?.data) {
            setOrganizationLookup(null);
            setOrganizationStatus("missing");
            return;
          }
          setOrganizationLookup(payload.data as OrganizationLookup);
          setOrganizationStatus("found");
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setOrganizationLookup(null);
            setOrganizationStatus("missing");
          }
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [accountType, organizationCode]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    let normalizedOrganizationCode = "";
    if (accountType === "organization") {
      try {
        normalizedOrganizationCode = validateOrganizationCode(organizationCode);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : authCopy.enterOrganizationCodeFirst);
        return;
      }
    }
    if (accountType === "organization" && organizationStatus === "checking") {
      toast.error(authCopy.stillCheckingOrganization);
      return;
    }
    if (accountType === "organization" && !organizationLookup) {
      toast.error(authCopy.chooseActiveOrganizationSignIn);
      return;
    }

    setLoading(true);

    const { data, error } = await edsync.auth.signInWithPassword({
      email,
      password,
      account_type: accountType,
      organization_code: accountType === "organization" ? normalizedOrganizationCode : undefined,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        toast.error(authCopy.confirmEmailFirst);
      } else if (message.includes("invalid login credentials")) {
        toast.error(authCopy.wrongCredentials);
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    const role = normalizeUserRole(data.user?.user_metadata?.role);
    if (!role) {
      toast.error(authCopy.missingRole);
      setLoading(false);
      return;
    }

    const tenantSlug = data.user?.user_metadata?.tenant_slug || normalizedOrganizationCode;
    const requestedNext = searchParams.get("next");
    const fallbackNext = accountType === "organization" && tenantSlug
      ? `${homeForRole(role)}?tenant=${encodeURIComponent(tenantSlug)}`
      : homeForRole(role);
    const safeNext = requestedNext ? safeNextPath(requestedNext, role) : fallbackNext;

    window.localStorage.setItem(
      "edsync-auth-workspace",
      JSON.stringify({
        type: accountType,
        organizationCode: accountType === "organization" ? tenantSlug : null,
        organizationName: data.user?.user_metadata?.tenant_name ?? null,
        signedInAt: new Date().toISOString(),
      }),
    );

    toast.success(authCopy.welcomeBack);
    router.push(safeNext);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          {
            key: "organization" as const,
            label: authCopy.organization,
            copy: authCopy.organizationCopy,
            icon: Building2,
          },
          {
            key: "individual" as const,
            label: authCopy.individual,
            copy: authCopy.individualCopy,
            icon: UserRound,
          },
        ]).map((item) => {
          const Icon = item.icon;
          const selected = accountType === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setAccountType(item.key)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                selected
                  ? "premium-active text-edsync-text"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:-translate-y-0.5 hover:border-edsync-blue/50 hover:text-edsync-text"
              }`}
            >
              <Icon className="mb-3 h-5 w-5" />
              <span className="block font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5">{item.copy}</span>
            </button>
          );
        })}
      </div>

      {accountType === "organization" && (
        <div className="premium-surface rounded-2xl p-3">
          <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
            {authCopy.organizationCode}
          </label>
          <input
            type="text"
            value={organizationCode}
            onChange={(event) => setOrganizationCode(event.target.value)}
            placeholder="example-academy"
            required={accountType === "organization"}
            autoComplete="organization"
            className="edsync-input"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href={organizationLookup?.slug ? `/org/${organizationLookup.slug}${querySuffix}` : `/catalog${querySuffix}`}
              className="btn-secondary justify-center px-3 py-2 text-sm"
            >
              {authCopy.openPortal}
            </Link>
            <button
              type="button"
              onClick={() =>
                toast(
                  organizationLookup?.ssoEnabled
                    ? `${organizationLookup.name} SSO is enabled. Provider handoff will be available from organization settings.`
                    : "Organization SSO can be enabled by the organization owner from portal settings.",
                  { duration: 7000 },
                )
              }
              className="btn-secondary justify-center px-3 py-2 text-sm"
            >
              {authCopy.ssoOptions}
            </button>
          </div>
          {organizationStatus !== "idle" && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                organizationStatus === "found"
                  ? "border-edsync-emerald/30 bg-edsync-emerald/10 text-edsync-emerald"
                  : organizationStatus === "checking"
                    ? "border-edsync-blue/25 bg-edsync-blue/10 text-edsync-blue"
                    : "border-edsync-amber/30 bg-edsync-amber/10 text-edsync-amber"
              }`}
            >
              {organizationStatus === "found"
                ? `${authCopy.foundOrganization} ${organizationLookup?.name}${organizationLookup?.portalName ? ` - ${organizationLookup.portalName}` : ""}.`
                : organizationStatus === "checking"
                  ? authCopy.checkingOrganization
                  : authCopy.missingOrganization}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
          {authCopy.email}
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.edu"
          required
          autoComplete="email"
          className="edsync-input"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
          {authCopy.password}
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={authCopy.passwordPlaceholder}
          required
          autoComplete="current-password"
          className="edsync-input"
        />
      </div>
      <button
        type="submit"
        disabled={loading || waitingForOrganization}
        className="btn-primary w-full justify-center py-3.5"
      >
        {loading ? authCopy.signingIn : waitingForOrganization ? authCopy.checkingOrganization : copy.signIn}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}

function LoginPanelTitle() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicAuthCopy(language), [language]);

  return <h2 className="font-display text-3xl font-bold">{copy.welcomeBack}</h2>;
}

function LoginSignupLink() {
  const { querySuffix, language } = usePublicLanguagePreference();
  const publicCopy = useMemo(() => getPublicCopy(language), [language]);
  const authCopy = useMemo(() => getPublicAuthCopy(language), [language]);

  return (
    <p className="mt-6 text-center text-sm text-edsync-subtle">
      {authCopy.newToEdSync}{" "}
      <Link
        href={`/auth/signup${querySuffix}`}
        className="font-semibold text-edsync-blue hover:underline"
      >
        {publicCopy.createWorkspace}
      </Link>
    </p>
  );
}

function LoginSidePanelCopy() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicAuthCopy(language), [language]);

  return (
    <>
      <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
        {copy.workspaceTitle}
      </h1>
      <p className="mt-4 max-w-lg leading-7 text-edsync-subtle">
        {copy.workspaceCopy}
      </p>
    </>
  );
}

function ProtectedPortalsCopy() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicAuthCopy(language), [language]);

  return <span>{copy.protectedPortals}</span>;
}

export default function LoginPage() {
  return (
    <main className="premium-shell grid min-h-screen overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="hidden border-r border-edsync-border bg-edsync-surface/70 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-edsync-blue shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">EdSync</span>
        </Link>
        <div className="premium-panel rounded-[1.65rem] p-7">
          <Suspense fallback={null}>
            <LoginSidePanelCopy />
          </Suspense>
        </div>
        <div className="flex items-center gap-3 text-sm text-edsync-subtle">
          <ShieldCheck className="h-5 w-5 text-edsync-emerald" />
          <Suspense fallback={<span>Protected teacher, student, and admin portals.</span>}>
            <ProtectedPortalsCopy />
          </Suspense>
        </div>
      </section>

      <section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
        <div className="w-full max-w-[18rem] min-w-0 sm:max-w-md">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-edsync-blue shadow-sm">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">EdSync</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <LanguageMenu compact />
            </div>
          </div>
          <div className="premium-panel animate-reveal-soft rounded-[1.35rem] p-5 sm:rounded-[1.65rem] sm:p-7">
            <Suspense fallback={<h2 className="font-display text-3xl font-bold">Sign in</h2>}>
              <LoginPanelTitle />
            </Suspense>
            <div className="mt-7">
              <Suspense
                fallback={
                  <div className="h-48 animate-pulse rounded-lg bg-edsync-surface" />
                }
              >
                <LoginForm />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <LoginSignupLink />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
