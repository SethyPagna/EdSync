import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "./session";
import type { Profile } from "@/types";

export async function getAuthenticatedUser() {
  const user = await getSessionUser();
  return { user };
}

export async function getAuthenticatedProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const rows = await d1Query<Profile>("SELECT * FROM profiles WHERE id = ? LIMIT 1", [
    user.id,
  ]);

  return rows[0] ?? null;
}
