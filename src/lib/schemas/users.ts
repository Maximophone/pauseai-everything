import { z } from "zod";

export const userRoles = ["admin", "member", "viewer"] as const;

export const UpdateUserInput = z.object({
  role: z.enum(userRoles, { message: "Role must be admin, member, or viewer." }),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const InviteUserInput = z.object({
  email: z
    .string()
    .email("A valid email address is required.")
    .transform((e) => e.toLowerCase().trim()),
  role: z.enum(userRoles).optional().default("viewer"),
});
export type InviteUserInput = z.infer<typeof InviteUserInput>;
