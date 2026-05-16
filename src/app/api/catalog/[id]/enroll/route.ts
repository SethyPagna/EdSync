import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enrollCatalogItem, getPublicCatalogItem } from "@/lib/catalog";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser();
    const item = await getPublicCatalogItem(params.id);
    const url = new URL(request.url);
    const detailUrl = `/catalog/${params.id}`;

    if (!item) {
      return NextResponse.json({ data: null, error: "Catalog item not found." }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json(
        { data: { loginUrl: `/auth/login?next=${encodeURIComponent(detailUrl)}` }, error: "Authentication required." },
        { status: 401 },
      );
    }

    const result = await enrollCatalogItem({
      item,
      userId: user.id,
      successUrl: `${url.origin}${detailUrl}?enrolled=1`,
      cancelUrl: `${url.origin}${detailUrl}?checkout=cancelled`,
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("Catalog enrollment failed", error);
    return NextResponse.json(
      { data: null, error: "Enrollment could not be completed." },
      { status: 500 },
    );
  }
}
