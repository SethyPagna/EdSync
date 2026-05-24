import { assertTableName, deserializeRow, serializeRow, type TableName } from "./schema";
import { sqlInPlaceholders } from "./sql";
import { getD1QueryAdapter } from "./d1-adapter";

export type DataFilter =
  | { op: "eq" | "neq" | "gte" | "lte"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] };

export type DataOrder = {
  column: string;
  ascending?: boolean;
};

export type DataRequest = {
  table: TableName;
  action: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  columns?: string;
  filters?: DataFilter[];
  order?: DataOrder[];
  limit?: number;
  single?: boolean;
  maybeSingle?: boolean;
  head?: boolean;
  count?: "exact";
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  rpc?: { name: string; args: Record<string, unknown> };
};

export type D1Result<T = Record<string, unknown> | Record<string, unknown>[]> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function selectedColumns(columns?: string) {
  if (!columns || columns.trim() === "" || columns.trim() === "*") return "*";
  return columns
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !part.includes("("))
    .map(quoteIdentifier)
    .join(", ");
}

function buildWhere(filters: DataFilter[] = [], params: unknown[]) {
  if (filters.length === 0) return "";

  const clauses = filters.map((filter) => {
    const column = quoteIdentifier(filter.column);
    if (filter.op === "in") {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (values.length === 0) return "1 = 0";
      params.push(...values);
      return `${column} IN (${values.map(() => "?").join(", ")})`;
    }

    params.push(filter.value);
    const op = filter.op === "eq" ? "=" : filter.op === "neq" ? "!=" : filter.op === "gte" ? ">=" : "<=";
    return `${column} ${op} ?`;
  });

  return ` WHERE ${clauses.join(" AND ")}`;
}

function buildOrder(order: DataOrder[] = []) {
  if (order.length === 0) return "";
  return ` ORDER BY ${order
    .map((item) => `${quoteIdentifier(item.column)} ${item.ascending === false ? "DESC" : "ASC"}`)
    .join(", ")}`;
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return getD1QueryAdapter().query<T>(sql, params);
}

async function embedRelations(table: TableName, columns: string | undefined, rows: Record<string, unknown>[]) {
  if (!columns || rows.length === 0) return rows;

  if (table === "lesson_assignments" && columns.includes("lessons(title)")) {
    const ids = Array.from(new Set(rows.map((row) => row.lesson_id).filter(Boolean)));
    if (ids.length > 0) {
      const lessons = await d1Query(
        `SELECT id, title FROM lessons WHERE id IN (${sqlInPlaceholders(ids)})`,
        ids,
      );
      const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
      return rows.map((row) => ({ ...row, lessons: byId.get(row.lesson_id) ?? null }));
    }
  }

  if (table === "lesson_assignments" && columns.includes("classes(name)")) {
    const ids = Array.from(new Set(rows.map((row) => row.class_id).filter(Boolean)));
    if (ids.length > 0) {
      const classes = await d1Query(
        `SELECT id, name FROM classes WHERE id IN (${sqlInPlaceholders(ids)})`,
        ids,
      );
      const byId = new Map(classes.map((klass) => [klass.id, klass]));
      return rows.map((row) => ({ ...row, classes: byId.get(row.class_id) ?? null }));
    }
  }

  return rows;
}

export async function executeDataRequest(request: DataRequest): Promise<D1Result> {
  try {
    if (request.action === "rpc") {
      throw new Error(`Unsupported RPC: ${request.rpc?.name}`);
    }

    assertTableName(request.table);
    const table = quoteIdentifier(request.table);
    const params: unknown[] = [];

    if (request.action === "select") {
      const where = buildWhere(request.filters, params);
      const countRows =
        request.count === "exact"
          ? await d1Query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}${where}`, params)
          : undefined;

      if (request.head) {
        return { data: null, error: null, count: countRows?.[0]?.count ?? null };
      }

      const sql =
        `SELECT ${selectedColumns(request.columns)} FROM ${table}` +
        where +
        buildOrder(request.order) +
        (request.limit ? ` LIMIT ${Number(request.limit)}` : "");
      const rows = await d1Query(sql, params);
      const embedded = await embedRelations(request.table, request.columns, rows);
      const data = embedded.map((row) => deserializeRow(request.table, row));

      if (request.single || request.maybeSingle) {
        return { data: data[0] ?? null, error: null, count: countRows?.[0]?.count ?? null };
      }

      return { data, error: null, count: countRows?.[0]?.count ?? null };
    }

    if (request.action === "delete") {
      const where = buildWhere(request.filters, params);
      await d1Query(`DELETE FROM ${table}${where}`, params);
      return { data: null, error: null };
    }

    const rows = Array.isArray(request.values) ? request.values : request.values ? [request.values] : [];
    if (rows.length === 0) return { data: null, error: null };

    if (request.action === "insert" || request.action === "upsert") {
      const inserted: Record<string, unknown>[] = [];
      for (const rawRow of rows) {
        const row = serializeRow(request.table, rawRow);
        if (!row.id) row.id = crypto.randomUUID();
        const keys = Object.keys(row);
        const values = Object.values(row);
        const conflictColumn = request.onConflict || "id";
        const updateSet = keys
          .filter((key) => key !== conflictColumn)
          .map((key) => `${quoteIdentifier(key)} = excluded.${quoteIdentifier(key)}`)
          .join(", ");
        const sql =
          `INSERT INTO ${table} (${keys.map(quoteIdentifier).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})` +
          (request.action === "upsert"
            ? ` ON CONFLICT(${quoteIdentifier(conflictColumn)}) DO UPDATE SET ${updateSet}`
            : "");
        await d1Query(sql, values);
        inserted.push(deserializeRow(request.table, row));
      }

      const data = request.single || request.maybeSingle ? inserted[0] : inserted;
      return { data, error: null };
    }

    if (request.action === "update") {
      const rawRow = rows[0];
      const row = serializeRow(request.table, rawRow);
      const keys = Object.keys(row);
      const values = Object.values(row);
      const whereParams: unknown[] = [];
      const where = buildWhere(request.filters, whereParams);
      await d1Query(
        `UPDATE ${table} SET ${keys.map((key) => `${quoteIdentifier(key)} = ?`).join(", ")}${where}`,
        [...values, ...whereParams],
      );
      return { data: null, error: null };
    }

    throw new Error(`Unsupported data action: ${request.action}`);
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "Unknown D1 error" },
    };
  }
}
