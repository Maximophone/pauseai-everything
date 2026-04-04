import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { processEmailEvent, EVENT_TO_STATUS } from "@/lib/email-events";

/**
 * Verify Mailersend webhook signature.
 * Mailersend signs webhooks with HMAC-SHA256 using the webhook signing secret.
 * The signature is sent in the `signature` field of the JSON body.
 *
 * @see https://developers.mailersend.com/general/webhooks.html#webhook-signature
 */
function verifyMailersendSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.MAILERSEND_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("MAILERSEND_WEBHOOK_SIGNING_SECRET is not configured — rejecting webhook");
    return false;
  }
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Mailersend webhook endpoint.
 * Receives delivery events and updates the email status in our database,
 * then recalculates campaign aggregate counts.
 *
 * Events: sent, delivered, soft_bounced, hard_bounced, opened, clicked, unsubscribed, spam_complaint
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify webhook signature
  const signature = request.headers.get("signature");
  if (!verifyMailersendSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Mailersend sends events as { type, data: { ... } } or as an array
  const events = Array.isArray(body) ? body : [body];

  for (const event of events) {
    const type = event.type;
    const messageId = event.data?.message_id || event.data?.email?.message_id;

    if (!messageId || !EVENT_TO_STATUS[type]) continue;

    await processEmailEvent(messageId, type);
  }

  return NextResponse.json({ ok: true });
}
