import { z } from "zod";

export const UpdateUserInput = z.object({
  isAdmin: z.boolean({ message: "isAdmin is required." }),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;
