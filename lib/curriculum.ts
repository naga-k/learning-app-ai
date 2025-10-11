import { z } from "zod";

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
  deliverable: z.string().min(1),
});

const OptionalDeepDiveSchema = z
  .object({
    title: z.string().min(1).default("Optional Deep-Dive"),
    description: z.string().optional(),
    resources: z.array(z.string().min(1)).optional(),
  })
  .optional();

export const LearningPlanSchema = z.object({
  overview: z.object({
    goal: z.string().min(1),
    totalDuration: z.string().min(1),
    outcomes: z.array(z.string().min(1)).min(1),
  }),
  modules: z.array(ModuleSchema).min(1),
  optionalDeepDive: OptionalDeepDiveSchema,
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
    const moduleId = slugify(`${moduleIndex + 1}-${module.title}`);
    return {
      ...module,
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
      const fallbackModuleId = slugify(`${moduleIndex + 1}-${module.title}`);
      const moduleId =
        module.moduleId && module.moduleId.length > 0
          ? module.moduleId
          : fallbackModuleId;
      const planSubtopicIds = planMap.get(moduleId);

      return {
        ...module,
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
  const overview = [
    "🧭 Overview",
    `Goal: ${plan.overview.goal}`,
    `Total Duration: ${plan.overview.totalDuration}`,
    "Outcome: You'll be able to:",
    ...plan.overview.outcomes.map((outcome) => `- ${outcome}`),
    "",
  ];

  const modules = plan.modules.flatMap((module) => {
    const header = `MODULE ${module.order} — ${module.title} (${module.duration})`;
    const objective = `Objective: ${module.objective}`;
    const subtopics = module.subtopics.flatMap((subtopic) => [
      `(${subtopic.duration}) ${subtopic.title}:`,
      `- ${subtopic.description}`,
    ]);
    return [
      header,
      objective,
      ...subtopics,
      `Deliverable: ${module.deliverable}`,
      "",
    ];
  });

  const optional: string[] = [];
  if (plan.optionalDeepDive) {
    optional.push("✅ Optional Deep-Dive");
    optional.push(
      plan.optionalDeepDive.description
        ? plan.optionalDeepDive.description
        : "If you want to go further:",
    );
    const resources = plan.optionalDeepDive.resources ?? [];
    optional.push(...resources.map((item) => `- ${item}`));
    optional.push("");
  }

  return [...overview, ...modules, ...optional].join("\n").trim();
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
