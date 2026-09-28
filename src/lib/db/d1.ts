import { assertTableName, deserializeRow, serializeRow, type TableName } from "./schema";
import { getD1QueryAdapter, type D1Statement } from "./d1-adapter";

export async function d1Batch(statements: D1Statement[]) {
  await getD1QueryAdapter().batch(statements);
}

export type DataFilter =
  | { op: "eq" | "neq" | "gte" | "lte"; column: string; value: unknown }
  | { op: "is" | "is_not"; column: string; value: boolean | null }
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
  error: { message: string; status?: number } | null;
  count?: number | null;
};

/** A server-built SQL predicate over the target table's own columns. */
export type SqlScope = { sql: string; params: unknown[] };

export class DataRequestError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 409 = 400) {
    super(message);
    this.name = "DataRequestError";
  }
}

export const MAX_SELECT_LIMIT = 1000;

const UNIQUE_CONFLICT_TARGETS: Partial<Record<TableName, readonly string[]>> = {
  class_enrollments: ["class_id,student_id"],
  student_progress: ["student_id,lesson_id"],
  knowledge_nodes: ["student_id,concept"],
};

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER.test(identifier)) {
    throw new DataRequestError(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function selectedColumns(columns?: string) {
  if (!columns || columns.trim() === "" || columns.trim() === "*") return "*";
  const selected = columns
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !part.includes("("))
    .map(quoteIdentifier);
  return selected.length ? selected.join(", ") : "*";
}

// D1 allows at most 100 bound parameters per statement, so a list is bound once as a JSON array.
const JSON_LIST = "(SELECT value FROM json_each(?))";

function filterClause(filter: DataFilter, params: unknown[]) {
  const column = quoteIdentifier(filter.column);
  switch (filter.op) {
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (values.length === 0) return "1 = 0";
      params.push(JSON.stringify(values));
      return `${column} IN ${JSON_LIST}`;
    }
    case "is":
    case "is_not": {
      const operator = filter.op === "is" ? "IS" : "IS NOT";
      if (filter.value === null) return `${column} ${operator} NULL`;
      if (typeof filter.value !== "boolean") {
        throw new DataRequestError("is() filters accept null, true or false.");
      }
      params.push(filter.value ? 1 : 0);
      return `${column} ${operator} ?`;
    }
    case "eq":
    case "neq":
    case "gte":
    case "lte": {
      params.push(filter.value);
      const operator = { eq: "=", neq: "!=", gte: ">=", lte: "<=" }[filter.op];
      return `${column} ${operator} ?`;
    }
    default:
      throw new DataRequestError("Unsupported filter operator.");
  }
}

function buildWhere(filters: DataFilter[] = [], params: unknown[], scope?: SqlScope | null) {
  const clauses = filters.map((filter) => filterClause(filter, params));
  if (scope) {
    clauses.push(`(${scope.sql})`);
    params.push(...scope.params);
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function buildOrder(order: DataOrder[] = []) {
  if (order.length === 0) return "";
  return ` ORDER BY ${order
    .map((item) => `${quoteIdentifier(item.column)} ${item.ascending === false ? "DESC" : "ASC"}`)
    .join(", ")}`;
}

function buildLimit(limit?: number) {
  if (!limit) return "";
  const value = Math.floor(Number(limit));
  if (!Number.isFinite(value) || value < 1) throw new DataRequestError("Limit must be a positive number.");
  return ` LIMIT ${Math.min(value, MAX_SELECT_LIMIT)}`;
}

function requireFilters(request: DataRequest) {
  if (!request.filters?.length) {
    throw new DataRequestError(`Refusing to ${request.action} rows without a filter.`);
  }
}

function conflictColumnsFor(request: DataRequest) {
  const target = (request.onConflict ?? "id")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  target.forEach(quoteIdentifier);
  const normalized = target.join(",");
  if (normalized !== "id" && !UNIQUE_CONFLICT_TARGETS[request.table]?.includes(normalized)) {
    throw new DataRequestError(`Unsupported conflict target for ${request.table}: ${normalized || "(empty)"}.`);
  }
  return target;
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
      const lessons = await d1Query(`SELECT id, title FROM lessons WHERE id IN ${JSON_LIST}`, [JSON.stringify(ids)]);
      const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
      return rows.map((row) => ({ ...row, lessons: byId.get(row.lesson_id) ?? null }));
    }
  }

  if (table === "lesson_assignments" && columns.includes("classes(name)")) {
    const ids = Array.from(new Set(rows.map((row) => row.class_id).filter(Boolean)));
    if (ids.length > 0) {
      const classes = await d1Query(`SELECT id, name FROM classes WHERE id IN ${JSON_LIST}`, [JSON.stringify(ids)]);
      const byId = new Map(classes.map((klass) => [klass.id, klass]));
      return rows.map((row) => ({ ...row, classes: byId.get(row.class_id) ?? null }));
    }
  }

  return rows;
}

function errorResult(error: unknown): D1Result<never> {
  if (error instanceof DataRequestError) {
    return { data: null, error: { message: error.message, status: error.status } };
  }
  const message = error instanceof Error ? error.message : "";
  if (/constraint failed/i.test(message)) {
    return { data: null, error: { message, status: 409 } };
  }
  console.error("EdSync data request failed", error);
  return { data: null, error: { message: "The data request could not be completed.", status: 500 } };
}

