import type { Metadata } from "next";
import EmilIntroShowcase from "@/components/catalog/EmilIntroShowcase";
import { getPublicAuthCopy } from "@/lib/public/auth-copy";
import { getPublicCopy } from "@/lib/public/i18n";
import { normalizePublicLanguage } from "@/lib/public/languages";

export const metadata: Metadata = {
  title: "EdSync Launch Concept",
  description: "Alternate LEARN-inspired EdSync public intro concept.",
};

export default async function SkillShowcasePage({
  searchParams,
}: {
  searchParams?: Promise<{ language?: string }>;
}) {
  const params = await searchParams;
  const language = normalizePublicLanguage(params?.language);
  const copy = getPublicCopy(language);
  const authCopy = getPublicAuthCopy(language);

  return (
    <EmilIntroShowcase
      labels={{
        signIn: copy.signIn,
        start: copy.start,
        catalog: copy.catalogLabel,
        workflow: copy.workflowLabel,
        brandSubhead: copy.brandSubhead,
        search: copy.searchButton,
        courses: copy.courses,
        free: copy.free,
        paid: copy.paid,
        filters: copy.filters,
        individual: authCopy.individual,
        organization: authCopy.organization,
      }}
    />
  );
}
