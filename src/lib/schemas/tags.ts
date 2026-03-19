import { z } from "zod";

export const CreateTagInput = z.object({
  name: z.string().min(1, "name is required."),
  color: z.string().nullable().optional(),
});
export type CreateTagInput = z.infer<typeof CreateTagInput>;

export const UpdateTagInput = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
});
export type UpdateTagInput = z.infer<typeof UpdateTagInput>;

export const ContactTagInput = z.object({
  tagId: z.string().uuid("tagId is required."),
});
export type ContactTagInput = z.infer<typeof ContactTagInput>;
