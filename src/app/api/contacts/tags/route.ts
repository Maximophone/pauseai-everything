import { NextRequest, NextResponse } from "next/server";
import { getTagsForContacts } from "@/lib/tags";
import { checkAuth, requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({});
  }

  const contactIds = ids.split(",").filter(Boolean);
  const tagsMap = await getTagsForContacts(contactIds);
  return NextResponse.json(tagsMap);
}
