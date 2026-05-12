"use client";
import { createBrowserClient } from "@supabase/ssr";

// @supabase/ssr v0.6.x attaches apikey + Authorization headers internally.
// Passing global.headers manually breaks the fetch pipeline → "No API key found".
// Let the library handle headers on its own.

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createBrowserClient(
      "https://example.supabase.co",
      "missing-supabase-anon-key",
    );
  }

  return createBrowserClient(url, key);
}
