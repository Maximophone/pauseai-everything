import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || "";
}

/**
 * Generate a stateless HMAC-SHA256 token for workspace-aware unsubscribe links.
 * Token is derived from contactId + workspaceId + categoryName, so it never expires.
 */
export function generateUnsubscribeToken(
  contactId: string,
  workspaceId: string,
  categoryName: string
): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET is not configured");
  }
  const hmac = createHmac("sha256", secret);
  hmac.update(`${contactId}:${workspaceId}:${categoryName}`);
  return hmac.digest("hex");
}

/**
 * Verify an unsubscribe token using timing-safe comparison.
 */
export function verifyUnsubscribeToken(
  contactId: string,
  workspaceId: string,
  categoryName: string,
  token: string
): boolean {
  if (!getSecret()) return false;

  try {
    const expected = generateUnsubscribeToken(contactId, workspaceId, categoryName);
    const a = Buffer.from(token, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Build the full unsubscribe URL for a contact + workspace + category.
 */
export function buildUnsubscribeUrl(
  contactId: string,
  workspaceId: string,
  categoryName: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = generateUnsubscribeToken(contactId, workspaceId, categoryName);
  return `${appUrl}/unsubscribe?contact=${contactId}&workspace=${workspaceId}&category=${encodeURIComponent(categoryName)}&token=${token}`;
}
