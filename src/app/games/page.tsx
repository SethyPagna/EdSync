import { redirect } from "next/navigation";

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
  if (searchParams?.adminView === "teacher" || searchParams?.adminView === "student") {
    params.set("adminView", searchParams.adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
