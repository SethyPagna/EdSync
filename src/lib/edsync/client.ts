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

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const fallback = (message: string, forceError = false) => {
    const error = !response.ok || forceError ? { message, status: response.status } : null;
    if (url.startsWith("/api/auth/")) {
      return { data: { user: null, session: null }, error } as T;
    }
    return { data: null, error } as T;
  };
  const text = await response.text();
  if (!text) {
    return fallback("Request is unavailable. Try again shortly.", url.startsWith("/api/auth/"));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback("Request returned an invalid response.", true);
  }
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

// The query builder keeps legacy table callers working while new code moves toward typed D1 helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class EdSyncQueryBuilder<T = any> implements PromiseLike<D1Result<T>> {
  private request: DataRequest;

  constructor(table: string) {
    this.request = {
      table: table as DataRequest["table"],
      action: "select",
      filters: [],
      order: [],
    };
  }

  select(columns = "*", options: QueryOptions = {}) {
    this.request.action = this.request.action === "insert" || this.request.action === "upsert"
      ? this.request.action
      : "select";
    this.request.columns = columns;
    this.request.count = options.count;
    this.request.head = options.head;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.request.action = "insert";
    this.request.values = values;
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string } = {},
  ) {
    this.request.action = "upsert";
    this.request.values = values;
    this.request.onConflict = options.onConflict;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.request.action = "update";
    this.request.values = values;
    return this;
  }

  delete() {
    this.request.action = "delete";
    return this;
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
    if (operator === "is" && value === null) {
      return this.filter({ op: "neq", column, value: null });
    }
    return this.filter({ op: "neq", column, value });
  }

  is(column: string, value: unknown) {
    return this.filter({ op: "eq", column, value });
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

  private filter(filter: DataFilter) {
    this.request.filters = [...(this.request.filters ?? []), filter];
    return this;
  }

  private async execute(): Promise<D1Result<T>> {
    return postJson<D1Result<T>>("/api/data", this.request);
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
            const response = await fetch("/api/storage/upload", {
              method: "POST",
              credentials: "include",
              body: form,
            });
            return (await response.json()) as D1Result<{ path: string; publicUrl: string }>;
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
