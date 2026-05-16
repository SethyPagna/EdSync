export function sqlPlaceholders(count: number) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("SQL placeholder count must be a positive integer.");
  }

  return Array.from({ length: count }, () => "?").join(", ");
}

export function sqlInPlaceholders(values: readonly unknown[]) {
  return sqlPlaceholders(values.length);
}
