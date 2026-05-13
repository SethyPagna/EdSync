import { redirect } from "next/navigation";
import LandingPage from "./landing";
import { getSessionUser } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getSessionUser().catch(() => null);

  if (user) {
    redirect(
      user.user_metadata.role === "teacher"
        ? "/teacher/dashboard"
        : "/student/dashboard",
    );
  }

  return <LandingPage />;
}
