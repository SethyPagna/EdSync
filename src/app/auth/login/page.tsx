"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { ArrowRight, GraduationCap, ShieldCheck } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { data, error } = await edsync.auth.signInWithPassword({
      email,
      password,
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
    const next = searchParams.get("next");
    const safeNext =
      next && (next.startsWith("/teacher") || next.startsWith("/student"))
        ? next
        : role === "teacher"
          ? "/teacher/dashboard"
          : "/student/dashboard";

    toast.success("Welcome back.");
    router.push(safeNext);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
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
            Secure role-aware workspace
          </p>
          <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
            Pick up right where your learning evidence left off.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-edsync-subtle">
            Teachers see class actions. Students see their next step. EdSync
            keeps both views connected by progress and reflection data.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-edsync-subtle">
          <ShieldCheck className="h-5 w-5 text-edsync-emerald" />
          edsync Auth with protected teacher and student portals.
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
            <p className="mt-2 text-sm leading-6 text-edsync-subtle">
              Sign in to continue your teacher or student workspace.
            </p>
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
