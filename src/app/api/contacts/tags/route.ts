import { NextRequest, NextResponse } from "next/server";
import { getTagsForContacts } from "@/lib/tags";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({});
  }

  const contactIds = ids.split(",").filter(Boolean);
  const tagsMap = await getTagsForContacts(contactIds);
  return NextResponse.json(tagsMap);
}
