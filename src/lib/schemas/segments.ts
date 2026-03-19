import { z } from "zod";

export const SegmentCondition = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
});
export type SegmentCondition = z.infer<typeof SegmentCondition>;

export const SegmentFilter = z.object({
  match: z.enum(["all", "any"], {
    message: 'filter.match must be "all" or "any".',
  }),
  conditions: z.array(SegmentCondition).min(1),
});
export type SegmentFilter = z.infer<typeof SegmentFilter>;

export const CreateSegmentInput = z.object({
  name: z.string().min(1, "name is required."),
  description: z.string().nullable().optional(),
  filter: SegmentFilter,
});
export type CreateSegmentInput = z.infer<typeof CreateSegmentInput>;

export const UpdateSegmentInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filter: SegmentFilter.optional(),
});
export type UpdateSegmentInput = z.infer<typeof UpdateSegmentInput>;

export const SegmentPreviewInput = z.object({
  filter: SegmentFilter,
});
export type SegmentPreviewInput = z.infer<typeof SegmentPreviewInput>;
