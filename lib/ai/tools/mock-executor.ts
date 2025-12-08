import { z } from "zod";
import {
  InMemoryToolRegistry,
  type RegisteredTool,
  type ToolExecutionResult,
  type ToolRegistry,
} from "./registry";
import {
  generateCodeExerciseTool,
  generateEssayTool,
  generateFillInBlankTool,
  generateMatchingTool,
} from "./engagement-tools";
import type { EngagementBlock } from "./types";
import { executeEngagementTools, type ToolInvocation } from "./execution";

const quizInputSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answerIndex: z.number().int().nonnegative(),
  rationale: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

const reflectionInputSchema = z.object({
  prompt: z.string().min(1),
  guidance: z.string().optional(),
  expectedDurationMinutes: z.number().int().positive().optional(),
});

const quizTool: RegisteredTool<typeof quizInputSchema> = {
  name: "generate_multiple_choice_quiz",
  schema: {
    title: "Multiple-choice quiz",
    description:
      "Creates a single-question multiple-choice check-in to validate understanding.",
    input: quizInputSchema,
  },
  execute: async (input, context) => {
    const { options, answerIndex, rationale, difficulty, prompt } = input;
    if (answerIndex >= options.length) {
      return {
        success: false,
        toolName: "generate_multiple_choice_quiz",
        error: "answerIndex exceeds number of options.",
      };
    }

    return {
      success: true,
      toolName: "generate_multiple_choice_quiz",
      block: {
        type: "quiz",
        prompt,
        options,
        correctOptionIndex: answerIndex,
        rationale,
        difficulty: difficulty ?? "beginner",
      },
      metadata: {
        lessonTitle: context.lessonTitle,
        moduleTitle: context.moduleTitle,
        domain: context.domain,
      },
    };
  },
};

const reflectionTool: RegisteredTool<typeof reflectionInputSchema> = {
  name: "generate_reflection_prompt",
  schema: {
    title: "Reflection activity",
    description:
      "Prompts the learner to connect the lesson back to their experience or goals.",
    input: reflectionInputSchema,
  },
  execute: async (input, context) => ({
    success: true,
    toolName: "generate_reflection_prompt",
    block: {
      type: "reflection",
      prompt: input.prompt,
      guidance: input.guidance,
      expectedDurationMinutes: input.expectedDurationMinutes,
    },
    metadata: {
      lessonTitle: context.lessonTitle,
      moduleTitle: context.moduleTitle,
      domain: context.domain,
      learnerLevel: context.learnerLevel,
    },
  }),
};

export const createMockToolRegistry = (): ToolRegistry => {
  const registry = new InMemoryToolRegistry();
  registry.register(quizTool);
  registry.register(reflectionTool);
  registry.register(generateCodeExerciseTool);
  registry.register(generateFillInBlankTool);
  registry.register(generateMatchingTool);
  registry.register(generateEssayTool);
  return registry;
};

type MockLessonConfig =
  | {
      type: "quiz";
      prompt: string;
      options: string[];
      answerIndex: number;
      rationale?: string;
      difficulty?: "beginner" | "intermediate" | "advanced";
    }
  | {
      type: "reflection";
      prompt: string;
      guidance?: string;
      expectedDurationMinutes?: number;
    };

type MockCourse = {
  domain: string;
  learnerLevel?: string;
  modules: {
    title: string;
    lessons: {
      title: string;
      engagement: MockLessonConfig;
    }[];
  }[];
};

const HARDCODED_MOCK_COURSE: MockCourse = {
  domain: "frontend-development",
  learnerLevel: "intermediate",
  modules: [
    {
      title: "State management with hooks",
      lessons: [
        {
          title: "Using useReducer for complex state",
          engagement: {
            type: "quiz",
            prompt:
              "Which scenario is the best fit for replacing useState with useReducer?",
            options: [
              "Managing a single boolean toggle",
              "Tracking independent values in a form",
              "Handling multiple related state transitions with complex logic",
              "Storing a static configuration object",
            ],
            answerIndex: 2,
            rationale:
              "useReducer shines when state transitions become complex and interdependent.",
            difficulty: "intermediate",
          },
        },
        {
          title: "Memoization trade-offs",
          engagement: {
            type: "reflection",
            prompt:
              "Think about a recent component you optimized. Where did memoization help, and where did it add unnecessary complexity?",
            guidance:
              "List two examples and note whether the optimization was worth the maintenance cost.",
            expectedDurationMinutes: 5,
          },
        },
      ],
    },
  ],
};

export const simulateMockCourseEngagement = async (
  course: MockCourse = HARDCODED_MOCK_COURSE,
  registry: ToolRegistry = createMockToolRegistry(),
): Promise<{
  course: MockCourse;
  engagementBlocks: EngagementBlock[];
  results: ToolExecutionResult[];
}> => {
  const executionResults: ToolExecutionResult[] = [];
  const blocks: EngagementBlock[] = [];

  for (const courseModule of course.modules) {
    for (const lesson of courseModule.lessons) {
      const context = {
        moduleTitle: courseModule.title,
        lessonTitle: lesson.title,
        domain: course.domain,
        learnerLevel: course.learnerLevel,
      };

      const invocations: ToolInvocation[] = [
        lesson.engagement.type === "quiz"
          ? {
              name: "generate_multiple_choice_quiz",
              input: {
                prompt: lesson.engagement.prompt,
                options: lesson.engagement.options,
                answerIndex: lesson.engagement.answerIndex,
                rationale: lesson.engagement.rationale,
                difficulty: lesson.engagement.difficulty,
              },
            }
          : {
              name: "generate_reflection_prompt",
              input: {
                prompt: lesson.engagement.prompt,
                guidance: lesson.engagement.guidance,
                expectedDurationMinutes:
                  lesson.engagement.expectedDurationMinutes,
              },
            },
      ];

      const { blocks: resolvedBlocks, results: lessonResults } =
        await executeEngagementTools({
          invocations,
          registry,
          context,
        });

      executionResults.push(...lessonResults);
      blocks.push(...resolvedBlocks);
    }
  }

  return {
    course,
    engagementBlocks: blocks,
    results: executionResults,
  };
};
