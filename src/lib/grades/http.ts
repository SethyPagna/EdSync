import { NextResponse } from "next/server";

export function jsonError(error: string, status: 400 | 401 | 403 | 404 | 409 | 500) {
  return NextResponse.json({ data: null, error }, { status });
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Parses a JSON object body; returns null for malformed JSON or non-object payloads. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function optionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
