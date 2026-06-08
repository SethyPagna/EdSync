import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login");
  return children;
}