/**
 * Runs a validated data request. `scope` is ANDed into every read, update and delete,
 * and guards the DO UPDATE branch of upserts so existing rows outside it are never touched.
 */
export async function executeDataRequest(
  request: DataRequest,
  options: { scope?: SqlScope | null } = {},
): Promise<D1Result> {
  const scope = options.scope ?? null;
  try {
    if (request.action === "rpc") {
      throw new DataRequestError(`Unsupported RPC: ${request.rpc?.name ?? "unknown"}`);
    }

    assertTableName(request.table);
    const table = quoteIdentifier(request.table);
    const params: unknown[] = [];

    if (request.action === "select") {
      const where = buildWhere(request.filters, params, scope);
      const countRows =
        request.count === "exact"
          ? await d1Query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}${where}`, params)
          : undefined;
      const count = countRows?.[0]?.count ?? null;

      if (request.head) {
        return { data: null, error: null, count };
      }

      const sql =
        `SELECT ${selectedColumns(request.columns)} FROM ${table}` +
        where +
        buildOrder(request.order) +
        buildLimit(request.limit);
      const rows = await d1Query(sql, params);
      const embedded = await embedRelations(request.table, request.columns, rows);
      const data = embedded.map((row) => deserializeRow(request.table, row));

      if (request.single || request.maybeSingle) {
        return { data: data[0] ?? null, error: null, count };
      }

      return { data, error: null, count };
    }

    if (request.action === "delete") {
      requireFilters(request);
      const where = buildWhere(request.filters, params, scope);
      await d1Query(`DELETE FROM ${table}${where}`, params);
      return { data: null, error: null };
    }

    if (request.action === "update") {
      requireFilters(request);
      if (!request.values || Array.isArray(request.values)) {
        throw new DataRequestError("Updates take a single object of values.");
      }
      const row = serializeRow(request.table, request.values);
      const keys = Object.keys(row);
      if (keys.length === 0) throw new DataRequestError("Nothing to update.");
      const where = buildWhere(request.filters, params, scope);
      const updated = await d1Query(
        `UPDATE ${table} SET ${keys.map((key) => `${quoteIdentifier(key)} = ?`).join(", ")}${where} RETURNING *`,
        [...Object.values(row), ...params],
      );
      const data = updated.map((updatedRow) => deserializeRow(request.table, updatedRow));
      return { data: request.single || request.maybeSingle ? data[0] ?? null : data, error: null };
    }

    if (request.action === "insert" || request.action === "upsert") {
      const rows = Array.isArray(request.values) ? request.values : request.values ? [request.values] : [];
      if (rows.length === 0) throw new DataRequestError("Nothing to insert.");
      const conflictColumns = request.action === "upsert" ? conflictColumnsFor(request) : [];
      const inserted: Record<string, unknown>[] = [];

      for (const rawRow of rows) {
        const row = serializeRow(request.table, rawRow);
        if (!row.id) row.id = crypto.randomUUID();
        const keys = Object.keys(row);
        const values = Object.values(row);
        let sql = `INSERT INTO ${table} (${keys.map(quoteIdentifier).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
        const statementParams = [...values];
        const updateSet = keys
          .filter((key) => key !== "id" && !conflictColumns.includes(key))
          .map((key) => `${quoteIdentifier(key)} = excluded.${quoteIdentifier(key)}`)
          .join(", ");

        if (request.action === "upsert") {
          sql += ` ON CONFLICT(${conflictColumns.map(quoteIdentifier).join(", ")}) `;
          if (updateSet) {
            sql += `DO UPDATE SET ${updateSet}${scope ? ` WHERE (${scope.sql})` : ""}`;
            if (scope) statementParams.push(...scope.params);
          } else {
            sql += "DO NOTHING";
          }
        }

        let persisted = await d1Query(`${sql} RETURNING *`, statementParams);
        if (!persisted.length && request.action === "upsert") {
          // RETURNING is empty only when the conflicting row failed the scope guard (or DO NOTHING ran).
          if (updateSet && scope) throw new DataRequestError("That record belongs to someone else.", 403);
          if (!updateSet) {
            const existingParams = conflictColumns.map((column) => row[column]);
            persisted = await d1Query(
              `SELECT * FROM ${table} WHERE ${conflictColumns.map((column) => `${quoteIdentifier(column)} IS ?`).join(" AND ")}` +
                `${scope ? ` AND (${scope.sql})` : ""} LIMIT 1`,
              scope ? [...existingParams, ...scope.params] : existingParams,
            );
            if (!persisted.length && scope) throw new DataRequestError("That record belongs to someone else.", 403);
          }
        }
        inserted.push(deserializeRow(request.table, persisted[0] ?? row));
      }

      const data = request.single || request.maybeSingle ? inserted[0] : inserted;
      return { data, error: null };
    }

    throw new DataRequestError(`Unsupported data action: ${request.action}`);
  } catch (error) {
    return errorResult(error);
  }
}
