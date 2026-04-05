import { randomUUID } from "crypto";

const MAILERSEND_BASE = "https://api.mailersend.com/v1";

/**
 * Returns the current email mode: "sandbox" or "live".
 * Default (if unset): "sandbox" — fail safe, never accidentally send real emails.
 */
export function getEmailMode(): "sandbox" | "live" {
  const mode = process.env.EMAIL_MODE?.toLowerCase();
  if (mode === "live") return "live";
  return "sandbox";
}

async function resolveMailerSendKey(): Promise<string> {
  try {
    const { getSetting, SETTING_KEYS } = await import("@/lib/app-settings");
    const dbKey = await getSetting(SETTING_KEYS.MAILERSEND_API_KEY);
    if (dbKey) return dbKey;
  } catch {
    // DB not available (e.g. during build) — fall through to env
  }
  return process.env.MAILERSEND_API_KEY || "";
}

export async function resolveFromEmail(): Promise<string> {
  try {
    const { getSetting, SETTING_KEYS } = await import("@/lib/app-settings");
    const dbEmail = await getSetting(SETTING_KEYS.MAILERSEND_FROM_EMAIL);
    if (dbEmail) return dbEmail;
  } catch {
    // DB not available — fall through to env
  }
  return process.env.MAILERSEND_FROM_EMAIL || "";
}

export type EmailParams = {
  to: { email: string; name?: string }[];
  from: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  /** RFC 8058 one-click unsubscribe URL. Mailersend auto-adds List-Unsubscribe headers. */
  listUnsubscribe?: string;
  /** Whether to actually send the list_unsubscribe param (requires Professional+ plan). */
  includeListUnsubscribeHeader?: boolean;
  /** Optional metadata for sandbox capture. Not sent to Mailersend. */
  _sandbox?: {
    campaignId?: string;
    workspaceId?: string;
  };
};

export type MailersendResponse = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send an email. In sandbox mode (EMAIL_MODE=sandbox or unset), writes to the
 * sandbox_emails table instead of calling Mailersend. In live mode, sends via
 * the Mailersend API. All email-sending paths in the app MUST go through this
 * function so the sandbox interception is reliable.
 */
export async function sendEmail(params: EmailParams): Promise<MailersendResponse> {
  if (getEmailMode() === "sandbox") {
    return sendEmailSandbox(params);
  }
  return sendEmailLive(params);
}

async function sendEmailSandbox(params: EmailParams): Promise<MailersendResponse> {
  const { db } = await import("@/db");
  const { sandboxEmails } = await import("@/db/schema/sandbox-emails");

  const messageId = `sandbox_${randomUUID()}`;
  const now = new Date();
  const recipient = params.to[0] || { email: "unknown", name: undefined };

  // Build headers object representing what would have been sent
  const headers: Record<string, string> = {};
  if (params.listUnsubscribe && params.includeListUnsubscribeHeader) {
    headers["List-Unsubscribe"] = `<${params.listUnsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  if (params.tags?.length) {
    headers["X-Tags"] = params.tags.join(", ");
  }

  // Extract campaignId from tags if not provided in _sandbox metadata
  let campaignId = params._sandbox?.campaignId ?? null;
  if (!campaignId && params.tags) {
    const campaignTag = params.tags.find((t) => t.startsWith("campaign:"));
    if (campaignTag) campaignId = campaignTag.replace("campaign:", "");
  }

  await db.insert(sandboxEmails).values({
    messageId,
    toEmail: recipient.email,
    toName: recipient.name ?? null,
    fromEmail: params.from.email,
    fromName: params.from.name ?? null,
    subject: params.subject,
    bodyHtml: params.html,
    headers,
    campaignId,
    workspaceId: params._sandbox?.workspaceId ?? null,
    status: "sent",
    statusHistory: [{ event: "sent", timestamp: now.toISOString() }],
  });

  console.log(`[mailersend:sandbox] Captured email to ${recipient.email}: "${params.subject}" (${messageId})`);

  return { ok: true, messageId };
}

async function sendEmailLive(params: EmailParams): Promise<MailersendResponse> {
  const MAILERSEND_API_KEY = await resolveMailerSendKey();
  if (!MAILERSEND_API_KEY) {
    console.warn("[mailersend] No API key configured, skipping email send");
    return { ok: false, error: "MAILERSEND_API_KEY not configured" };
  }

  const body: Record<string, unknown> = {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    tags: params.tags,
  };

  // list_unsubscribe adds RFC 8058 one-click unsubscribe headers.
  // Requires Mailersend Professional+ plan — enable via Settings > Email Categories in the UI.
  // When disabled, the {{unsubscribe}} merge variable in the email body still works.
  if (params.listUnsubscribe && params.includeListUnsubscribeHeader) {
    body.list_unsubscribe = params.listUnsubscribe;
  }

  const res = await fetch(`${MAILERSEND_BASE}/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAILERSEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 202) {
    const messageId = res.headers.get("x-message-id") || undefined;
    return { ok: true, messageId };
  }

  const errorBody = await res.text();
  console.error(`[mailersend] Send failed (${res.status}):`, errorBody);
  return { ok: false, error: `Mailersend API error: ${res.status}` };
}

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replaces merge fields like {{firstName}}, {{email}}, {{country}} in a template
 * with actual contact data. Values are HTML-escaped to prevent injection.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = data[key];
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) return escapeHtml(val.join(", "));
    return escapeHtml(String(val));
  });
}
