import { randomUUID } from "crypto";
import { decrypt, encrypt } from "./encryption";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, sql } from "drizzle-orm";

// ---------- OAuth helpers ----------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getGoogleClientId(): string {
  const id = process.env.AUTH_GOOGLE_ID;
  if (!id) throw new Error("AUTH_GOOGLE_ID is required");
  return id;
}

function getGoogleClientSecret(): string {
  const secret = process.env.AUTH_GOOGLE_SECRET;
  if (!secret) throw new Error("AUTH_GOOGLE_SECRET is required");
  return secret;
}

function getGmailCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/auth/gmail/callback`;
}

/**
 * Build the Google OAuth authorization URL for Gmail access.
 * Includes state parameter for CSRF protection.
 */
export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGmailCallbackUrl(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // Force consent to always get refresh_token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGmailCallbackUrl(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error(
      "No refresh_token received. User may need to revoke access and reconnect."
    );
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Get the user's email from the userinfo endpoint
  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${data.access_token}` } }
  );
  if (!userInfoRes.ok) {
    throw new Error(`Failed to fetch user info: ${await userInfoRes.text()}`);
  }
  const userInfo = await userInfoRes.json();
  if (!userInfo.email) {
    throw new Error("No email returned from Google userinfo endpoint");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    email: userInfo.email,
  };
}

/**
 * Refresh an access token using a refresh token.
 * Updates the stored token in the database.
 */
export async function refreshAccessToken(
  connectionId: string,
  encryptedRefreshToken: string
): Promise<string> {
  const refreshToken = decrypt(encryptedRefreshToken);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Mark connection as errored
    await db
      .update(emailConnections)
      .set({
        status: "error",
        statusMessage: `Token refresh failed: ${err}`,
        updatedAt: sql`now()`,
      })
      .where(eq(emailConnections.id, connectionId));
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db
    .update(emailConnections)
    .set({
      accessToken: encrypt(data.access_token),
      tokenExpiresAt: newExpiresAt,
      updatedAt: sql`now()`,
    })
    .where(eq(emailConnections.id, connectionId));

  return data.access_token;
}

/**
 * Get a valid access token for a connection, refreshing if necessary.
 */
export async function getValidAccessToken(connection: {
  id: string;
  accessToken: string | null;
  refreshToken: string;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  // If token exists and not expired (with 60s buffer), use it
  if (
    connection.accessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return decrypt(connection.accessToken);
  }

  // Otherwise refresh
  return refreshAccessToken(connection.id, connection.refreshToken);
}

// ---------- Gmail API wrappers ----------

export type GmailMessageHeader = {
  name: string;
  value: string;
};

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string; // epoch ms as string
  headers: Record<string, string>;
};

/**
 * List message IDs matching a query, with pagination.
 */
export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 100,
  pageToken?: string
): Promise<{ messageIds: string[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Gmail list messages failed: ${await res.text()}`);
  }

  const data = await res.json();
  const messageIds = (data.messages || []).map(
    (m: { id: string }) => m.id
  );
  return { messageIds, nextPageToken: data.nextPageToken };
}

/**
 * Get message metadata (headers + snippet, no body).
 */
export async function getMessageMetadata(
  accessToken: string,
  messageId: string
): Promise<GmailMessageMeta> {
  // Gmail API needs repeated params for multiple headers
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail get message failed: ${await res.text()}`);
  }

  const data = await res.json();
  const headers: Record<string, string> = {};
  for (const h of data.payload?.headers || []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet || "",
    internalDate: data.internalDate,
    headers,
  };
}

// ---------- Gmail Batch API ----------

const GMAIL_BATCH_ENDPOINT = "https://gmail.googleapis.com/batch/gmail/v1";
const METADATA_QUERY_PARAMS =
  "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date";
const BATCH_SIZE = 50; // stay within Gmail rate limits (250 units/s, 5 units per messages.get)

/**
 * Build a multipart/mixed body for a Gmail batch request.
 */
function buildBatchBody(messageIds: string[], boundary: string): string {
  const parts = messageIds.map((id, index) => {
    const path = `/gmail/v1/users/me/messages/${id}?${METADATA_QUERY_PARAMS}`;
    return [
      `--${boundary}`,
      "Content-Type: application/http",
      `Content-ID: <item${index}>`,
      "",
      `GET ${path} HTTP/1.1`,
      "",
    ].join("\r\n");
  });
  return parts.join("\r\n") + `\r\n--${boundary}--`;
}

/**
 * Parse a multipart/mixed batch response into individual JSON responses.
 */
function parseBatchResponse(
  responseText: string,
  contentType: string
): Array<{ statusCode: number; body: Record<string, unknown> | string }> {
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    throw new Error("No boundary found in batch response Content-Type");
  }
  const boundary = boundaryMatch[1].trim();
  const parts = responseText.split(`--${boundary}`);
  const results: Array<{
    statusCode: number;
    body: Record<string, unknown> | string;
  }> = [];

  for (const part of parts) {
    if (!part.trim() || part.trim() === "--") continue;

    const httpMatch = part.match(/HTTP\/1\.1 (\d+)/);
    if (!httpMatch) continue;

    const statusCode = parseInt(httpMatch[1], 10);

    // Find the JSON body after the double newline following the HTTP status line
    const httpIdx = part.indexOf("HTTP/1.1");
    // Try \r\n\r\n first, then \n\n
    let jsonStart = part.indexOf("\r\n\r\n", httpIdx);
    let jsonStr =
      jsonStart !== -1 ? part.substring(jsonStart + 4).trim() : "";
    if (!jsonStr) {
      jsonStart = part.indexOf("\n\n", httpIdx);
      jsonStr = jsonStart !== -1 ? part.substring(jsonStart + 2).trim() : "";
    }

    try {
      results.push({ statusCode, body: JSON.parse(jsonStr) });
    } catch {
      results.push({ statusCode, body: jsonStr });
    }
  }

  return results;
}

