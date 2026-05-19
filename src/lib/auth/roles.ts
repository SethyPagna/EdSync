import type { UserRole } from "@/types";

export type SignupRole = Extract<UserRole, "teacher" | "student">;

export function normalizeUserRole(role: unknown): UserRole | null {
  if (role === "admin" || role === "teacher" || role === "student") return role;
  return null;
}

export function normalizeSignupRole(role: unknown): SignupRole | null {
  if (role === "teacher" || role === "student") return role;
  return null;
}
