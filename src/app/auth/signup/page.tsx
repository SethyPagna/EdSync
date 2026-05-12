"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, BookOpenCheck, GraduationCap, UsersRound } from "lucide-react";

type Role = "teacher" | "student";

const roleDetails = {
  teacher: {
    label: "Teacher",
    icon: UsersRound,
    copy: "Create classes, generate lessons, assign work, and monitor progress.",
  },
  student: {
    label: "Student",
    icon: BookOpenCheck,
    copy: "Join classes, follow guided lessons, reflect, and build mastery.",
  },
};

function SignupForm() {
  const searchParams = useSearchParams();
  const preset = searchParams.get("role");
  const initialRole: Role = preset === "teacher" ? "teacher" : "student";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
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
        toast.error("Supabase anon key is invalid. Check .env.local.", {
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
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
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
        <p className="text-sm leading-6 text-atlas-subtle">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-atlas-blue">{email}</span>.
        </p>
        <Link href="/auth/login" className="btn-secondary inline-flex">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
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
                  ? "border-atlas-blue bg-atlas-blue/10 text-atlas-text"
                  : "border-atlas-border bg-atlas-surface text-atlas-subtle hover:border-atlas-blue/50"
              }`}
            >
              <Icon className="mb-3 h-5 w-5" />
              <span className="block font-semibold">{roleDetails[item].label}</span>
              <span className="mt-1 block text-xs leading-5">
                {roleDetails[item].copy}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-atlas-subtle">
          Full name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Your full name"
          required
          className="atlas-input"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-atlas-subtle">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.edu"
          required
          className="atlas-input"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-atlas-subtle">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          minLength={8}
          required
          className="atlas-input"
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
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="grid min-h-screen bg-atlas-bg lg:grid-cols-[1fr_560px]">
      <section className="hidden border-r border-atlas-border bg-atlas-surface/40 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-atlas-blue to-atlas-emerald">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">EdSync</span>
        </Link>
        <div>
          <p className="mb-4 inline-flex rounded-lg border border-atlas-border bg-atlas-card px-3 py-2 text-sm text-atlas-subtle">
            Personalized learning from the first session
          </p>
          <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
            Build a workspace around the way your class learns.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-atlas-subtle">
            Teachers get planning and intervention tools. Students get a clear
            path through lessons, practice, reflection, and next steps.
          </p>
        </div>
        <p className="text-sm text-atlas-subtle">
          Configure Supabase Auth and EdSync handles role routing automatically.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-atlas-blue to-atlas-emerald">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">EdSync</span>
            </Link>
          </div>
          <div className="atlas-card p-7">
            <h2 className="font-display text-3xl font-bold">Create account</h2>
            <p className="mt-2 text-sm leading-6 text-atlas-subtle">
              Choose the workspace type that matches your role.
            </p>
            <div className="mt-7">
              <Suspense
                fallback={
                  <div className="h-72 animate-pulse rounded-lg bg-atlas-surface" />
                }
              >
                <SignupForm />
              </Suspense>
            </div>
            <p className="mt-6 text-center text-sm text-atlas-subtle">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-atlas-blue hover:underline"
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
