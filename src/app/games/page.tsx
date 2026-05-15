import { redirect } from "next/navigation";

export const metadata = {
  title: "Games",
  description: "Game-like sprint and matching modes in EdSync Practice.",
};

export default function GamesPage() {
  redirect("/practice?mode=sprint");
}
