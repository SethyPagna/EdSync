"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { ArrowRight, BookOpenCheck, Building2, GraduationCap, UserRound, UsersRound } from "lucide-react";

type Role = "teacher" | "student";
type AccountType = "organization" | "individual";
type SignupStep = "space" | "role" | "account";

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
  const initialRole: Role = preset === "teacher" ? "teacher" : "student";
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [step, setStep] = useState<SignupStep>("space");
  const [accountType, setAccountType] = useState<AccountType>("organization");
  const [organizationName, setOrganizationName] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (preset === "teacher" || preset === "student") {
      setRole(preset);
    }
  }, [preset]);

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
          organization_name: accountType === "organization" ? organizationName : undefined,
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
            onboarding_organization: accountType === "organization" ? organizationName : null,
          },
          subjects: [],
          interests: [],
        },
        { onConflict: "id" },
      );

      toast.success("Account created.");
      router.push(role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
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
            className={`rounded-full border px-3 py-1 ${
              step === key
                ? "border-edsync-blue bg-edsync-blue/10 text-edsync-blue"
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
                  className={`rounded-lg border p-4 text-left transition ${
                    selected
                      ? "border-edsync-blue bg-edsync-blue/10 text-edsync-text"
                      : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
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
            <div>
              <label className="mb-2 block text-sm font-semibold text-edsync-subtle">
                Organization name
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                placeholder="Example Academy"
                className="edsync-input"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (accountType === "organization" && !organizationName.trim()) {
                toast.error("Enter your organization name first.");
                return;
              }
              setStep("role");
            }}
            className="btn-primary w-full justify-center py-3.5"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === "role" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
            {accountType === "organization"
              ? `Organization workspace: ${organizationName}`
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
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-edsync-blue bg-edsync-blue/10 text-edsync-text"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
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
          <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
            {accountType === "organization"
              ? `${organizationName} - ${roleDetails[role].label}`
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
    <main className="grid min-h-screen bg-edsync-bg lg:grid-cols-[1fr_560px]">
      <section className="hidden border-r border-edsync-border bg-edsync-surface/40 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">EdSync</span>
        </Link>
        <div>
          <p className="mb-4 inline-flex rounded-lg border border-edsync-border bg-edsync-card px-3 py-2 text-sm text-edsync-subtle">
            Workspace-first setup
          </p>
          <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
            Build the right EdSync space first.
          </h1>
        </div>
        <p className="text-sm text-edsync-subtle">
          Individuals stay simple. Organizations get scoped portals, catalogs, and role controls.
        </p>
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
