import { z } from "zod";

export const UpdateUserInput = z.object({
  isAdmin: z.boolean({ message: "isAdmin is required." }),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const InviteUserInput = z.object({
  email: z
    .string()
    .email("A valid email address is required.")
    .transform((e) => e.toLowerCase().trim()),
});
export type InviteUserInput = z.infer<typeof InviteUserInput>;
