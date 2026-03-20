import { z } from "zod";

export const UnsubscribeInput = z.object({
  contactId: z.string().uuid("contactId must be a valid UUID."),
  category: z.string().min(1, "category is required."),
  token: z.string().min(1, "token is required."),
  /** Per-category preferences to update. Key = category name, value = subscription state. */
  preferences: z.record(z.string(), z.enum(["subscribed", "unsubscribed"])).optional(),
});
export type UnsubscribeInput = z.infer<typeof UnsubscribeInput>;
