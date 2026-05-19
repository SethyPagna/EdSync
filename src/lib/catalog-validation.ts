export const CATALOG_PRODUCT_ID_MAX_LENGTH = 160;

const CATALOG_PRODUCT_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

export function validateCatalogProductId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Catalog item is required.");
  if (id.length > CATALOG_PRODUCT_ID_MAX_LENGTH || !CATALOG_PRODUCT_ID_PATTERN.test(id)) {
    throw new Error("Catalog item id must be a short identifier.");
  }
  return id;
}
