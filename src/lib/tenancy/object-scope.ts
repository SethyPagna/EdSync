import { DEFAULT_TENANT_ID } from "@/lib/tenancy";

const IDENTIFIER = /^[a-z][a-z0-9_]*$/i;

type TenantObjectScopeInput = {
  tenantId: string;
};

type TenantObjectSqlInput = {
  objectTable: string;
  objectAlias: string;
  linkAlias: string;
};

function assertSqlIdentifier(value: string) {
  if (!IDENTIFIER.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return value;
}

export function tenantObjectJoin(input: TenantObjectSqlInput) {
  assertSqlIdentifier(input.objectTable);
  const objectAlias = assertSqlIdentifier(input.objectAlias);
  const linkAlias = assertSqlIdentifier(input.linkAlias);

  return `LEFT JOIN tenant_object_links ${linkAlias}
         ON ${linkAlias}.object_table = ?
        AND ${linkAlias}.object_id = ${objectAlias}.id`;
}

export function tenantObjectPredicate(input: Pick<TenantObjectSqlInput, "linkAlias">) {
  const linkAlias = assertSqlIdentifier(input.linkAlias);
  return `(${linkAlias}.tenant_id = ? OR (? = ? AND ${linkAlias}.id IS NULL))`;
}

export function tenantObjectParams(input: TenantObjectScopeInput & Pick<TenantObjectSqlInput, "objectTable">) {
  return [input.objectTable, input.tenantId, input.tenantId, DEFAULT_TENANT_ID];
}
