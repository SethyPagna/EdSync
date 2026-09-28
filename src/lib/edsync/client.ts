"use client";

import type { DataFilter, DataOrder, DataRequest, D1Result } from "@/lib/db/d1";
import { validateDisplayName } from "@/lib/auth/display-name";
import { validateOrganizationCode } from "@/lib/auth/organization-code";
import { validateLoginPassword, validateSignupPassword } from "@/lib/auth/password-validation";
import {
  normalizeAccountType,
  normalizeOrganizationMode,
  normalizeSignupRole,
  type AccountType,
  type OrganizationMode,
  type SignupRole,
} from "@/lib/auth/roles";
import { validateEmailAddress } from "@/lib/validation/email-address";
import { validateTenantName } from "@/lib/validation/tenant";

type QueryOptions = {
  count?: "exact";
  head?: boolean;
};

type AuthResponse = {
  data: {
    user: {
      id: string;
      email: string;
      user_metadata: {
        role: "admin" | "teacher" | "student";
        full_name?: string | null;
        tenant_slug?: string | null;
        tenant_name?: string | null;
      };
    } | null;
    session?: { expires_at?: string } | null;
  };
  error: { message: string; status?: number } | null;
};

function authValidationError(message: string): AuthResponse {
  return {
    data: { user: null, session: null },
    error: { message, status: 400 },
  };
}

type DataError = { message: string; status?: number };

const NETWORK_ERROR = "Network error. Check your connection and try again.";

function normalizeError(error: unknown, status: number): DataError | null {
  if (error === null || error === undefined) return null;
  if (typeof error === "string") return { message: error, status };
  if (typeof error === "object" && typeof (error as DataError).message === "string") {
    const shaped = error as DataError;
    return { ...shaped, status: shaped.status ?? status };
  }
  return { message: "Request failed.", status };
}

/** Resolves every outcome, including network failures, to a `{ data, error }` shape. */
async function sendJson<T>(url: string, init: RequestInit, auth: boolean): Promise<T> {
  const failure = (message: string, status: number) =>
    (auth
      ? { data: { user: null, session: null }, error: { message, status } }
      : { data: null, error: { message, status } }) as T;
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, { credentials: "include", ...init });
    text = await response.text();
  } catch {
    return failure(NETWORK_ERROR, 0);
  }
  if (!text) {
    return !response.ok || auth
      ? failure("Request is unavailable. Try again shortly.", response.status)
      : ({ data: null, error: null } as T);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failure("Request returned an invalid response.", response.status);
  }
  if (typeof body !== "object" || body === null) {
    return failure("Request returned an invalid response.", response.status);
  }
  const record = body as { error?: unknown };
  const error =
    normalizeError(record.error, response.status) ??
    (response.ok ? null : { message: "Request failed.", status: response.status });
  return { ...record, error } as T;
}

function postJson<T>(url: string, body?: unknown): Promise<T> {
  return sendJson<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
    url.startsWith("/api/auth/"),
  );
}

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  const fallback: AuthResponse = {
    data: { user: null, session: null },
    error: response.ok ? null : { message: "Session is unavailable. Try again shortly.", status: response.status },
  };
  const text = await response.text();
  if (!text) return fallback;
  try {
    return JSON.parse(text) as AuthResponse;
  } catch {
    return fallback;
  }
}

const joinCodesByClass = new Map<string, string>();

function joinCodeFilter(request: DataRequest) {
  const filter = request.filters?.find((item) => item.op === "eq" && item.column === "join_code");
  return typeof filter?.value === "string" && filter.value.trim() ? filter.value.trim().toUpperCase() : null;
}

// Enrolling needs proof of the class join code; remember codes the user looked up so join flows send it.
function withJoinCodes(request: DataRequest): DataRequest {
  if (request.table !== "class_enrollments" || (request.action !== "insert" && request.action !== "upsert")) return request;
  const attach = (row: Record<string, unknown>) => {
    const joinCode = typeof row.class_id === "string" ? joinCodesByClass.get(row.class_id) : undefined;
    return joinCode && row.join_code === undefined ? { ...row, join_code: joinCode } : row;
  };
  const values = Array.isArray(request.values) ? request.values.map(attach) : request.values && attach(request.values);
  return { ...request, values };
}