/**
 * Fetch metadata for multiple messages in a single batch HTTP request.
 * Max 50 per call to stay within Gmail rate limits.
 */
async function batchGetMessageMetadata(
  accessToken: string,
  messageIds: string[]
): Promise<GmailMessageMeta[]> {
  const boundary = `batch_${randomUUID()}`;
  const body = buildBatchBody(messageIds, boundary);

  const res = await fetch(GMAIL_BATCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Batch request failed: ${res.status} ${await res.text()}`);
  }

  const responseText = await res.text();
  const ct = res.headers.get("content-type") || "";
  const parsed = parseBatchResponse(responseText, ct);
  const results: GmailMessageMeta[] = [];

  for (const { statusCode, body: respBody } of parsed) {
    if (statusCode !== 200 || typeof respBody === "string") continue;

    const data = respBody as Record<string, unknown>;
    const headers: Record<string, string> = {};
    const payload = data.payload as
      | { headers?: Array<{ name: string; value: string }> }
      | undefined;
    for (const h of payload?.headers || []) {
      headers[h.name.toLowerCase()] = h.value;
    }

    results.push({
      id: data.id as string,
      threadId: data.threadId as string,
      snippet: (data.snippet as string) || "",
      internalDate: data.internalDate as string,
      headers,
    });
  }

  return results;
}

/**
 * Fetch metadata for many message IDs, splitting into batch-size chunks.
 */
export async function batchGetAllMessageMetadata(
  accessToken: string,
  messageIds: string[]
): Promise<GmailMessageMeta[]> {
  const allResults: GmailMessageMeta[] = [];

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const chunk = messageIds.slice(i, i + BATCH_SIZE);
    const results = await batchGetMessageMetadata(accessToken, chunk);
    allResults.push(...results);
  }

  return allResults;
}

/**
 * Parse email addresses from a header value like "Display Name <email@example.com>, other@example.com"
 */
export function parseEmailAddresses(
  headerValue: string
): Array<{ email: string; name: string }> {
  if (!headerValue) return [];

  const results: Array<{ email: string; name: string }> = [];
  // Split on commas, but not commas inside quotes
  const parts = headerValue.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  for (const part of parts) {
    const trimmed = part.trim();
    // Format: "Display Name <email@example.com>" or just "email@example.com"
    const angleMatch = trimmed.match(/^"?(.+?)"?\s*<([^>]+)>$/);
    if (angleMatch) {
      results.push({
        name: angleMatch[1].trim().replace(/^"|"$/g, ""),
        email: angleMatch[2].trim().toLowerCase(),
      });
    } else if (trimmed.includes("@")) {
      results.push({ name: "", email: trimmed.toLowerCase() });
    }
  }

  return results;
}

/**
 * Fetch unique email addresses the user has sent emails to.
 * Scans sent messages and extracts To/Cc addresses.
 */
export async function fetchSentToContacts(
  accessToken: string,
  maxPages = 10
): Promise<Array<{ email: string; name: string }>> {
  const seen = new Map<string, string>(); // email -> best name
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const { messageIds, nextPageToken } = await listMessages(
      accessToken,
      "in:sent",
      100,
      pageToken
    );

    if (messageIds.length === 0) break;

    // Batch fetch metadata using Gmail batch API
    const metadataResults = await batchGetAllMessageMetadata(
      accessToken,
      messageIds
    );

    for (const meta of metadataResults) {
      const toAddresses = parseEmailAddresses(meta.headers["to"] || "");
      const ccAddresses = parseEmailAddresses(meta.headers["cc"] || "");

      for (const addr of [...toAddresses, ...ccAddresses]) {
        const existing = seen.get(addr.email);
        // Keep the name if we have one and didn't before
        if (!existing || (existing === "" && addr.name)) {
          seen.set(addr.email, addr.name);
        }
      }
    }

    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
}

/**
 * Fetch messages since a given date, matching any of the provided email addresses.
 * Returns metadata for each message (no body).
 */
export async function fetchMessagesSince(
  accessToken: string,
  sinceDate: Date,
  emailAddresses: string[],
  maxPages = 5
): Promise<GmailMessageMeta[]> {
  if (emailAddresses.length === 0) return [];

  const afterEpoch = Math.floor(sinceDate.getTime() / 1000);
  // Build query: messages to/from any of these addresses since the date
  const addressQuery = emailAddresses
    .map((e) => `{from:${e} to:${e}}`)
    .join(" OR ");
  const query = `after:${afterEpoch} (${addressQuery})`;

  const allMessages: GmailMessageMeta[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const { messageIds, nextPageToken } = await listMessages(
      accessToken,
      query,
      100,
      pageToken
    );

    if (messageIds.length === 0) break;

    // Batch fetch metadata using Gmail batch API
    const results = await batchGetAllMessageMetadata(accessToken, messageIds);
    allMessages.push(...results);

    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return allMessages;
}

/**
 * Revoke a Google OAuth token.
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}
