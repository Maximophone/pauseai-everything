import { z } from "zod";

const INTERACTION_TYPES = [
  "email_sent",
  "email_received",
  "call",
  "meeting",
  "note",
  "form_submission",
  "event_attended",
  "action_taken",
  "stage_change",
] as const;

export const CreateInteractionInput = z.object({
  type: z.enum(INTERACTION_TYPES, {
    message: `type must be one of: ${INTERACTION_TYPES.join(", ")}`,
  }),
  subject: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CreateInteractionInput = z.infer<typeof CreateInteractionInput>;
