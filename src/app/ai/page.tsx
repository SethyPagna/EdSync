import { redirect } from "next/navigation";
import { normalizeAiPromptContractId, type AiPromptSearchParams } from "@/lib/studio/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Practice & AI Tutor",
  description: "Guided AI prompt builder for lessons, notes, slides, and practice.",
};

type AiPageProps = {
  searchParams?: Promise<AiPromptSearchParams & {
    adminView?: string;
  }>;
};

export default async function AiPage({ searchParams }: AiPageProps) {
  const resolvedSearchParams = await searchParams;
  const task = normalizeAiPromptContractId(resolvedSearchParams?.task);
  const adminView = normalizeAdminViewMode(resolvedSearchParams?.adminView);
  const nextParams = new URLSearchParams();
  if (task) nextParams.set("task", task);
  if (adminView) nextParams.set("adminView", adminView);
  const nextPath = `/ai${nextParams.size ? `?${nextParams.toString()}` : ""}`;

  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const practiceParams = new URLSearchParams({ ai: "1" });
  if (task) practiceParams.set("task", task);
  if (adminView) practiceParams.set("adminView", adminView);
  redirect(`/practice?${practiceParams.toString()}`);
}
