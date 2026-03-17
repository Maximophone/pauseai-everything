import { NextRequest, NextResponse } from "next/server";
import { createContact } from "@/lib/contacts";
import { createInteraction } from "@/lib/interactions";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { eq } from "drizzle-orm";

/**
 * POST /api/webhooks/tally
 *
 * Receives a Tally form submission webhook and creates or updates a contact.
 *
 * Tally webhook payload structure:
 * {
 *   "eventId": "...",
 *   "eventType": "FORM_RESPONSE",
 *   "createdAt": "2026-03-17T...",
 *   "data": {
 *     "responseId": "...",
 *     "submissionId": "...",
 *     "formId": "...",
 *     "formName": "Join PauseAI",
 *     "createdAt": "...",
 *     "fields": [
 *       { "key": "question_abc", "label": "Email", "type": "INPUT_EMAIL", "value": "jane@example.com" },
 *       { "key": "question_def", "label": "First Name", "type": "INPUT_TEXT", "value": "Jane" },
 *       { "key": "question_ghi", "label": "Last Name", "type": "INPUT_TEXT", "value": "Doe" },
 *       { "key": "question_jkl", "label": "Country", "type": "INPUT_TEXT", "value": "Germany" },
 *       ...
 *     ]
 *   }
 * }
 *
 * Field mapping is configurable via TALLY_FIELD_MAP env var (JSON).
 * Default: maps common labels to our contact fields.
 */

// Default label → contact field mapping (case-insensitive)
const DEFAULT_FIELD_MAP: Record<string, string> = {
  email: "_email",
  "email address": "_email",
  "e-mail": "_email",
  "first name": "_firstName",
  "firstname": "_firstName",
  "last name": "_lastName",
  "lastname": "_lastName",
  name: "_name", // will be split into first/last
  country: "country",
  chapter: "chapter",
  skills: "skills",
  "hours committed": "hours_committed",
  "hours per week": "hours_committed",
  motivation: "motivation_level",
  "motivation level": "motivation_level",
};

function getFieldMap(): Record<string, string> {
  const envMap = process.env.TALLY_FIELD_MAP;
  if (envMap) {
    try {
      return { ...DEFAULT_FIELD_MAP, ...JSON.parse(envMap) };
    } catch {
      console.warn("Invalid TALLY_FIELD_MAP env var, using defaults");
    }
  }
  return DEFAULT_FIELD_MAP;
}

type TallyField = {
  key: string;
  label: string;
  type: string;
  value: unknown;
};

type TallyPayload = {
  eventId: string;
  eventType: string;
  createdAt: string;
  data: {
    responseId: string;
    submissionId: string;
    formId: string;
    formName: string;
    createdAt: string;
    fields: TallyField[];
  };
};

export async function POST(request: NextRequest) {
  let payload: TallyPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.eventType !== "FORM_RESPONSE") {
    return NextResponse.json({ status: "ignored", reason: "not a form response" });
  }

  const fields = payload.data?.fields;
  if (!fields || !Array.isArray(fields)) {
    return NextResponse.json({ error: "No fields in payload" }, { status: 400 });
  }

  const fieldMap = getFieldMap();

  // Extract values from Tally fields
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  const customFields: Record<string, unknown> = {
    lifecycle_stage: "joined",
    source: "tally_form",
  };

  for (const field of fields) {
    const mappedKey = fieldMap[field.label.toLowerCase()];
    if (!mappedKey) {
      // Store unmapped fields with a tally_ prefix
      customFields[`tally_${field.key}`] = field.value;
      continue;
    }

    switch (mappedKey) {
      case "_email":
        email = (field.value as string) || null;
        break;
      case "_firstName":
        firstName = (field.value as string) || null;
        break;
      case "_lastName":
        lastName = (field.value as string) || null;
        break;
      case "_name": {
        // Split "Jane Doe" into first/last
        const parts = ((field.value as string) || "").trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          firstName = parts[0];
        }
        break;
      }
      default:
        customFields[mappedKey] = field.value;
    }
  }

  if (!email) {
    return NextResponse.json(
      { error: "No email found in submission" },
      { status: 400 }
    );
  }

  // Check if contact already exists (by email)
  const [existing] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, email));

  let contactId: string;

  if (existing) {
    // Update existing contact — merge custom fields
    const mergedFields = { ...existing.customFields, ...customFields };
    await db
      .update(contacts)
      .set({
        firstName: firstName || existing.firstName,
        lastName: lastName || existing.lastName,
        customFields: mergedFields,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id));
    contactId = existing.id;
  } else {
    // Create new contact
    const contact = await createContact({
      email,
      firstName,
      lastName,
      customFields,
    });
    contactId = contact.id;
  }

  // Log the form submission as an interaction
  await createInteraction({
    contactId,
    type: "form_submission",
    subject: `Tally form: ${payload.data.formName}`,
    body: `Submitted form "${payload.data.formName}" (${payload.data.formId})`,
    metadata: {
      tallyEventId: payload.eventId,
      tallyResponseId: payload.data.responseId,
      tallyFormId: payload.data.formId,
      tallyFormName: payload.data.formName,
    },
    occurredAt: new Date(payload.data.createdAt),
  });

  return NextResponse.json({
    status: existing ? "updated" : "created",
    contactId,
  });
}
