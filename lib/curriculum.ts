import { z } from "zod";
import { EngagementBlockArraySchema } from "./ai/tools/types";

const stripModuleTitlePrefix = (title: string): string => {
  const trimmed = title.trim();
  if (!trimmed) {
    return "";
  }

  const prefixPatterns = [
    /^\s*(?:module|lesson|part|chapter|section)\s+(?:\d+|[ivxlcdm]+)\s*[:\-.)]?\s*/i,
    /^\s*(?:\d+(?:\.\d+)?|[ivxlcdm]+)\s*[:\-.)]\s*/i,
  ];

  for (const pattern of prefixPatterns) {
    if (pattern.test(trimmed)) {
      const withoutPrefix = trimmed.replace(pattern, "").trim();
      if (withoutPrefix.length > 0) {
        return withoutPrefix;
      }
    }
  }

  return trimmed;
};

export const sanitizeModuleTitle = (title: string): string => {
  const stripped = stripModuleTitlePrefix(title);
  return stripped.length > 0 ? stripped : title.trim();
};

const SubtopicSchema = z.object({
  title: z.string().min(1),
  duration: z.string().min(1),
  description: z.string().min(1),
});

const ModuleSchema = z.object({
  title: z.string().min(1),
  duration: z.string().min(1),
  objective: z.string().min(1),
  subtopics: z.array(SubtopicSchema).min(1),
  deliverable: z.string().min(1).optional(),
});

export const LearningPlanSchema = z.object({
  overview: z.object({
    goal: z.string().min(1),
    totalDuration: z.string().min(1),
    outcomes: z.array(z.string().min(1)).min(1).optional(),
  }),
  modules: z.array(ModuleSchema).min(1),
  notes: z.array(z.string().min(1)).optional(),
});

export type LearningPlan = z.infer<typeof LearningPlanSchema>;

const CourseSubmoduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  duration: z.string().optional(),
  content: z.string().min(1).describe(
    "Complete lesson content in markdown format. Should include comprehensive explanations, examples, code snippets, exercises, and any relevant notes. Write as if creating a full textbook chapter or tutorial."
  ),
  summary: z.string().optional().describe(
    "Brief one-sentence summary of the lesson for navigation purposes"
  ),
  engagementBlocks: EngagementBlockArraySchema.optional().describe(
    "Interactive elements for the lesson, such as quizzes or reflections, derived from tool executions or deterministic fallbacks."
  ),
});

const CourseModuleSchema = z.object({
  moduleId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  submodules: z.array(CourseSubmoduleSchema).min(1),
});

const CourseConclusionSchema = z
  .object({
    summary: z
      .string()
      .optional()
      .describe(
        "A brief reflection tying the entire course together and acknowledging learner progress",
      ),
    celebrationMessage: z
      .string()
      .optional()
      .describe("Encouraging note celebrating completion"),
    recommendedNextSteps: z
      .array(z.string().min(1))
      .optional()
      .describe("Concrete follow-up actions tailored to the learner"),
    stretchIdeas: z
      .array(z.string().min(1))
      .optional()
      .describe("Advanced or exploratory ideas for continued growth"),
  })
  .optional();

export const CourseSchema = z.object({
  overview: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      focus: z.string().optional(),
      totalDuration: z.string().optional(),
    })
    .optional(),
  modules: z.array(CourseModuleSchema).min(1),
  resources: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        url: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
  conclusion: CourseConclusionSchema,
});

export type Course = z.infer<typeof CourseSchema>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type LearningPlanModuleWithIds = z.infer<typeof ModuleSchema> & {
  id: string;
  order: number;
  subtopics: (z.infer<typeof SubtopicSchema> & {
    id: string;
    order: number;
  })[];
};

export type LearningPlanWithIds = Omit<LearningPlan, "modules"> & {
  modules: LearningPlanModuleWithIds[];
};

export const normalizeLearningPlan = (
  plan: LearningPlan,
): LearningPlanWithIds => ({
  ...plan,
  modules: plan.modules.map((module, moduleIndex) => {
    const sanitizedTitle = sanitizeModuleTitle(module.title);
    const moduleId = slugify(`${moduleIndex + 1}-${sanitizedTitle}`);
    return {
      ...module,
      title: sanitizedTitle,
      id: moduleId,
      order: moduleIndex + 1,
      subtopics: module.subtopics.map((subtopic, subIndex) => {
        const subtopicId = slugify(
          `${moduleId}-${subIndex + 1}-${subtopic.title}`,
        );
        return {
          ...subtopic,
          id: subtopicId,
          order: subIndex + 1,
        };
      }),
    };
  }),
});

export type CourseSubmoduleWithIds = z.infer<typeof CourseSubmoduleSchema> & {
  id: string;
  order: number;
};

export type CourseModuleWithIds = Omit<
  z.infer<typeof CourseModuleSchema>,
  "submodules"
