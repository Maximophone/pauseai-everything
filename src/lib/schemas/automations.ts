import { z } from "zod";

const RuleCondition = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
});

const RuleAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_field"), field: z.string(), value: z.unknown() }),
  z.object({ type: z.literal("add_tag"), tag: z.string() }),
  z.object({ type: z.literal("remove_tag"), tag: z.string() }),
]);

export const AutomationRuleConfig = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(RuleCondition).min(1),
  actions: z.array(RuleAction).min(1),
});
export type AutomationRuleConfig = z.infer<typeof AutomationRuleConfig>;

export const CreateAutomationInput = z.object({
  name: z.string().min(1, "name is required."),
  description: z.string().nullable().optional(),
  config: AutomationRuleConfig,
});
export type CreateAutomationInput = z.infer<typeof CreateAutomationInput>;

export const UpdateAutomationInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  config: AutomationRuleConfig.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationInput>;
