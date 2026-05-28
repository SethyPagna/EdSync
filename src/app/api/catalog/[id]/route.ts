import { NextResponse } from "next/server";
import { getPublicCatalogItem } from "@/lib/catalog";
import { validateCatalogProductId } from "@/lib/validation/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let id: string;
  try {
    const routeParams = await params;
    id = validateCatalogProductId(routeParams.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog item id is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  const item = await getPublicCatalogItem(id);
  if (!item) {
    return NextResponse.json({ data: null, error: "Catalog item not found." }, { status: 404 });
  }
  return NextResponse.json({ data: { item }, error: null });
}
