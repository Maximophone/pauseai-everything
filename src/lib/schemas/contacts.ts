import { z } from "zod";

export const CreateContactInput = z
  .object({
    email: z.string().email().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    customFields: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((d) => d.email || d.firstName || d.lastName, {
    message: "At least one of email, firstName, or lastName is required.",
  });
export type CreateContactInput = z.infer<typeof CreateContactInput>;

export const UpdateContactInput = z.object({
  email: z.string().email().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  globallyUnsubscribed: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  communicationPreferences: z.record(z.string(), z.enum(["subscribed", "unsubscribed"])).optional(),
});
export type UpdateContactInput = z.infer<typeof UpdateContactInput>;

export const ContactListParams = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
export type ContactListParams = z.infer<typeof ContactListParams>;

export const ImportContactsInput = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1, "No rows to import."),
  mapping: z.record(z.string(), z.string()),
  constantValues: z.record(z.string(), z.unknown()).optional(),
  skipDuplicates: z.boolean().default(true),
});
export type ImportContactsInput = z.infer<typeof ImportContactsInput>;
