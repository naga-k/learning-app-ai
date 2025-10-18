import { z } from "zod";

const EngagementMetadataSchema = z.object({
  id: z.string().min(1).optional(),
  revision: z.number().int().positive().optional(),
  contentHash: z.string().min(1).optional(),
});

export const QuizEngagementBlockSchema = z.object({
  type: z.literal("quiz"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().int().nonnegative(),
  rationale: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
}).merge(EngagementMetadataSchema);

export type QuizEngagementBlock = z.infer<typeof QuizEngagementBlockSchema>;

export const ReflectionEngagementBlockSchema = z.object({
  type: z.literal("reflection"),
  prompt: z.string().min(1),
  guidance: z.string().optional(),
  expectedDurationMinutes: z.number().int().positive().optional(),
}).merge(EngagementMetadataSchema);

export type ReflectionEngagementBlock = z.infer<
  typeof ReflectionEngagementBlockSchema
>;

export const EngagementBlockSchema = z.discriminatedUnion("type", [
  QuizEngagementBlockSchema,
  ReflectionEngagementBlockSchema,
]);

export type EngagementBlock = z.infer<typeof EngagementBlockSchema>;

export const EngagementBlockArraySchema = z.array(EngagementBlockSchema);

export type EngagementBlockWithMetadata = EngagementBlock & {
  id?: string;
  revision?: number;
  contentHash?: string;
};
