import { NextResponse } from "next/server";
import { getEmailMode } from "@/lib/mailersend";

export async function GET() {
  return NextResponse.json({ mode: getEmailMode() });
}