> & {
  moduleId: string;
  order: number;
  submodules: CourseSubmoduleWithIds[];
};

export type CourseWithIds = Omit<Course, "modules"> & {
  modules: CourseModuleWithIds[];
};

const ensureCourseIds = (
  course: Course,
  plan?: LearningPlanWithIds | null,
): CourseWithIds => {
  const planMap = new Map(
    (plan?.modules ?? []).map((module, moduleIndex) => {
      const moduleKey =
        "id" in module && typeof module.id === "string" && module.id.length > 0
          ? module.id
          : slugify(`${moduleIndex + 1}-${module.title}`);
      const subtopicEntries = module.subtopics.map((subtopic, subIndex) => {
        const subtopicId =
          "id" in subtopic &&
          typeof subtopic.id === "string" &&
          subtopic.id.length > 0
            ? subtopic.id
            : slugify(`${moduleKey}-${subIndex + 1}-${subtopic.title}`);
        return [subtopic.title, subtopicId] as const;
      });
      return [moduleKey, new Map(subtopicEntries)] as const;
    }),
  );

  return {
    ...course,
    modules: course.modules.map((module, moduleIndex) => {
      const sanitizedModuleTitle = sanitizeModuleTitle(module.title);
      const fallbackModuleId = slugify(`${moduleIndex + 1}-${sanitizedModuleTitle}`);
      const moduleId =
        module.moduleId && module.moduleId.length > 0
          ? module.moduleId
          : fallbackModuleId;
      const planSubtopicIds = planMap.get(moduleId);

      return {
        ...module,
        title: sanitizedModuleTitle,
        moduleId,
        order: moduleIndex + 1,
        submodules: module.submodules.map((submodule, subIndex) => {
          const existingId =
            submodule.id && submodule.id.length > 0
              ? submodule.id
              : planSubtopicIds?.get(submodule.title);
          const fallbackId = slugify(
            `${moduleId}-${subIndex + 1}-${submodule.title}`,
          );
          return {
            ...submodule,
            id: existingId ?? fallbackId,
            order: subIndex + 1,
          };
        }),
      };
    }),
  };
};

export const normalizeCourse = (
  course: Course,
  plan?: LearningPlanWithIds | null,
): CourseWithIds => ensureCourseIds(course, plan);

export const formatLearningPlanText = (plan: LearningPlanWithIds): string => {
  const lines: string[] = [];

  lines.push("### Learning Plan");
  lines.push(
    '_Quick roadmap snapshot. Say "Generate the course" whenever you\'re ready for the full lessons._',
  );
  lines.push("");
  lines.push("**Overview**");
  lines.push(`- Goal: ${plan.overview.goal}`);
  lines.push(`- Duration: ${plan.overview.totalDuration}`);
  const outcomes = plan.overview.outcomes ?? [];
  if (outcomes.length === 1) {
    lines.push(`- Outcome: ${outcomes[0]}`);
  } else if (outcomes.length > 1) {
    lines.push(`- Outcomes: ${outcomes.join(", ")}`);
  }

  if (plan.notes && plan.notes.length > 0) {
    lines.push(`- Notes: ${plan.notes.join(" | ")}`);
  }

  lines.push("");

  lines.push("**Modules**");
  plan.modules.forEach((module) => {
    const topics = module.subtopics.map((subtopic) => subtopic.title).filter(Boolean);
    const topTopics = topics.slice(0, 3);
    const remainingTopics = topics.length - topTopics.length;
    const topicSummary =
      topTopics.length > 0
        ? `${topTopics.join(", ")}${remainingTopics > 0 ? `, +${remainingTopics} more` : ""}`
        : null;

    lines.push(
      `${module.order}. **${module.title}** (${module.duration}) — ${module.objective}`,
    );
    if (topicSummary) {
      lines.push(`   - Focus: ${topicSummary}`);
    }
    if (module.deliverable) {
      lines.push(`   - Deliverable: ${module.deliverable}`);
    }
    lines.push("");
  });

  lines.push(
    'Ready for the deep-dive course? Ask me to generate the course whenever you\'re set.',
  );

  return lines.join("\n").trim();
};

export const summarizeCourseForChat = (course: CourseWithIds): string => {
  const moduleLines = course.modules.map(
    (module) =>
      `• ${module.title}: ${module.submodules.length} lesson${
        module.submodules.length === 1 ? "" : "s"
      }`,
  );

  const conclusionLine = course.conclusion
    ? "• Course wrap-up: Personalized reflection, next steps, and stretch ideas"
    : null;

  return [
    "Your course workspace is ready! Here's what's inside:",
    ...moduleLines,
    ...(conclusionLine ? [conclusionLine] : []),
    "Switch to the Course view to explore each module and lesson.",
  ].join("\n");
};
