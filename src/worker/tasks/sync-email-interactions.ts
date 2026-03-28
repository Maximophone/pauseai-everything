import type { Task } from "graphile-worker";
import { db } from "@/db";
import {
  emailConnections,
  emailContactSettings,
} from "@/db/schema/email-connections";
import { contacts } from "@/db/schema/contacts";
import { interactions } from "@/db/schema/interactions";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  getValidAccessToken,
  fetchMessagesSince,
  parseEmailAddresses,
} from "@/lib/gmail";

/**
 * Sync email interactions from a user's Gmail account.
 * For each connected contact with sync enabled, fetches recent messages
 * and creates interaction records (deduped by provider_message_id).
 */
export const syncEmailInteractionsTask: Task = async (payload, helpers) => {
  const { emailConnectionId } = payload as { emailConnectionId: string };

  helpers.logger.info(`Syncing email interactions for connection ${emailConnectionId}`);

  // Load the connection
  const [connection] = await db
    .select()
    .from(emailConnections)
    .where(eq(emailConnections.id, emailConnectionId));

  if (!connection) {
    helpers.logger.error(`Connection ${emailConnectionId} not found`);
    return;
  }

  if (connection.status !== "connected") {
    helpers.logger.info(`Connection ${emailConnectionId} is not active (${connection.status}), skipping`);
    return;
  }

  // Get valid access token
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(connection);
  } catch (err) {
    helpers.logger.error(`Failed to get access token: ${err}`);
    return;
  }

  // Get contacts with sync enabled for this connection
  const syncSettings = await db
    .select({
      contactId: emailContactSettings.contactId,
      interactionsVisible: emailContactSettings.interactionsVisible,
    })
    .from(emailContactSettings)
    .where(
      and(
        eq(emailContactSettings.emailConnectionId, emailConnectionId),
        eq(emailContactSettings.syncInteractions, true)
      )
    );

  if (syncSettings.length === 0) {
    helpers.logger.info("No contacts with sync enabled, skipping");
    await updateLastSynced(emailConnectionId);
    return;
  }

  // Get email addresses for these contacts
  const contactIds = syncSettings.map((s) => s.contactId);
  const contactRows = await db
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(inArray(contacts.id, contactIds));

  const emailToContact = new Map<string, { id: string; visible: boolean }>();
  for (const contact of contactRows) {
    if (!contact.email) continue;
    const setting = syncSettings.find((s) => s.contactId === contact.id);
    emailToContact.set(contact.email.toLowerCase().trim(), {
      id: contact.id,
      visible: setting?.interactionsVisible ?? true,
    });
  }

  if (emailToContact.size === 0) {
    helpers.logger.info("No contacts with email addresses, skipping");
    await updateLastSynced(emailConnectionId);
    return;
  }

  // Determine since date: last sync or 30 days ago
  const sinceDate = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch messages from Gmail
  const emailAddresses = Array.from(emailToContact.keys());
  let messages;
  try {
    messages = await fetchMessagesSince(accessToken, sinceDate, emailAddresses);
  } catch (err) {
    helpers.logger.error(`Failed to fetch messages: ${err}`);
    await db
      .update(emailConnections)
      .set({
        status: "error",
        statusMessage: `Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, emailConnectionId));
    return;
  }

  helpers.logger.info(`Fetched ${messages.length} messages to process`);

  let created = 0;
  let skipped = 0;

  for (const msg of messages) {
    // Check if already imported (dedup by providerMessageId)
    if (msg.id) {
      const [existing] = await db
        .select({ id: interactions.id })
        .from(interactions)
        .where(
          and(
            eq(interactions.providerMessageId, msg.id),
            eq(interactions.emailConnectionId, emailConnectionId)
          )
        );

      if (existing) {
        skipped++;
        continue;
      }
    }

    // Find which CRM contact this message relates to
    const fromAddresses = parseEmailAddresses(msg.headers["from"] || "");
    const toAddresses = parseEmailAddresses(msg.headers["to"] || "");
    const ccAddresses = parseEmailAddresses(msg.headers["cc"] || "");
    const allAddresses = [...fromAddresses, ...toAddresses, ...ccAddresses];

    // Match against synced contacts
    let matchedContact: { id: string; visible: boolean } | undefined;
    let interactionType: "email_sent" | "email_received" = "email_sent";

    for (const addr of allAddresses) {
      const match = emailToContact.get(addr.email);
      if (match) {
        matchedContact = match;
        // If the CRM contact is in the From field, it's "email_received"
        if (fromAddresses.some((f) => f.email === addr.email)) {
          interactionType = "email_received";
        }
        break;
      }
    }

    if (!matchedContact) {
      skipped++;
      continue;
    }

    // Create the interaction
    try {
      await db.insert(interactions).values({
        contactId: matchedContact.id,
        userId: connection.userId,
        type: interactionType,
        subject: msg.headers["subject"] || null,
        body: msg.snippet || null,
        metadata: {
          source: "gmail",
          provider_message_id: msg.id,
          provider_thread_id: msg.threadId,
          from: msg.headers["from"] || "",
          to: msg.headers["to"] || "",
          cc: msg.headers["cc"] || "",
        },
        occurredAt: new Date(parseInt(msg.internalDate, 10)),
        emailConnectionId: emailConnectionId,
        providerMessageId: msg.id,
        visibleToTeam: matchedContact.visible,
      });
      created++;
    } catch (err) {
      helpers.logger.warn(`Failed to create interaction for message ${msg.id}: ${err}`);
    }
  }

  helpers.logger.info(`Sync complete: ${created} created, ${skipped} skipped`);
  await updateLastSynced(emailConnectionId);
};

async function updateLastSynced(connectionId: string) {
  await db
    .update(emailConnections)
    .set({
      lastSyncedAt: new Date(),
      status: "connected",
      statusMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(emailConnections.id, connectionId));
}
