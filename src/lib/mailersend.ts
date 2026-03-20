const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || "";
const MAILERSEND_BASE = "https://api.mailersend.com/v1";

type EmailParams = {
  to: { email: string; name?: string }[];
  from: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  /** RFC 8058 one-click unsubscribe URL. Mailersend auto-adds List-Unsubscribe headers. */
  listUnsubscribe?: string;
};

type MailersendResponse = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendEmail(params: EmailParams): Promise<MailersendResponse> {
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

  if (params.listUnsubscribe) {
    body.settings = { list_unsubscribe: params.listUnsubscribe };
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

/**
 * Replaces merge fields like {{firstName}}, {{email}}, {{country}} in a template
 * with actual contact data.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = data[key];
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  });
}