function rememberJoinCodes(request: DataRequest, result: D1Result<unknown>) {
  const joinCode = request.table === "classes" && request.action === "select" ? joinCodeFilter(request) : null;
  if (!joinCode || !result.data) return;
  for (const row of Array.isArray(result.data) ? result.data : [result.data]) {
    const id = (row as { id?: unknown } | null)?.id;
    if (typeof id === "string") joinCodesByClass.set(id, joinCode);
  }
}

// The query builder keeps legacy table callers working while new code moves toward typed D1 helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class EdSyncQueryBuilder<T = any> implements PromiseLike<D1Result<T>> {
  private request: DataRequest;
  private invalid: string | null = null;
  private executed = false;
  private watched = false;

  constructor(table: string) {
    this.request = {
      table: table as DataRequest["table"],
      action: "select",
      filters: [],
      order: [],
    };
  }

  /** Picks columns for a query, or asks a mutation to return the rows it wrote. */
  select(columns = "*", options: QueryOptions = {}) {
    this.request.columns = columns;
    this.request.count = options.count;
    this.request.head = options.head;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    return this.mutate("insert", values);
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string } = {},
  ) {
    this.request.onConflict = options.onConflict;
    return this.mutate("upsert", values);
  }

  /** Resolves with the rows that were changed. */
  update(values: Record<string, unknown>) {
    return this.mutate("update", values);
  }

  delete() {
    return this.mutate("delete");
  }

  eq(column: string, value: unknown) {
    return this.filter({ op: "eq", column, value });
  }

  neq(column: string, value: unknown) {
    return this.filter({ op: "neq", column, value });
  }

  gte(column: string, value: unknown) {
    return this.filter({ op: "gte", column, value });
  }

  lte(column: string, value: unknown) {
    return this.filter({ op: "lte", column, value });
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is") return this.nullFilter("is_not", column, value);
    if (operator === "eq") return this.filter({ op: "neq", column, value });
    if (operator === "neq") return this.filter({ op: "eq", column, value });
    return this.fail(`not("${operator}") filters are not supported.`);
  }

  is(column: string, value: unknown) {
    return this.nullFilter("is", column, value);
  }

  in(column: string, value: unknown[]) {
    return this.filter({ op: "in", column, value });
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.request.order = [...(this.request.order ?? []), { column, ascending: options.ascending } satisfies DataOrder];
    return this;
  }

  limit(limit: number) {
    this.request.limit = limit;
    return this;
  }

  single() {
    this.request.single = true;
    return this.execute();
  }

  maybeSingle() {
    this.request.maybeSingle = true;
    return this.execute();
  }

  then<TResult1 = D1Result<T>, TResult2 = never>(
    onfulfilled?: ((value: D1Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private mutate(action: "insert" | "upsert" | "update" | "delete", values?: DataRequest["values"]) {
    this.request.action = action;
    if (values !== undefined) this.request.values = values;
    this.warnIfNeverAwaited();
    return this;
  }

  private warnIfNeverAwaited() {
    if (process.env.NODE_ENV === "production" || this.watched) return;
    this.watched = true;
    setTimeout(() => {
      if (!this.executed) {
        console.warn(`EdSync: ${this.request.action} on "${this.request.table}" was never awaited, so it did not run.`);
      }
    }, 0);
  }

  private filter(filter: DataFilter) {
    this.request.filters = [...(this.request.filters ?? []), filter];
    return this;
  }

  private nullFilter(op: "is" | "is_not", column: string, value: unknown) {
    if (value !== null && typeof value !== "boolean") return this.fail("is() filters accept null, true or false.");
    return this.filter({ op, column, value });
  }

  private fail(message: string) {
    this.invalid ??= message;
    return this;
  }

  private async execute(): Promise<D1Result<T>> {
    this.executed = true;
    if (this.invalid) return { data: null, error: { message: this.invalid, status: 400 } };
    const request = withJoinCodes(this.request);
    const result = await postJson<D1Result<T>>("/api/data", request);
    rememberJoinCodes(request, result);
    return result;
  }
}

export function createClient() {
  return {
    auth: {
      async getUser(): Promise<AuthResponse> {
        try {
          const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
          return readAuthResponse(response);
        } catch {
          return authValidationError("Session is unavailable. Try again shortly.");
        }
      },
      async signInWithPassword(input: {
        email: string;
        password: string;
        account_type: AccountType;
        organization_code?: string;
      }): Promise<AuthResponse> {
        if (!normalizeAccountType(input.account_type)) {
          return authValidationError("Choose individual or organization before signing in.");
        }
        const authInputError = validateClientAuthInput(input.email, () => validateLoginPassword(input.password));
        if (authInputError) return authInputError;
        const organizationCodeError = validateClientOrganizationCode(input.account_type, input.organization_code);
        if (organizationCodeError) return organizationCodeError;
        return postJson<AuthResponse>("/api/auth/login", input);
      },
      async signUp(input: {
        email: string;
        password: string;
        options: {
          data: {
            full_name?: string;
            role: SignupRole;
            account_type: AccountType;
            organization_mode?: OrganizationMode;
            organization_name?: string;
            organization_code?: string;
          };
          emailRedirectTo?: string;
        };
      }): Promise<AuthResponse> {
        const data = input.options.data;
        if (!normalizeSignupRole(data.role)) {
          return authValidationError("Choose teacher or student before creating an account.");
        }
        const accountType = normalizeAccountType(data.account_type);
        if (!accountType) {
          return authValidationError("Choose individual or organization before creating an account.");
        }
        if (accountType === "organization" && !normalizeOrganizationMode(data.organization_mode)) {
          return authValidationError("Choose whether to join or create an organization.");
        }
        const authInputError = validateClientAuthInput(input.email, () => validateSignupPassword(input.password));
        if (authInputError) return authInputError;
        const organizationCodeError = data.organization_mode === "join"
          ? validateClientOrganizationCode(accountType, data.organization_code)
          : null;
        if (organizationCodeError) return organizationCodeError;
        const organizationNameError = data.organization_mode === "create"
          ? validateClientOrganizationName(data.organization_name)
          : null;
        if (organizationNameError) return organizationNameError;
        try {
          validateDisplayName(data.full_name);
        } catch (error) {
          return authValidationError(error instanceof Error ? error.message : "Full name is invalid.");
        }
        return postJson<AuthResponse>("/api/auth/signup", input);
      },
      async signOut() {
        return postJson<{ error: null }>("/api/auth/logout");
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from<T = any>(table: string) {
      return new EdSyncQueryBuilder<T>(table);
    },
    rpc(name: string, args: Record<string, unknown>) {
      return postJson<D1Result>("/api/data", {
        action: "rpc",
        table: "profiles",
        rpc: { name, args },
      });
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File, options: { upsert?: boolean } = {}) {
            const form = new FormData();
            form.set("bucket", bucket);
            form.set("path", path);
            form.set("file", file);
            if (options.upsert !== undefined) form.set("upsert", String(options.upsert));
            return sendJson<D1Result<{ path: string; publicUrl: string }>>(
              "/api/storage/upload",
              { method: "POST", body: form },
              false,
            );
          },
          getPublicUrl(path: string) {
            const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "";
            return {
              data: {
                publicUrl: base ? `${base.replace(/\/$/, "")}/${path}` : path,
              },
            };
          },
        };
      },
    },
  };
}

function validateClientAuthInput(email: unknown, validatePassword: () => void): AuthResponse | null {
  try {
    validateEmailAddress(email);
    validatePassword();
    return null;
  } catch (error) {
    return authValidationError(error instanceof Error ? error.message : "Authentication details are invalid.");
  }
}

function validateClientOrganizationCode(accountType: AccountType, organizationCode: unknown): AuthResponse | null {
  if (accountType !== "organization") return null;
  try {
    validateOrganizationCode(typeof organizationCode === "string" ? organizationCode : null);
    return null;
  } catch (error) {
    return authValidationError(error instanceof Error ? error.message : "Organization code is invalid.");
  }
}

function validateClientOrganizationName(organizationName: unknown): AuthResponse | null {
  try {
    validateTenantName(organizationName);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message.replace("Tenant", "Organization") : "Organization name is invalid.";
    return authValidationError(message);
  }
}
