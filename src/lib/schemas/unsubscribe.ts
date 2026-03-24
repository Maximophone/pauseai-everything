import { z } from "zod";

export const UnsubscribeInput = z.object({
  contactId: z.string().uuid("contactId must be a valid UUID."),
  workspaceId: z.string().uuid("workspaceId must be a valid UUID."),
  category: z.string().min(1, "category is required."),
  token: z.string().min(1, "token is required."),
  /** Per-category preferences to update. Key = "workspaceId:categoryName", value = subscription state. */
  preferences: z.record(z.string(), z.enum(["subscribed", "unsubscribed"])).optional(),
  /** Set to true to unsubscribe from all communications from a specific workspace */
  unsubscribeFromWorkspace: z.string().uuid().optional(),
  /** Set to true to globally unsubscribe from all PauseAI communications */
  globalUnsubscribe: z.boolean().optional(),
});
export type UnsubscribeInput = z.infer<typeof UnsubscribeInput>;
