import { NextResponse } from "next/server";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = params.get("q");
    const portalSlug = params.get("portal");
    const tenantSlug = params.get("tenant");
    const featuredOnly = params.get("featured") === "true";

    const [items, portals] = await Promise.all([
      listPublicCatalog({ query, portalSlug, tenantSlug, featuredOnly }),
      listPublicPortals(),
    ]);

    return NextResponse.json({
      data: { items, portals },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog unavailable.";
    return NextResponse.json({ data: { items: [], portals: [] }, error: message }, { status: 500 });
  }
}
