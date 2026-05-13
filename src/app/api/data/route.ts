import { NextResponse } from "next/server";
import { executeDataRequest, type DataRequest } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({
      data: null,
      error: { message: "Authentication required." },
    });
  }

  const payload = (await request.json()) as DataRequest;
  const result = await executeDataRequest(payload);
  return NextResponse.json(result);
}
