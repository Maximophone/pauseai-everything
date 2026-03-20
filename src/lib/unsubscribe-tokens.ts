import { createHmac, timingSafeEqual } from "crypto";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "";

/**
 * Generate a stateless HMAC-SHA256 token for unsubscribe links.
 * Token is derived from contactId + categoryName, so it never expires.
 */
export function generateUnsubscribeToken(
  contactId: string,
  categoryName: string
): string {
  if (!UNSUBSCRIBE_SECRET) {
    throw new Error("UNSUBSCRIBE_SECRET is not configured");
  }
  const hmac = createHmac("sha256", UNSUBSCRIBE_SECRET);
  hmac.update(`${contactId}:${categoryName}`);
  return hmac.digest("hex");
}

/**
 * Verify an unsubscribe token using timing-safe comparison.
 */
export function verifyUnsubscribeToken(
  contactId: string,
  categoryName: string,
  token: string
): boolean {
  if (!UNSUBSCRIBE_SECRET) return false;

  try {
    const expected = generateUnsubscribeToken(contactId, categoryName);
    const a = Buffer.from(token, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Build the full unsubscribe URL for a contact + category.
 */
export function buildUnsubscribeUrl(
  contactId: string,
  categoryName: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = generateUnsubscribeToken(contactId, categoryName);
  return `${appUrl}/unsubscribe?contact=${contactId}&category=${encodeURIComponent(categoryName)}&token=${token}`;
}
