import { redirect } from "next/navigation";
import { normalizeAiPromptContractId, type AiPromptSearchParams } from "@/lib/studio/catalog";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Practice & AI Tutor",
  description: "Guided AI prompt builder for lessons, notes, slides, and practice.",
};

type AiPageProps = {
  searchParams?: AiPromptSearchParams & {
    adminView?: string;
  };
};

export default async function AiPage({ searchParams }: AiPageProps) {
  const task = normalizeAiPromptContractId(searchParams?.task);
  const adminView = searchParams?.adminView === "teacher" || searchParams?.adminView === "student" ? searchParams.adminView : null;
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
