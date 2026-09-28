import { NextResponse } from "next/server";

export class HttpError extends Error {
  readonly status: number;
  readonly headers?: Record<string, string>;

  constructor(status: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.headers = headers;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Invalid request.") {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden.") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict.") {
    super(409, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = "Too many requests. Try again shortly.", retryAfterSeconds = 60) {
    super(429, message, { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) });
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function errorJson(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ data: null, error: message }, { status, headers });
}

export function routeErrorResponse(error: unknown) {
  if (isHttpError(error)) return errorJson(error.message, error.status, error.headers);
  if (error instanceof SyntaxError) return errorJson("Invalid JSON body.", 400);
  console.error("Unhandled route error", error);
  return errorJson("Something went wrong.", 500);
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("Request body must be a JSON object.");
  }
  return value as T;
}

export function withRoute<Context = unknown>(
  handler: (request: Request, context: Context) => Promise<Response> | Response,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return routeErrorResponse(error);
    }
  };
}
