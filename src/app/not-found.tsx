import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Compass size={40} strokeWidth={1.5} className="mb-5 text-edsync-blue" />
      <p className="mb-2 text-xs uppercase tracking-widest text-edsync-subtle">
        404 · A little off course
      </p>
      <h1 className="font-display text-3xl font-bold">
        Let’s find your way back.
      </h1>
      <p className="mt-3 text-sm text-edsync-subtle">
        This page may have moved, or the portal is no longer public.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to EdSync
      </Link>
    </main>
  );
}
