import { z } from "zod";

export const CreateApiKeyInput = z.object({
  name: z.string().min(1, "name is required."),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInput>;
