import type { UserRole } from "@/types";

const SAFE_NEXT_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/catalog",
  "/org",
  "/studio",
  "/notes",
  "/docs",
  "/sheets",
  "/slides",
  "/ai",
  "/practice",
  "/quizzes",
  "/games",
];

export function homeForRole(role: string | null | undefined) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function isSafeAppPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  return SAFE_NEXT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`));
}

export function safeNextPath(value: string | null | undefined, role: UserRole | string | null | undefined) {
  return value && isSafeAppPath(value) ? value : homeForRole(role);
}
