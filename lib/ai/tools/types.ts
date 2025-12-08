import { z } from "zod";

const EngagementMetadataSchema = z.object({
  id: z.string().min(1).optional(),
  revision: z.number().int().positive().optional(),
  contentHash: z.string().min(1).optional(),
});

export const CodeExerciseEngagementBlockSchema = z
  .object({
    type: z.literal("code-exercise"),
    prompt: z.string().min(1),
    starterCode: z.string().min(1).optional(),
    solution: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    testCases: z
      .array(
        z.object({
          input: z.string().min(1),
          expectedOutput: z.string().min(1),
        }),
      )
      .optional(),
    hints: z.array(z.string().min(1)).optional(),
  })
  .merge(EngagementMetadataSchema);

export type CodeExerciseEngagementBlock = z.infer<
  typeof CodeExerciseEngagementBlockSchema
>;

export const FillInBlankEngagementBlockSchema = z
  .object({
    type: z.literal("fill-in-blank"),
    prompt: z.string().min(1),
    blanks: z
      .array(
        z.object({
          id: z.string().min(1),
          correctAnswer: z.string().min(1),
          alternatives: z.array(z.string().min(1)).optional(),
        }),
      )
      .min(1),
    caseSensitive: z.boolean().optional(),
  })
  .merge(EngagementMetadataSchema);

export type FillInBlankEngagementBlock = z.infer<
  typeof FillInBlankEngagementBlockSchema
>;

export const MatchingEngagementBlockSchema = z
  .object({
    type: z.literal("matching"),
    prompt: z.string().min(1),
    leftItems: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
        }),
      )
      .min(1),
    rightItems: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
        }),
      )
      .min(1),
    correctPairs: z
      .array(
        z.object({
          leftId: z.string().min(1),
          rightId: z.string().min(1),
        }),
      )
      .min(1),
  })
  .merge(EngagementMetadataSchema);

export type MatchingEngagementBlock = z.infer<
  typeof MatchingEngagementBlockSchema
>;

export const EssayEngagementBlockSchema = z
  .object({
    type: z.literal("essay"),
    prompt: z.string().min(1),
    guidance: z.string().optional(),
    minWords: z.number().int().positive().optional(),
    maxWords: z.number().int().positive().optional(),
    rubric: z.string().optional(),
    enableAIFeedback: z.boolean().optional(),
  })
  .merge(EngagementMetadataSchema);

export type EssayEngagementBlock = z.infer<typeof EssayEngagementBlockSchema>;

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
  CodeExerciseEngagementBlockSchema,
  FillInBlankEngagementBlockSchema,
  MatchingEngagementBlockSchema,
  EssayEngagementBlockSchema,
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
