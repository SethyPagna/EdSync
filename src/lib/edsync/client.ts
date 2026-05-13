"use client";

import type { DataFilter, DataOrder, DataRequest, D1Result } from "@/lib/db/d1";

type QueryOptions = {
  count?: "exact";
  head?: boolean;
};

type AuthResponse = {
  data: {
    user: {
      id: string;
      email: string;
      user_metadata: { role: "admin" | "teacher" | "student"; full_name?: string | null };
    } | null;
    session?: { expires_at?: string } | null;
  };
  error: { message: string; status?: number } | null;
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as T;
  return payload;
}

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
        return fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).then((response) =>
          response.json(),
        );
      },
      async signInWithPassword(input: { email: string; password: string }): Promise<AuthResponse> {
        return postJson<AuthResponse>("/api/auth/login", input);
      },
      async signUp(input: {
        email: string;
        password: string;
        options?: {
          data?: { full_name?: string; role?: "teacher" | "student" };
          emailRedirectTo?: string;
        };
      }): Promise<AuthResponse> {
        return postJson<AuthResponse>("/api/auth/signup", input);
      },
      async signOut() {
        return postJson<{ error: null }>("/api/auth/logout");
      },
    },
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
          async upload(path: string, file: File, _options: { upsert?: boolean } = {}) {
            const form = new FormData();
            form.set("bucket", bucket);
            form.set("path", path);
            form.set("file", file);
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
