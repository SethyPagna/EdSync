import type { UserRole } from "@/types";

export type AccountType = "individual" | "organization";
export type OrganizationMode = "join" | "create";
export type SignupRole = Extract<UserRole, "teacher" | "student">;

export function normalizeAccountType(value: unknown): AccountType | null {
  if (value === "individual" || value === "organization") return value;
  return null;
}

export function normalizeOrganizationMode(value: unknown): OrganizationMode | null {
  if (value === "join" || value === "create") return value;
  return null;
}

export function normalizeUserRole(role: unknown): UserRole | null {
  if (role === "admin" || role === "teacher" || role === "student") return role;
  return null;
}

export function normalizeSignupRole(role: unknown): SignupRole | null {
  if (role === "teacher" || role === "student") return role;
  return null;
}
