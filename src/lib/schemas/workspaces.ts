import { z } from "zod";

export const UpdateWorkspaceInput = z.object({
  name: z.string().min(1, "Name is required").optional(),
  slug: z.string().min(1).optional(),
  defaultLanguage: z.string().min(1).optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInput>;
