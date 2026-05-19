import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enrollCatalogItem, getPublicCatalogItem } from "@/lib/catalog";
import { validateCatalogProductId } from "@/lib/catalog-validation";
import { publicLanguageQuerySuffix } from "@/lib/public/languages";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = validateCatalogProductId(params.id);
    const user = await getSessionUser();
    const item = await getPublicCatalogItem(id);
    const url = new URL(request.url);
    const language = url.searchParams.get("language");
    const detailQuery = publicLanguageQuerySuffix(language);
    const detailUrl = `/catalog/${id}${detailQuery}`;
    const successUrl = new URL(detailUrl, url.origin);
    successUrl.searchParams.set("enrolled", "1");
    const cancelUrl = new URL(detailUrl, url.origin);
    cancelUrl.searchParams.set("checkout", "cancelled");

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
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Catalog item id")) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }
    console.error("Catalog enrollment failed", error);
    return NextResponse.json(
      { data: null, error: "Enrollment could not be completed." },
      { status: 500 },
    );
  }
}
