import { redirect } from "next/navigation";
import { normalizeAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Games",
  description: "Game-like sprint and matching modes in EdSync Practice.",
};

type GamesPageProps = {
  searchParams?: Promise<{
    adminView?: string;
  }>;
};

export default async function GamesPage({ searchParams }: GamesPageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams({ mode: "sprint" });
  const adminView = normalizeAdminViewMode(resolvedSearchParams?.adminView);
  if (adminView) {
    params.set("adminView", adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
