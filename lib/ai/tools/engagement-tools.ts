import { z } from "zod";
import { isProgrammingDomain } from "./utils";
import type {
  CodeExerciseEngagementBlock,
  EssayEngagementBlock,
  FillInBlankEngagementBlock,
  MatchingEngagementBlock,
} from "./types";
import type { RegisteredTool } from "./registry";

const codeExerciseInputSchema = z.object({
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
});

export const generateCodeExerciseTool: RegisteredTool<
  typeof codeExerciseInputSchema
> = {
  name: "generate_code_exercise",
  schema: {
    title: "Code exercise",
    description:
      "Creates a hands-on coding prompt with starter code and optional hints.",
    input: codeExerciseInputSchema,
  },
  execute: async (input, context) => {
    if (!isProgrammingDomain(context.domain)) {
      return {
        success: false,
        toolName: "generate_code_exercise",
        error:
          "Code exercises are only generated for programming-related domains.",
      };
    }

    const block: CodeExerciseEngagementBlock = {
      type: "code-exercise",
      prompt: input.prompt,
      starterCode: input.starterCode,
      solution: input.solution,
      language: input.language,
      testCases: input.testCases,
      hints: input.hints,
    };

    return {
      success: true,
      toolName: "generate_code_exercise",
      block,
      metadata: {
        moduleTitle: context.moduleTitle,
        lessonTitle: context.lessonTitle,
        domain: context.domain,
        learnerLevel: context.learnerLevel,
      },
    };
  },
};

const fillInBlankInputSchema = z.object({
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
});

export const generateFillInBlankTool: RegisteredTool<
  typeof fillInBlankInputSchema
> = {
  name: "generate_fill_in_blank",
  schema: {
    title: "Fill in the blank",
    description:
      "Creates a fill-in-the-blank activity with defined blanks and answers.",
    input: fillInBlankInputSchema,
  },
  execute: async (input, context) => {
    const block: FillInBlankEngagementBlock = {
      type: "fill-in-blank",
      prompt: input.prompt,
      blanks: input.blanks,
      caseSensitive: input.caseSensitive,
    };

    return {
      success: true,
      toolName: "generate_fill_in_blank",
      block,
      metadata: {
        moduleTitle: context.moduleTitle,
        lessonTitle: context.lessonTitle,
        domain: context.domain,
        learnerLevel: context.learnerLevel,
      },
    };
  },
};

const matchingInputSchema = z.object({
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
});

export const generateMatchingTool: RegisteredTool<
  typeof matchingInputSchema
> = {
  name: "generate_matching",
  schema: {
    title: "Matching exercise",
    description:
      "Creates a matching activity linking items from two lists with correct pairs.",
    input: matchingInputSchema,
  },
  execute: async (input, context) => {
    const block: MatchingEngagementBlock = {
      type: "matching",
      prompt: input.prompt,
      leftItems: input.leftItems,
      rightItems: input.rightItems,
      correctPairs: input.correctPairs,
    };

    return {
      success: true,
      toolName: "generate_matching",
      block,
      metadata: {
        moduleTitle: context.moduleTitle,
        lessonTitle: context.lessonTitle,
        domain: context.domain,
        learnerLevel: context.learnerLevel,
      },
    };
  },
};

const essayInputSchema = z.object({
  prompt: z.string().min(1),
  guidance: z.string().optional(),
  minWords: z.number().int().positive().optional(),
  maxWords: z.number().int().positive().optional(),
  rubric: z.string().optional(),
  enableAIFeedback: z.boolean().optional(),
});

export const generateEssayTool: RegisteredTool<typeof essayInputSchema> = {
  name: "generate_essay_prompt",
  schema: {
    title: "Essay prompt",
    description:
      "Creates an essay prompt with optional guidance and word count recommendations.",
    input: essayInputSchema,
  },
  execute: async (input, context) => {
    const block: EssayEngagementBlock = {
      type: "essay",
      prompt: input.prompt,
      guidance: input.guidance,
      minWords: input.minWords,
      maxWords: input.maxWords,
      rubric: input.rubric,
      enableAIFeedback: input.enableAIFeedback,
    };

    return {
      success: true,
      toolName: "generate_essay_prompt",
      block,
      metadata: {
        moduleTitle: context.moduleTitle,
        lessonTitle: context.lessonTitle,
        domain: context.domain,
        learnerLevel: context.learnerLevel,
      },
    };
  },
};
