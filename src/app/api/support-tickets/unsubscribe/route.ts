import { NextRequest, NextResponse } from "next/server";
import { verifyTicketUnsubscribeToken, GLOBAL_UNSUBSCRIBE_TICKET_ID } from "@/lib/ticket-unsubscribe-tokens";
import { unsubscribeFromTicket, setGlobalSubscription } from "@/lib/support-tickets";

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

  if (ticketId === GLOBAL_UNSUBSCRIBE_TICKET_ID) {
    await setGlobalSubscription(userId, false);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center;">
        <h2>Unsubscribed</h2>
        <p>You will no longer receive emails when new tickets are created.</p>
        <p style="font-size:14px;color:#888;">You can re-enable this in the Support section of the app.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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
