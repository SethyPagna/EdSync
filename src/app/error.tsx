"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 rounded-2xl bg-edsync-blue/10 p-4 text-edsync-blue">
        <RotateCcw size={28} />
      </span>
      <h1 className="font-display text-2xl font-bold">Let’s try that again</h1>
      <p className="mt-3 text-sm leading-6 text-edsync-subtle">
        This page couldn’t load. Retry, or head back to your workspace.
      </p>
      <div className="mt-6 flex gap-3">
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn-secondary" href="/">
          <ArrowLeft size={16} />
          Home
        </Link>
      </div>
    </section>
  );
}
