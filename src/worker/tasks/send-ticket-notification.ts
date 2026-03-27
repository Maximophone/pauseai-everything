import type { Task } from "graphile-worker";
import { db } from "@/db";
import { supportTickets, ticketReplies } from "@/db/schema/support-tickets";
import { eq } from "drizzle-orm";
import { getTicketSubscribers } from "@/lib/support-tickets";
import { sendEmail, resolveFromEmail } from "@/lib/mailersend";
import { buildTicketUnsubscribeUrl } from "@/lib/ticket-unsubscribe-tokens";

interface TicketNotificationPayload {
  ticketId: string;
  event: "new_reply" | "status_change";
  actorUserId: string;
  replyId?: string;
  newStatus?: string;
  oldStatus?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const sendTicketNotificationTask: Task = async (payload, helpers) => {
  const { ticketId, event, actorUserId, replyId, newStatus, oldStatus } =
    payload as TicketNotificationPayload;

  helpers.logger.info(`Sending ticket notification: ${event} for ticket ${ticketId}`);

  const FROM_EMAIL = (await resolveFromEmail()) || "noreply@pauseai.info";

  // Fetch ticket
  const [ticket] = await db
    .select({ id: supportTickets.id, title: supportTickets.title })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) {
    helpers.logger.warn(`Ticket ${ticketId} not found, skipping notification`);
    return;
  }

  // Fetch reply if applicable
  let replyBody: string | undefined;
  if (event === "new_reply" && replyId) {
    const [reply] = await db
      .select({ body: ticketReplies.body })
      .from(ticketReplies)
      .where(eq(ticketReplies.id, replyId));
    replyBody = reply?.body;
  }

  // Get subscribers (excluding the actor)
  const subscribers = await getTicketSubscribers(ticketId, actorUserId);

  if (subscribers.length === 0) {
    helpers.logger.info(`No subscribers for ticket ${ticketId}, skipping`);
    return;
  }

  const ticketUrl = `${APP_URL}/dashboard/support/${ticketId}`;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = buildTicketUnsubscribeUrl(subscriber.userId, ticketId);

    let subject: string;
    let html: string;

    if (event === "new_reply") {
      subject = `New reply on: ${ticket.title}`;
      html = buildReplyEmail({
        ticketTitle: ticket.title,
        replyBody: replyBody || "(no content)",
        ticketUrl,
        unsubscribeUrl,
        recipientName: subscriber.name,
      });
    } else {
      subject = `Status changed: ${ticket.title}`;
      html = buildStatusChangeEmail({
        ticketTitle: ticket.title,
        oldStatus: oldStatus || "unknown",
        newStatus: newStatus || "unknown",
        ticketUrl,
        unsubscribeUrl,
        recipientName: subscriber.name,
      });
    }

    try {
      await sendEmail({
        to: [{ email: subscriber.email, name: subscriber.name || undefined }],
        from: { email: FROM_EMAIL, name: "PauseAI Support" },
        subject,
        html,
        tags: ["support-ticket", event],
      });
    } catch (err) {
      helpers.logger.error(
        `Failed to send notification to ${subscriber.email}: ${err}`
      );
    }
  }

  helpers.logger.info(
    `Sent ${event} notification to ${subscribers.length} subscriber(s) for ticket ${ticketId}`
  );
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildReplyEmail(params: {
  ticketTitle: string;
  replyBody: string;
  ticketUrl: string;
  unsubscribeUrl: string;
  recipientName: string | null;
}): string {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>A new reply was posted on <strong>${escapeHtml(params.ticketTitle)}</strong>:</p>
      <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; margin: 16px 0; color: #555;">
        ${escapeHtml(params.replyBody).replace(/\n/g, "<br>")}
      </blockquote>
      <p><a href="${params.ticketUrl}" style="color: #2563eb;">View ticket</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">
        You're receiving this because you're subscribed to this ticket.
        <a href="${params.unsubscribeUrl}" style="color: #888;">Unsubscribe</a>
      </p>
    </div>
  `.trim();
}

function buildStatusChangeEmail(params: {
  ticketTitle: string;
  oldStatus: string;
  newStatus: string;
  ticketUrl: string;
  unsubscribeUrl: string;
  recipientName: string | null;
}): string {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>The status of <strong>${escapeHtml(params.ticketTitle)}</strong> was changed from
        <strong>${formatStatus(params.oldStatus)}</strong> to
        <strong>${formatStatus(params.newStatus)}</strong>.</p>
      <p><a href="${params.ticketUrl}" style="color: #2563eb;">View ticket</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">
        You're receiving this because you're subscribed to this ticket.
        <a href="${params.unsubscribeUrl}" style="color: #888;">Unsubscribe</a>
      </p>
    </div>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
