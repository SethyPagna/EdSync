import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type D1RestResponse<T = Record<string, unknown>> = {
  success: boolean;
  errors?: { message: string }[];
  result?: Array<{
    success?: boolean;
    error?: string;
    results?: T[];
    meta?: { changes?: number };
  }>;
};

type EdSyncCloudflareEnv = CloudflareEnv & {
  EDSYNC_DB?: D1Database;
};

export type D1QueryAdapter = {
  readonly name: "binding" | "rest";
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  batch(statements: D1Statement[]): Promise<void>;
};

export type D1Statement = { sql: string; params?: unknown[] };

function normalizeD1Params(params: unknown[]) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value);
    }
    return value;
  });
}

function createBindingAdapter(database: D1Database): D1QueryAdapter {
  return {
    name: "binding",
    async query<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) {
      const statement = database
        .prepare(sql)
        .bind(...normalizeD1Params(params));
      const result = await statement.all<T>();
      if (!result.success) {
        throw new Error(result.error || "Cloudflare D1 binding query failed");
      }
      return result.results ?? [];
    },
    async batch(statements) {
      if (!statements.length) return;
      const results = await database.batch(
        statements.map(({ sql, params = [] }) =>
          database.prepare(sql).bind(...normalizeD1Params(params)),
        ),
      );
      const failed = results.find((result) => !result.success);
      if (failed) throw new Error(failed.error || "Cloudflare D1 batch failed");
    },
  };
}

function createRestAdapter(): D1QueryAdapter {
  async function request<T>(body: unknown) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !databaseId || !token) {
      throw new Error(
        "Missing Cloudflare D1 env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN",
      );
    }
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as D1RestResponse<T>;
    const failed = payload.result?.find((result) => result.success === false);
    if (!response.ok || !payload.success || failed) {
      throw new Error(
        failed?.error ||
          payload.errors?.map((error) => error.message).join("; ") ||
          response.statusText ||
          "Cloudflare D1 request failed",
      );
    }
    return payload.result ?? [];
  }
  return {
    name: "rest",
    async query<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) {
      const results = await request<T>({
        sql,
        params: normalizeD1Params(params),
      });
      return results[0]?.results ?? [];
    },
    async batch(statements) {
      if (!statements.length) return;
      await request({
        batch: statements.map(({ sql, params = [] }) => ({
          sql,
          params: normalizeD1Params(params),
        })),
      });
    },
  };
}

function getBindingDatabase() {
  try {
    const context = getCloudflareContext();
    return (context.env as EdSyncCloudflareEnv).EDSYNC_DB ?? null;
  } catch {
    return null;
  }
}

export function getD1QueryAdapter(): D1QueryAdapter {
  const bindingDatabase = getBindingDatabase();
  if (bindingDatabase) return createBindingAdapter(bindingDatabase);
  return createRestAdapter();
}
