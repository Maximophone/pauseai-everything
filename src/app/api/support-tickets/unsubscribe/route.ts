import { NextRequest, NextResponse } from "next/server";
import { verifyTicketUnsubscribeToken } from "@/lib/ticket-unsubscribe-tokens";
import { unsubscribeFromTicket } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const userId = url.searchParams.get("user");
  const ticketId = url.searchParams.get("ticket");
  const token = url.searchParams.get("token");

  if (!userId || !ticketId || !token) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  const valid = verifyTicketUnsubscribeToken(userId, ticketId, token);
  if (!valid) {
    return new NextResponse("Invalid or expired unsubscribe link.", { status: 403 });
  }

  await unsubscribeFromTicket(ticketId, userId);

  return new NextResponse(
    `<html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center;">
      <h2>Unsubscribed</h2>
      <p>You will no longer receive notifications for this ticket.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
