import { z } from "zod";

export const ticketTypes = ["bug", "feature"] as const;
export const ticketStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export const ticketPriorities = ["low", "medium", "high"] as const;

export const CreateTicketInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(5000),
  type: z.enum(ticketTypes),
  priority: z.enum(ticketPriorities).optional(),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInput>;

export const UpdateTicketInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: z.enum(ticketTypes).optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
});
export type UpdateTicketInput = z.infer<typeof UpdateTicketInput>;

export const CreateTicketReplyInput = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(5000),
});
export type CreateTicketReplyInput = z.infer<typeof CreateTicketReplyInput>;
