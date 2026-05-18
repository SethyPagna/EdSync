"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { normalizeOrganizationCode } from "@/lib/auth/organization-code";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
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
  const preset = searchParams.get("role");
  const presetOrganization = normalizeOrganizationCode(searchParams.get("org") || searchParams.get("tenant") || "");
  const initialRole: Role = preset === "teacher" ? "teacher" : "student";
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [step, setStep] = useState<SignupStep>("space");
  const [accountType, setAccountType] = useState<AccountType>(presetOrganization ? "organization" : "individual");
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
  const waitingForOrganization =
    accountType === "organization" && organizationMode === "join" && organizationStatus === "checking";

  useEffect(() => {
    if (preset === "teacher" || preset === "student") {
      setRole(preset);
    }
  }, [preset]);

  useEffect(() => {
    const code = normalizeOrganizationCode(organizationCode);
    if (accountType !== "organization" || organizationMode !== "join" || !code) {
      setOrganizationLookup(null);
      setOrganizationStatus("idle");
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
      toast.error("Password must be at least 8 characters.");
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
        emailRedirectTo: `${window.location.origin}/auth/login`,
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
        toast.error("This email is already registered. Try signing in.");
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

      toast.success("Account created.");
      const destination = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
      router.push(accountType === "organization" && tenantSlug ? `${destination}?tenant=${encodeURIComponent(tenantSlug)}` : destination);
      router.refresh();
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-5 text-center">
        <h2 className="font-display text-3xl font-bold">Check your email</h2>
        <p className="text-sm leading-6 text-edsync-subtle">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-edsync-blue">{email}</span>.
        </p>
        <Link href="/auth/login" className="btn-secondary inline-flex">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-edsync-subtle">
        {[
          ["space", "1 Workspace"],
          ["role", "2 Role"],
          ["account", "3 Account"],
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
                label: "Enter organization",
                copy: "Use a school, academy, company, cohort, or department portal.",
                icon: Building2,
              },
              {
                key: "individual" as const,
                label: "Use as individual",
                copy: "Start a personal teacher or learner workspace.",
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
                  ["join", "Join existing"],
                  ["create", "Create new"],
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
                {organizationMode === "join" ? "Organization code" : "Organization name"}
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
                      ? "Checking organization..."
                      : "No active organization found for that code yet."}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (accountType === "organization" && organizationMode === "join" && !organizationCode.trim()) {
                toast.error("Enter your organization code first.");
                return;
              }
              if (accountType === "organization" && organizationMode === "join" && organizationStatus === "checking") {
                toast.error("Still checking that organization.");
                return;
              }
              if (accountType === "organization" && organizationMode === "join" && !organizationLookup) {
                toast.error("Choose an active organization before continuing.");
                return;
              }
              if (accountType === "organization" && organizationMode === "create" && !organizationName.trim()) {
                toast.error("Enter your organization name first.");
                return;
              }
              setStep("role");
            }}
            disabled={waitingForOrganization}
            className="btn-primary w-full justify-center py-3.5"
          >
            {waitingForOrganization ? "Checking organization..." : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === "role" && (
        <div className="space-y-4">
          <div className="premium-surface rounded-2xl p-3 text-sm text-edsync-subtle">
            {accountType === "organization"
              ? organizationMode === "create"
                ? `New organization: ${organizationLabel}`
                : `Joining organization: ${organizationLabel}`
              : "Individual workspace"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
        {(["teacher", "student"] as const).map((item) => {
          const Icon = roleDetails[item].icon;
          const selected = role === item;
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
              <span className="block font-semibold">{roleDetails[item].label}</span>
              <span className="mt-1 block text-xs">
                {roleDetails[item].copy}
              </span>
            </button>
          );
        })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setStep("space")} className="btn-secondary justify-center py-3">
              Back
            </button>
            <button type="button" onClick={() => setStep("account")} className="btn-primary justify-center py-3">
              Continue
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
                ? `${organizationLabel} - ${roleDetails[role].label}`
                : `${organizationLabel} - ${roleDetails[role].label}`
              : `Individual - ${roleDetails[role].label}`}
          </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
          Full name
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
          Email
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
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
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
        {loading ? "Creating account..." : `Create ${roleDetails[role].label} workspace`}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => setStep("role")} className="btn-secondary w-full justify-center py-3">
        Back
      </button>
        </div>
      )}
    </form>
  );
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
          <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
            Create the right space first.
          </h1>
          <p className="mt-4 max-w-lg leading-7 text-edsync-subtle">
            Start as an individual or enter an organization before choosing teacher or student mode.
          </p>
        </div>
        <p className="text-sm text-edsync-subtle">
          Individuals stay simple. Organizations get scoped portals, catalogs, and role controls.
        </p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
        <div className="w-full max-w-[22rem] min-w-0 sm:max-w-md">
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
            <h2 className="font-display text-3xl font-bold">Create workspace</h2>
            <div className="mt-7">
              <Suspense
                fallback={
                  <div className="h-72 animate-pulse rounded-lg bg-edsync-surface" />
                }
              >
                <SignupForm />
              </Suspense>
            </div>
            <p className="mt-6 text-center text-sm text-edsync-subtle">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-edsync-blue hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
