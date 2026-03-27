import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || "";
}

/**
 * Generate a stateless HMAC-SHA256 token for ticket notification unsubscribe links.
 */
export function generateTicketUnsubscribeToken(
  userId: string,
  ticketId: string
): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET is not configured");
  }
  const hmac = createHmac("sha256", secret);
  hmac.update(`ticket:${userId}:${ticketId}`);
  return hmac.digest("hex");
}

/**
 * Verify a ticket unsubscribe token using timing-safe comparison.
 */
export function verifyTicketUnsubscribeToken(
  userId: string,
  ticketId: string,
  token: string
): boolean {
  if (!getSecret()) return false;

  try {
    const expected = generateTicketUnsubscribeToken(userId, ticketId);
    const a = Buffer.from(token, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Build the full unsubscribe URL for a ticket notification.
 */
export function buildTicketUnsubscribeUrl(
  userId: string,
  ticketId: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = generateTicketUnsubscribeToken(userId, ticketId);
  return `${appUrl}/api/support-tickets/unsubscribe?user=${userId}&ticket=${ticketId}&token=${token}`;
}

/**
 * Sentinel ticketId used in HMAC tokens for global (subscribe-all) unsubscribe links.
 */
export const GLOBAL_UNSUBSCRIBE_TICKET_ID = "__global__";

/**
 * Build the full unsubscribe URL for global new-ticket notifications.
 * Clicking this sets subscribeToAllTickets = false for the user.
 */
export function buildGlobalUnsubscribeUrl(userId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = generateTicketUnsubscribeToken(userId, GLOBAL_UNSUBSCRIBE_TICKET_ID);
  return `${appUrl}/api/support-tickets/unsubscribe?user=${userId}&ticket=${GLOBAL_UNSUBSCRIBE_TICKET_ID}&token=${token}`;
}
