"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { normalizeOrganizationCode, validateOrganizationCode } from "@/lib/auth/organization-code";
import { validateTenantName } from "@/lib/validation/tenant";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { getPublicAuthCopy } from "@/lib/public/auth-copy";
import { getPublicCopy } from "@/lib/public/i18n";
import { usePublicLanguagePreference } from "@/lib/public/use-public-language";
import { ArrowRight, BookOpenCheck, Building2, GraduationCap, UserRound, UsersRound } from "lucide-react";

type Role = "teacher" | "student";
type AccountType = "organization" | "individual";
type OrganizationMode = "join" | "create";
type SignupStep = "space" | "role" | "account";
type OrganizationLookup = {
  slug: string;
  name: string;
  portalName: string | null;
  ssoEnabled: boolean;
};

const roleDetails = {
  teacher: {
    label: "Teacher",
    icon: UsersRound,
    copy: "Create courses, manage classes, grade work, and publish catalog items.",
  },
  student: {
    label: "Student",
    icon: BookOpenCheck,
    copy: "Join learning spaces, take lessons, track grades, and save progress.",
  },
};

function SignupForm() {
  const searchParams = useSearchParams();
  const { language, querySuffix } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicCopy(language), [language]);
  const authCopy = useMemo(() => getPublicAuthCopy(language), [language]);
  const preset = searchParams.get("role");
  const presetMode = searchParams.get("mode");
  const presetOrganization = normalizeOrganizationCode(searchParams.get("org") || searchParams.get("tenant") || "");
  const initialRole: Role = preset === "teacher" ? "teacher" : "student";
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [step, setStep] = useState<SignupStep>("space");
  const [accountType, setAccountType] = useState<AccountType>(
    presetOrganization || presetMode === "organization" ? "organization" : "individual",
  );
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>("join");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState(presetOrganization);
  const [organizationLookup, setOrganizationLookup] = useState<OrganizationLookup | null>(null);
  const [organizationStatus, setOrganizationStatus] = useState<"idle" | "checking" | "found" | "missing">(
    presetOrganization ? "checking" : "idle",
  );
  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const organizationLabel =
    organizationMode === "create"
      ? organizationName
      : organizationLookup?.name || organizationCode;
  const roleLabel = role === "teacher" ? authCopy.teacher : authCopy.student;
  const waitingForOrganization =
    accountType === "organization" && organizationMode === "join" && organizationStatus === "checking";

  useEffect(() => {
    if (preset === "teacher" || preset === "student") {
      setRole(preset);
    }
  }, [preset]);

  useEffect(() => {
    if (accountType !== "organization" || organizationMode !== "join" || !organizationCode.trim()) {
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
  }, [accountType, organizationCode, organizationMode]);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(authCopy.passwordMin);
      return;
    }

    setLoading(true);
    const { data, error } = await edsync.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          account_type: accountType,
          organization_mode: accountType === "organization" ? organizationMode : undefined,
          organization_name: accountType === "organization" && organizationMode === "create" ? organizationName : undefined,
          organization_code: accountType === "organization" && organizationMode === "join" ? organizationCode : undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/login${querySuffix}`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (
        error.status === 401 ||
        message.includes("invalid api key") ||
        message.includes("apikey")
      ) {
        toast.error("edsync anon key is invalid. Check .env.local.", {
          duration: 9000,
        });
      } else if (message.includes("already registered")) {
        toast.error(authCopy.emailAlreadyRegistered);
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setEmailSent(true);
      setLoading(false);
      return;
    }

    if (data.session && data.user) {
      const tenantSlug = data.user.user_metadata?.tenant_slug || normalizeOrganizationCode(organizationCode);
      await edsync.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          preferences: {
            theme: "light",
            text_size: "medium",
            onboarding_space: accountType,
            onboarding_organization: accountType === "organization"
              ? organizationMode === "create"
                ? organizationName
                : organizationCode
              : null,
          },
          subjects: [],
          interests: [],
        },
        { onConflict: "id" },
      );

      window.localStorage.setItem(
        "edsync-auth-workspace",
        JSON.stringify({
          type: accountType,
          organizationCode: accountType === "organization" ? tenantSlug : null,
          organizationName: data.user.user_metadata?.tenant_name || organizationName || null,
          signedInAt: new Date().toISOString(),
        }),
      );

      toast.success(authCopy.accountCreated);
      const destination = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
      router.push(accountType === "organization" && tenantSlug ? `${destination}?tenant=${encodeURIComponent(tenantSlug)}` : destination);
      router.refresh();
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-5 text-center">
        <h2 className="font-display text-3xl font-bold">{authCopy.checkEmail}</h2>
        <p className="text-sm leading-6 text-edsync-subtle">
          {authCopy.emailSent}{" "}
          <span className="font-semibold text-edsync-blue">{email}</span>.
        </p>
        <Link href={`/auth/login${querySuffix}`} className="btn-secondary inline-flex">
          {copy.signIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-edsync-subtle">
        {[
          ["space", authCopy.spaceStep],
          ["role", authCopy.roleStep],
          ["account", authCopy.accountStep],
        ].map(([key, label]) => (
          <span
            key={key}
            className={`rounded-full border px-3 py-1 shadow-sm ${
              step === key
                ? "premium-active"
                : "border-edsync-border bg-edsync-surface"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {step === "space" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              {
                key: "organization" as const,
                label: authCopy.enterOrganization,
                copy: authCopy.organizationCopy,
                icon: Building2,
              },
              {
                key: "individual" as const,
                label: authCopy.useIndividual,
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
                  <span className="mt-1 block text-xs">{item.copy}</span>
                </button>
              );
            })}
          </div>
          {accountType === "organization" && (
            <div className="premium-surface space-y-3 rounded-2xl p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["join", authCopy.joinExisting],
                  ["create", authCopy.createNew],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOrganizationMode(mode)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      organizationMode === mode
                        ? "premium-active"
                        : "border-edsync-border bg-edsync-card text-edsync-subtle hover:border-edsync-blue/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
                {organizationMode === "join" ? authCopy.organizationCode : authCopy.organizationName}
              </label>
              <input
                type="text"
                value={organizationMode === "join" ? organizationCode : organizationName}
                onChange={(event) => {
                  if (organizationMode === "join") {
                    setOrganizationCode(event.target.value);
                  } else {
                    setOrganizationName(event.target.value);
                  }
                }}
                placeholder={organizationMode === "join" ? "example-academy" : "Example Academy"}
                className="edsync-input"
              />
              <p className="text-xs leading-5 text-edsync-subtle">
                {organizationMode === "join"
                  ? "Use the code or slug shared by your school, company, or academy."
                  : "Create an organization you own and manage."}
              </p>
              {organizationMode === "join" && organizationStatus !== "idle" && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    organizationStatus === "found"
                      ? "border-edsync-emerald/30 bg-edsync-emerald/10 text-edsync-emerald"
                      : organizationStatus === "checking"
                        ? "border-edsync-blue/25 bg-edsync-blue/10 text-edsync-blue"
                        : "border-edsync-amber/30 bg-edsync-amber/10 text-edsync-amber"
                  }`}
                >
                  {organizationStatus === "found"
                    ? `Found ${organizationLookup?.name}${organizationLookup?.portalName ? ` - ${organizationLookup.portalName}` : ""}.`
                    : organizationStatus === "checking"
                      ? authCopy.checkingOrganization
                      : authCopy.missingOrganization}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (accountType === "organization" && organizationMode === "join" && !organizationCode.trim()) {
                toast.error(authCopy.enterOrganizationCodeFirst);
                return;
              }
              if (accountType === "organization" && organizationMode === "join") {
                try {
                  validateOrganizationCode(organizationCode);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : authCopy.enterOrganizationCodeFirst);
                  return;
                }
              }
              if (accountType === "organization" && organizationMode === "join" && organizationStatus === "checking") {
                toast.error(authCopy.stillCheckingOrganization);
                return;
              }
              if (accountType === "organization" && organizationMode === "join" && !organizationLookup) {
                toast.error(authCopy.chooseActiveOrganization);
                return;
              }
              if (accountType === "organization" && organizationMode === "create" && !organizationName.trim()) {
                toast.error(authCopy.enterOrganizationNameFirst);
                return;
              }
              if (accountType === "organization" && organizationMode === "create") {
                try {
                  validateTenantName(organizationName);
                } catch (error) {
                  const message = error instanceof Error
                    ? error.message.replace("Tenant", "Organization")
                    : authCopy.enterOrganizationNameFirst;
                  toast.error(message);
                  return;
                }
              }
              setStep("role");
            }}
            disabled={waitingForOrganization}
            className="btn-primary w-full justify-center py-3.5"
          >
            {waitingForOrganization ? authCopy.checkingOrganization : authCopy.continue}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === "role" && (
        <div className="space-y-4">
          <div className="premium-surface rounded-2xl p-3 text-sm text-edsync-subtle">
            {accountType === "organization"
              ? organizationMode === "create"
                ? `${authCopy.newOrganization}: ${organizationLabel}`
                : `${authCopy.joiningOrganization}: ${organizationLabel}`
              : authCopy.individualWorkspace}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
        {(["teacher", "student"] as const).map((item) => {
          const Icon = roleDetails[item].icon;
          const selected = role === item;
          const itemLabel = item === "teacher" ? authCopy.teacher : authCopy.student;
          const itemCopy = item === "teacher" ? authCopy.teacherCopy : authCopy.studentCopy;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                selected
                  ? "premium-active text-edsync-text"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:-translate-y-0.5 hover:border-edsync-blue/50 hover:text-edsync-text"
              }`}
            >
              <Icon className="mb-3 h-5 w-5" />
              <span className="block font-semibold">{itemLabel}</span>
              <span className="mt-1 block text-xs">
                {itemCopy}
              </span>
            </button>
          );
        })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setStep("space")} className="btn-secondary justify-center py-3">
              {authCopy.back}
            </button>
            <button type="button" onClick={() => setStep("account")} className="btn-primary justify-center py-3">
              {authCopy.continue}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === "account" && (
        <div className="space-y-5">
          <div className="premium-surface rounded-2xl p-3 text-sm text-edsync-subtle">
            {accountType === "organization"
              ? organizationMode === "create"
                ? `${organizationLabel} - ${roleLabel}`
                : `${organizationLabel} - ${roleLabel}`
              : `${authCopy.individual} - ${roleLabel}`}
          </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
          {authCopy.fullName}
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Your full name"
          required
          className="edsync-input"
        />
      </div>
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
          minLength={8}
          required
          className="edsync-input"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center py-3.5"
      >
        {loading ? authCopy.creatingAccount : `${copy.createWorkspace} - ${roleLabel}`}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => setStep("role")} className="btn-secondary w-full justify-center py-3">
        {authCopy.back}
      </button>
        </div>
      )}
    </form>
  );
}

