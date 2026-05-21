"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import {
  DEFAULT_PUBLIC_LANGUAGE,
  EDSYNC_LANGUAGES,
  languageCodeFor,
  languageLabelFor,
  normalizePublicLanguage,
  type PublicLanguageName,
} from "@/lib/public/languages";
import { publicLanguageRouteWithSearch, shouldSyncPublicLanguagePath } from "@/lib/public/language-routing";

type LanguageMenuProps = {
  compact?: boolean;
  syncCatalogFilter?: boolean;
  align?: "left" | "right";
  className?: string;
};

function cookieLanguage() {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("edsync-language="))
    ?.split("=")[1];
  return match ? decodeURIComponent(match) : null;
}

function queryLanguage() {
  const value = new URLSearchParams(window.location.search).get("language");
  return value ? decodeURIComponent(value) : null;
}

function persistLanguage(language: PublicLanguageName) {
  const code = languageCodeFor(language);
  window.localStorage.setItem("edsync-language", language);
  document.cookie = `edsync-language=${encodeURIComponent(language)}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `edsync-language-code=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = code;
}

export default function LanguageMenu({
  compact = false,
  syncCatalogFilter = false,
  align = "right",
  className = "",
}: LanguageMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [language, setLanguage] = useState<PublicLanguageName>(DEFAULT_PUBLIC_LANGUAGE);

  useEffect(() => {
    const queryValue = queryLanguage();
    const stored = queryValue || window.localStorage.getItem("edsync-language") || cookieLanguage() || DEFAULT_PUBLIC_LANGUAGE;
    const nextLanguage = normalizePublicLanguage(stored);
    setLanguage(nextLanguage);
    persistLanguage(nextLanguage);
  }, []);

  const chooseLanguage = (nextLanguage: PublicLanguageName) => {
    setLanguage(nextLanguage);
    persistLanguage(nextLanguage);
    window.dispatchEvent(new CustomEvent("edsync-language-change", { detail: { language: nextLanguage } }));
    detailsRef.current?.removeAttribute("open");

    if (syncCatalogFilter) {
      const { pathname, search } = window.location;
      if (!shouldSyncPublicLanguagePath(pathname)) return;
      window.location.assign(publicLanguageRouteWithSearch({ pathname, search, language: nextLanguage }));
    }
  };
  const languageLabel = languageLabelFor(language);

  return (
    <details ref={detailsRef} className={`group relative inline-block ${className}`}>
      <summary
        className={`${compact ? "premium-icon-button" : "btn-secondary px-4 py-2 text-sm"} list-none marker:hidden [&::-webkit-details-marker]:hidden`}
        aria-label="Language"
        title={languageLabel}
      >
        <Languages className="h-4 w-4" />
        {!compact && <span>{language}</span>}
      </summary>
      <div
        className={`premium-overlay animate-overlay-in absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl p-2 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <div className="px-2 pb-2 pt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">
            {languageLabel}
          </p>
        </div>
        <div className="grid gap-1">
          {EDSYNC_LANGUAGES.map((item) => {
            const selected = item.name === language;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => chooseLanguage(item.name)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  selected
                    ? "premium-active"
                    : "text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text"
                }`}
              >
                <span>{item.name}</span>
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
