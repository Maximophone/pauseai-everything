import { z } from "zod";

export const ErrorResponse = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const SuccessResponse = z.object({
  success: z.literal(true),
});
export type SuccessResponse = z.infer<typeof SuccessResponse>;

export const PaginationParams = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type PaginationParams = z.infer<typeof PaginationParams>;

export const UuidParam = z.string().uuid();
