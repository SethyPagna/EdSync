"use client";

import { useEffect, useState } from "react";
import { Check, Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const EDSYNC_LANGUAGES = [
  { name: "English", code: "en" },
  { name: "Korean", code: "ko" },
  { name: "Khmer", code: "km" },
  { name: "Chinese", code: "zh" },
  { name: "Japanese", code: "ja" },
  { name: "Spanish", code: "es" },
  { name: "French", code: "fr" },
  { name: "Vietnamese", code: "vi" },
  { name: "Thai", code: "th" },
] as const;

type LanguageName = (typeof EDSYNC_LANGUAGES)[number]["name"];

type LanguageMenuProps = {
  compact?: boolean;
  syncCatalogFilter?: boolean;
  align?: "left" | "right";
  className?: string;
};

const DEFAULT_LANGUAGE: LanguageName = "English";

function languageCodeFor(name: string) {
  return EDSYNC_LANGUAGES.find((language) => language.name === name)?.code ?? "en";
}

export default function LanguageMenu({
  compact = false,
  syncCatalogFilter = false,
  align = "right",
  className = "",
}: LanguageMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LanguageName>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-language") || DEFAULT_LANGUAGE;
    const nextLanguage = EDSYNC_LANGUAGES.some((item) => item.name === stored)
      ? (stored as LanguageName)
      : DEFAULT_LANGUAGE;
    setLanguage(nextLanguage);
    document.documentElement.lang = languageCodeFor(nextLanguage);
  }, []);

  const chooseLanguage = (nextLanguage: LanguageName) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("edsync-language", nextLanguage);
    document.documentElement.lang = languageCodeFor(nextLanguage);

    if (syncCatalogFilter && (pathname.startsWith("/catalog") || pathname.startsWith("/org/"))) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("language", nextLanguage);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <details className={`group relative inline-block ${className}`}>
      <summary
        className={`${compact ? "premium-icon-button" : "btn-secondary px-4 py-2 text-sm"} list-none marker:hidden [&::-webkit-details-marker]:hidden`}
        aria-label="Choose language"
        title="Choose language"
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
          <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Language</p>
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
