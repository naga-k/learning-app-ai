import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolRegistry,
} from "./registry";
import type { EngagementBlock } from "./types";

export type ToolInvocation = {
  name: string;
  input: unknown;
};

type FallbackBuilder = (context: ToolExecutionContext) => EngagementBlock[];

const normalizeDomain = (domain?: string) =>
  domain?.trim().toLowerCase() ?? "";

const DEFAULT_FALLBACK_BLOCKS: EngagementBlock[] = [
  {
    type: "quiz",
    prompt:
      "Which option best captures the core idea you just studied, in your own words?",
    options: [
      "Summarize the lesson using a personal example",
      "Repeat a definition from the lesson verbatim",
      "List every fact mentioned in the lesson",
      "Skip the summary and move to the next topic",
    ],
    correctOptionIndex: 0,
    rationale:
      "Connecting the concept to your experience signals deeper understanding than rote recall.",
    difficulty: "beginner",
  },
  {
    type: "reflection",
    prompt:
      "Where will this concept show up in your real work this week? Describe the situation and how you plan to apply it.",
    guidance:
      "Aim for 3-4 sentences focusing on the problem, the approach you will take, and how you will know it worked.",
    expectedDurationMinutes: 5,
  },
];

const DOMAIN_FALLBACKS: Record<string, EngagementBlock[]> = {
  "frontend-development": [
    {
      type: "quiz",
      prompt:
        "You are debugging a React component where state updates are being lost. Which strategy from this lesson should you try first?",
      options: [
        "Convert every component to a class component",
        "Use a reducer to centralize state transitions",
        "Replace the component with useMemo",
        "Force rerenders by mutating props",
      ],
      correctOptionIndex: 1,
      rationale:
        "Reducers capture branching state logic and reduce accidental prop drilling, matching the lesson guidance.",
      difficulty: "intermediate",
    },
    {
      type: "reflection",
      prompt:
        "Identify a component in your current project that could benefit from the state approach discussed here. What refactor would you try?",
      guidance:
        "Outline the component, the current pain point, and a high-level checklist for the refactor.",
      expectedDurationMinutes: 7,
    },
  ],
};

const buildFallbackBlocks: FallbackBuilder = (context) => {
  const domainKey = normalizeDomain(context.domain);
  if (domainKey && DOMAIN_FALLBACKS[domainKey]) {
    return DOMAIN_FALLBACKS[domainKey];
  }
  return DEFAULT_FALLBACK_BLOCKS;
};

export const resolveEngagementBlocksFromResults = (
  results: ToolExecutionResult[],
  context: ToolExecutionContext,
  fallbackBuilder: FallbackBuilder = buildFallbackBlocks,
): {
  blocks: EngagementBlock[];
  results: ToolExecutionResult[];
  usedFallback: boolean;
} => {
  const blocks = results
    .filter((result): result is ToolExecutionResult & { success: true } => result.success)
    .map((result) => result.block);

  if (blocks.length > 0) {
    return {
      blocks,
      results,
      usedFallback: false,
    };
  }

  return {
    blocks: fallbackBuilder(context),
    results,
    usedFallback: true,
  };
};

export const executeEngagementTools = async ({
  invocations,
  registry,
  context,
  fallbackBuilder = buildFallbackBlocks,
}: {
  invocations: ToolInvocation[];
  registry: ToolRegistry;
  context: ToolExecutionContext;
  fallbackBuilder?: FallbackBuilder;
}): Promise<{
  blocks: EngagementBlock[];
  results: ToolExecutionResult[];
  usedFallback: boolean;
}> => {
  const results: ToolExecutionResult[] = [];

  for (const invocation of invocations) {
    const result = await registry.execute(
      invocation.name,
      invocation.input,
      context,
    );
    results.push(result);
  }

  return resolveEngagementBlocksFromResults(results, context, fallbackBuilder);
};

