import { DEFAULT_PUBLIC_LANGUAGE, normalizePublicLanguage, type PublicLanguageName } from "./languages";

const PUBLIC_LANGUAGE_SYNC_PREFIXES = ["/catalog", "/org/", "/showcase"] as const;

export function shouldSyncPublicLanguagePath(pathname: string) {
  return pathname === "/" || PUBLIC_LANGUAGE_SYNC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function publicLanguageRouteWithSearch({
  pathname,
  search,
  language,
}: {
  pathname: string;
  search: string;
  language: PublicLanguageName | string;
}) {
  const nextLanguage = normalizePublicLanguage(language);
  const params = new URLSearchParams(search);
  if (nextLanguage === DEFAULT_PUBLIC_LANGUAGE) {
    params.delete("language");
  } else {
    params.set("language", nextLanguage);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
