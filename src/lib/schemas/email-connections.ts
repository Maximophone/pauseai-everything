import { z } from "zod";

// ── Email Connections ─────────────────────────────────────

export const UpdateEmailConnectionSettingsInput = z.object({
  defaultSyncInteractions: z.boolean().optional(),
  defaultInteractionsVisible: z.boolean().optional(),
  syncIntervalMinutes: z.union([z.literal(1), z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional(),
});
export type UpdateEmailConnectionSettingsInput = z.infer<
  typeof UpdateEmailConnectionSettingsInput
>;

// ── Email Contact Settings ────────────────────────────────

export const UpdateEmailContactSettingsInput = z.object({
  syncInteractions: z.boolean().optional(),
  interactionsVisible: z.boolean().optional(),
});
export type UpdateEmailContactSettingsInput = z.infer<
  typeof UpdateEmailContactSettingsInput
>;

export const BulkUpdateEmailContactSettingsInput = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  syncInteractions: z.boolean().optional(),
  interactionsVisible: z.boolean().optional(),
});
export type BulkUpdateEmailContactSettingsInput = z.infer<
  typeof BulkUpdateEmailContactSettingsInput
>;

// ── Import Gmail Contacts ─────────────────────────────────

export const ImportGmailContactsInput = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        syncInteractions: z.boolean().default(true),
        interactionsVisible: z.boolean().default(true),
      })
    )
    .min(1),
});
export type ImportGmailContactsInput = z.infer<
  typeof ImportGmailContactsInput
>;
