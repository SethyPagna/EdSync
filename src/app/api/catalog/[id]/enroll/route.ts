import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enrollCatalogItem, getPublicCatalogItem } from "@/lib/catalog";
import { publicLanguageQuerySuffix } from "@/lib/public/languages";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser();
    const item = await getPublicCatalogItem(params.id);
    const url = new URL(request.url);
    const language = url.searchParams.get("language");
    const detailQuery = publicLanguageQuerySuffix(language);
    const detailUrl = `/catalog/${params.id}${detailQuery}`;
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
    console.error("Catalog enrollment failed", error);
    return NextResponse.json(
      { data: null, error: "Enrollment could not be completed." },
      { status: 500 },
    );
  }
}