function SignupPanelTitle() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicCopy(language), [language]);

  return <h2 className="font-display text-3xl font-bold">{copy.createWorkspace}</h2>;
}

function SignupLoginLink() {
  const { querySuffix, language } = usePublicLanguagePreference();
  const authCopy = useMemo(() => getPublicAuthCopy(language), [language]);
  const publicCopy = useMemo(() => getPublicCopy(language), [language]);

  return (
    <p className="mt-6 text-center text-sm text-edsync-subtle">
      {authCopy.alreadyHaveAccount}{" "}
      <Link
        href={`/auth/login${querySuffix}`}
        className="font-semibold text-edsync-blue hover:underline"
      >
        {publicCopy.signIn}
      </Link>
    </p>
  );
}

function SignupSidePanelCopy() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicAuthCopy(language), [language]);

  return (
    <>
      <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
        {copy.createRightSpaceTitle}
      </h1>
      <p className="mt-4 max-w-lg leading-7 text-edsync-subtle">
        {copy.signupPanelCopy}
      </p>
    </>
  );
}

function SignupOrganizationBenefits() {
  const { language } = usePublicLanguagePreference();
  const copy = useMemo(() => getPublicAuthCopy(language), [language]);

  return <>{copy.organizationBenefits}</>;
}

export default function SignupPage() {
  return (
    <main className="premium-shell grid min-h-screen overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_560px]">
      <section className="hidden border-r border-edsync-border bg-edsync-surface/70 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-edsync-blue shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">EdSync</span>
        </Link>
        <div className="premium-panel rounded-[1.65rem] p-7">
          <Suspense fallback={null}>
            <SignupSidePanelCopy />
          </Suspense>
        </div>
        <p className="text-sm text-edsync-subtle">
          <Suspense fallback={<span>Individuals stay simple. Organizations get scoped portals, catalogs, and role controls.</span>}>
            <SignupOrganizationBenefits />
          </Suspense>
        </p>
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
            <Suspense fallback={<h2 className="font-display text-3xl font-bold">Create workspace</h2>}>
              <SignupPanelTitle />
            </Suspense>
            <div className="mt-7">
              <Suspense
                fallback={
                  <div className="h-72 animate-pulse rounded-lg bg-edsync-surface" />
                }
              >
                <SignupForm />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <SignupLoginLink />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
