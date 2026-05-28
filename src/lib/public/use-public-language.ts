"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_PUBLIC_LANGUAGE,
  normalizePublicLanguage,
  publicLanguageQuerySuffix,
  type PublicLanguageName,
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

export function usePublicLanguagePreference() {
  const searchParams = useSearchParams();
  const queryLanguage = searchParams.get("language");
  const [storedLanguage, setStoredLanguage] = useState<PublicLanguageName>(readStoredLanguage);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ language?: string }>).detail?.language;
      setStoredLanguage(normalizePublicLanguage(nextLanguage));
    };
    window.addEventListener("edsync-language-change", handleLanguageChange);
    return () => window.removeEventListener("edsync-language-change", handleLanguageChange);
  }, []);

  const language = useMemo(
    () => (queryLanguage ? normalizePublicLanguage(queryLanguage) : storedLanguage),
    [queryLanguage, storedLanguage],
  );
  const querySuffix = useMemo(() => publicLanguageQuerySuffix(language), [language]);

  return { language, querySuffix };
}
