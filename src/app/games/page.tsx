import { redirect } from "next/navigation";
import { normalizeAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Games",
  description: "Game-like sprint and matching modes in EdSync Practice.",
};

type GamesPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default function GamesPage({ searchParams }: GamesPageProps) {
  const params = new URLSearchParams({ mode: "sprint" });
  const adminView = normalizeAdminViewMode(searchParams?.adminView);
  if (adminView) {
    params.set("adminView", adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
