import { z } from "zod";

export const CreateScriptInput = z.object({
  name: z.string().min(1, "Name is required.").transform((s) => s.trim()),
  description: z
    .string()
    .transform((s) => s.trim() || null)
    .nullable()
    .optional(),
  code: z.string().default(""),
  cronSchedule: z
    .string()
    .transform((s) => s.trim() || null)
    .nullable()
    .optional(),
});
export type CreateScriptInput = z.infer<typeof CreateScriptInput>;

export const UpdateScriptInput = z.object({
  name: z
    .string()
    .min(1)
    .transform((s) => s.trim())
    .optional(),
  description: z
    .string()
    .transform((s) => s.trim() || null)
    .nullable()
    .optional(),
  code: z.string().optional(),
  cronSchedule: z
    .string()
    .transform((s) => s.trim() || null)
    .nullable()
    .optional(),
  enabled: z.boolean().optional(),
});
export type UpdateScriptInput = z.infer<typeof UpdateScriptInput>;
