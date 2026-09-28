"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_PUBLIC_LANGUAGE,
  normalizePublicLanguage,
  publicLanguageQuerySuffix,
} from "./languages";

function readStoredLanguage() {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_LANGUAGE;
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith("edsync-language="))
    ?.split("=")[1];
  return normalizePublicLanguage(
    window.localStorage.getItem("edsync-language") ||
      (cookieValue ? decodeURIComponent(cookieValue) : null),
  );
}

function subscribeToStoredLanguage(notify: () => void) {
  window.addEventListener("edsync-language-change", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("edsync-language-change", notify);
    window.removeEventListener("storage", notify);
  };
}

export function usePublicLanguagePreference() {
  const searchParams = useSearchParams();
  const queryLanguage = searchParams.get("language");
  const storedLanguage = useSyncExternalStore(
    subscribeToStoredLanguage,
    readStoredLanguage,
    () => DEFAULT_PUBLIC_LANGUAGE,
  );

  const language = useMemo(
    () => (queryLanguage ? normalizePublicLanguage(queryLanguage) : storedLanguage),
    [queryLanguage, storedLanguage],
  );
  const querySuffix = useMemo(() => publicLanguageQuerySuffix(language), [language]);

  return { language, querySuffix };
}
