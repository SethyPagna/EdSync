import { NextResponse } from "next/server";
import { getPublicCatalogItem } from "@/lib/catalog";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const item = await getPublicCatalogItem(params.id);
  if (!item) {
    return NextResponse.json({ data: null, error: "Catalog item not found." }, { status: 404 });
  }
  return NextResponse.json({ data: { item }, error: null });
}

