"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { ArrowRight, Building2, GraduationCap, ShieldCheck, UserRound } from "lucide-react";

type AccountType = "organization" | "individual";
type OrganizationLookup = {
  slug: string;
  name: string;
  portalSlug: string | null;
  portalName: string | null;
  ssoEnabled: boolean;
};

function normalizeOrganizationCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function LoginForm() {
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const code = normalizeOrganizationCode(organizationCode);
    if (accountType !== "organization" || !code) {
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
  }, [accountType, organizationCode]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedOrganizationCode = normalizeOrganizationCode(organizationCode);
    if (accountType === "organization" && !normalizedOrganizationCode) {
      toast.error("Enter your organization code first.");
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
        toast.error("Please confirm your email before signing in.");
      } else if (message.includes("invalid login credentials")) {
        toast.error("Wrong email or password.");
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    const role = (data.user?.user_metadata?.role as string) || "student";
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

    toast.success("Welcome back.");
    router.push(safeNext);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          {
            key: "organization" as const,
            label: "Organization",
            copy: "School, academy, company, or cohort.",
            icon: Building2,
          },
          {
            key: "individual" as const,
            label: "Individual",
            copy: "Personal teacher or learner workspace.",
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
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-edsync-blue bg-edsync-blue/10 text-edsync-text"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
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
        <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
          <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
            Organization code
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
              href={organizationLookup?.slug ? `/org/${organizationLookup.slug}` : "/catalog"}
              className="btn-secondary justify-center px-3 py-2 text-sm"
            >
              Open portal
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
              SSO options
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
                ? `Found ${organizationLookup?.name}${organizationLookup?.portalName ? ` - ${organizationLookup.portalName}` : ""}.`
                : organizationStatus === "checking"
                  ? "Checking organization..."
                  : "No active organization found for that code yet."}
            </div>
          )}
        </div>
      )}

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
          autoComplete="email"
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
          required
          autoComplete="current-password"
          className="edsync-input"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center py-3.5"
      >
        {loading ? "Signing in..." : "Sign in"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-edsync-bg lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r border-edsync-border bg-edsync-surface/40 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">EdSync</span>
        </Link>
        <div>
          <p className="mb-4 inline-flex rounded-lg border border-edsync-border bg-edsync-card px-3 py-2 text-sm text-edsync-subtle">
            Secure workspace
          </p>
          <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
            Learning work, organized.
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-edsync-subtle">
          <ShieldCheck className="h-5 w-5 text-edsync-emerald" />
          Protected teacher, student, and admin portals.
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">EdSync</span>
            </Link>
          </div>
          <div className="edsync-card p-7">
            <h2 className="font-display text-3xl font-bold">Welcome back</h2>
            <div className="mt-7">
              <Suspense
                fallback={
                  <div className="h-48 animate-pulse rounded-lg bg-edsync-surface" />
                }
              >
                <LoginForm />
              </Suspense>
            </div>
            <p className="mt-6 text-center text-sm text-edsync-subtle">
              New to EdSync?{" "}
              <Link
                href="/auth/signup"
                className="font-semibold text-edsync-blue hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
