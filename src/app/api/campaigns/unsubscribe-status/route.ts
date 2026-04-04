import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getBooleanSetting, SETTING_KEYS } from "@/lib/app-settings";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-tokens";

/**
 * Returns the current unsubscribe infrastructure status.
 * Used by the campaign editor to warn users when no unsubscribe mechanism
 * is available for categorized campaigns.
 */
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  // Check if UNSUBSCRIBE_SECRET is configured
  let secretConfigured = true;
  try {
    buildUnsubscribeUrl("test", "test", "test");
  } catch {
    secretConfigured = false;
  }

  // Check if List-Unsubscribe header is enabled
  const listUnsubscribeEnabled = await getBooleanSetting(
    SETTING_KEYS.MAILERSEND_LIST_UNSUBSCRIBE
  );

  return NextResponse.json({
    secretConfigured,
    listUnsubscribeEnabled,
  });
}
