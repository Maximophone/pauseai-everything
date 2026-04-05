import { z } from "zod";

export const CreateCampaignInput = z.object({
  name: z.string().min(1, "name is required.").max(200),
  subject: z.string().min(1, "subject is required.").max(998),
  body: z.string().min(1, "body is required.").max(500_000),
  fromName: z.string().nullable().optional(),
  fromEmail: z.string().email().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  allowNoUnsubscribe: z.boolean().optional(),
});
export type CreateCampaignInput = z.infer<typeof CreateCampaignInput>;

export const UpdateCampaignInput = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(998).optional(),
  body: z.string().min(1).max(500_000).optional(),
  fromName: z.string().nullable().optional(),
  fromEmail: z.string().email().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  allowNoUnsubscribe: z.boolean().optional(),
});
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInput>;

export const CampaignPreviewInput = z.object({
  email: z.string().email("email is required."),
});
export type CampaignPreviewInput = z.infer<typeof CampaignPreviewInput>;
