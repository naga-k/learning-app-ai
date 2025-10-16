import type {
  LearningPlanModuleWithIds,
  LearningPlanWithIds,
} from '@/lib/curriculum';

const courseJsonSchema = `
{
  "overview": {
    "title": "string (optional, 3-6 words capturing the course title)",
    "description": "string (optional, short 1-2 sentence overview)",
    "totalDuration": "string (optional)"
  },
  "modules": [
    {
      "moduleId": "string (reuse plan slug when available)",
      "title": "string",
      "summary": "string (optional)",
      "submodules": [
        {
          "id": "string (reuse plan subtopic slug when available)",
          "title": "string",
          "duration": "string (optional)",
          "content": "string (full lesson content in markdown format)",
          "summary": "string (optional, brief one-sentence summary)"
        }
      ]
    }
  ],
  "conclusion": {
    "summary": "string (optional)",
    "celebrationMessage": "string (optional)",
    "recommendedNextSteps": ["string", "..."] (optional),
    "stretchIdeas": ["string", "..."] (optional)
  } (optional),
  "resources": [
    {
      "title": "string",
      "description": "string (optional)",
      "url": "string (optional)",
      "type": "string (optional)"
    }
  ] (optional)
}`.trim();

type BuildCoursePromptArgs = {
  fullContext: string;
  plan?: LearningPlanWithIds | null;
};

const formatPlanSection = (plan?: LearningPlanWithIds | null) => {
  if (!plan) return '';
  return `**PLAN STRUCTURE (JSON):**
${JSON.stringify(plan, null, 2)}

`;
};

export const buildCoursePrompt = ({ fullContext, plan }: BuildCoursePromptArgs) => `You are an expert course author crafting a one-of-a-kind learning experience for a specific person.

When the web_search tool is available, use it for current facts, examples, or recommendations and cite sources with inline markdown links like [Brief Description](URL). Do not invent references. If search is unavailable, stay within reliable knowledge without mentioning the limitation.

Return ONLY valid JSON that matches the Course schema at the end of this prompt. No fences, no commentary, no pre/post text.

**Learner & conversation context**
${fullContext}

${formatPlanSection(plan)}**Your mission**
Produce full course content that mirrors the approved plan and feels unmistakably personal to this learner. Every module and lesson must align with the plan’s structure, intent, pacing, and deliverables—no new modules, no omissions.

**Non‑negotiables**
- Personalize relentlessly. Reflect their goals, motivations, constraints, tools, preferred themes, and phrasing. Tie explanations and examples to their actual projects and stakes.
- Provide generous background and conceptual framing before asking them to build anything. Define key terms, explain the “why,” and surface context that lets them succeed even if they are skimming.
- Keep project work, practice, and reflection, but anchor each activity in clear step-by-step walkthroughs, guidance, and troubleshooting tips. Activities are supported by instruction—not a replacement for it.
- Match tone and depth to their experience. Beginners need patient scaffolding; experienced learners need nuance, trade-offs, and comparisons—all grounded in their world.
- Stay within the time budget implied by the plan. If time feels tight, trim optional flourishes before trimming essential explanation.
- Close with a tailored conclusion that celebrates progress and points to next steps aligned with their aspirations.

**Module craft**
- Preserve module order and submodule intent from the plan. Each submodule should be a complete markdown lesson starting with \`## {Submodule Title}\`.
- Blend formats (headings, lists, tables, callouts, code fences, case snippets) to keep lessons skimmable and lively.
- Relate each lesson back to what the learner said they need, how they will use it, and what success looks like for them.

**Pacing cues**
- Conceptual explanation: ~200–250 words per learner minute.
- Code or technical walkthroughs: assume learners pause and explore; budget extra narrative accordingly.
- Hands-on work: estimate actual effort (5–10 minutes for small tweaks, 15–30 for medium builds, 30–60 for deeper integrations).
- Include a modest buffer (10–15%) for troubleshooting or reflection when relevant.

Course schema:
${courseJsonSchema}

Final reminder: output ONLY valid JSON matching the schema, grounded in the conversation, and unmistakably tailored to this learner.`;

export { courseJsonSchema };

const courseOverviewJsonSchema = `
{
  "title": "string (3-6 words capturing the course theme)",
  "description": "string (1-2 sentence promise of the experience)",
  "focus": "string (optional, core emphasis learners should keep in mind)",
  "resources": [
    {
      "title": "string",
      "description": "string (optional)",
      "url": "string (optional)",
      "type": "string (optional)"
    }
  ] (optional)
}`.trim();

type BuildCourseOverviewPromptArgs = {
  fullContext: string;
  plan: LearningPlanWithIds | null;
};

const formatPlanOutline = (plan: LearningPlanWithIds | null) => {
  if (!plan) return 'No approved plan was provided.';
  const modules = plan.modules
    .map(
      (module) =>
        `- ${module.title} (${module.duration}) → ${module.objective}\n${module.subtopics
          .map((subtopic) => `    • ${subtopic.title} (${subtopic.duration}) — ${subtopic.description}`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `Total time: ${plan.overview.totalDuration}
Goal: ${plan.overview.goal}
Modules:
${modules}`;
};

export const buildCourseOverviewPrompt = ({
  fullContext,
  plan,
}: BuildCourseOverviewPromptArgs) => `You are preparing the opening snapshot for a personalized course.

Return ONLY valid JSON that matches this schema:
${courseOverviewJsonSchema}

Ground the overview in the approved learning plan and the learner's personal context. Lean on the plan for pacing, but rewrite in fresh language that will excite the learner.

Learner & plan context:
${fullContext}

Plan outline:
${formatPlanOutline(plan)}
`;

const courseSubmoduleJsonSchema = `
{
  "content": "string (complete markdown lesson, starting with ## {Submodule Title})",
  "summary": "string (optional 1 sentence navigation blurb)",
  "recommendedResources": [
    {
      "title": "string",
      "description": "string (optional)",
      "url": "string (optional)",
      "type": "string (optional)"
    }
  ] (optional)
}`.trim();

type BuildCourseSubmodulePromptArgs = {
  fullContext: string;
  plan: LearningPlanWithIds;
  module: LearningPlanModuleWithIds;
  subtopic: LearningPlanModuleWithIds['subtopics'][number];
  completedLessonsSummary: string;
};

const buildModuleContext = (
  module: LearningPlanModuleWithIds,
  subtopic: LearningPlanModuleWithIds['subtopics'][number],
) => `Module: ${module.title}
Module objective: ${module.objective}
Module duration: ${module.duration}
Current lesson: ${subtopic.title}
Lesson duration: ${subtopic.duration}
Lesson focus: ${subtopic.description}`;

export const buildCourseSubmodulePrompt = ({
  fullContext,
  plan,
  module,
  subtopic,
  completedLessonsSummary,
}: BuildCourseSubmodulePromptArgs) => `You are writing a single lesson inside a hyper-personalized course for one learner.

Return ONLY valid JSON matching this schema:
${courseSubmoduleJsonSchema}

Writing rules:
- Write directly to the learner using their language, motivations, and constraints.
- Start the lesson with "## ${subtopic.title}".
- Blend explanations, examples, bullets, callouts, and checkpoints so the learner can skim or deep dive.
- Keep the effort within ${subtopic.duration}, allowing time for practice and reflection.
- Reference prior completed lessons when helpful: ${completedLessonsSummary || 'No lessons completed yet—this is the first.'}
- Do NOT invent new modules or lessons. Stay aligned with the plan structure.

Learner & conversation context:
${fullContext}

Plan overview (for reference):
${formatPlanOutline(plan)}

Focus of this lesson:
${buildModuleContext(module, subtopic)}
`;

const courseConclusionJsonSchema = `
{
  "summary": "string (optional recap tying progress to learner goals)",
  "celebrationMessage": "string (optional encouraging message)",
  "recommendedNextSteps": ["string", "..."] (optional),
  "stretchIdeas": ["string", "..."] (optional)
}`.trim();

type BuildCourseConclusionPromptArgs = {
  fullContext: string;
  plan: LearningPlanWithIds | null;
  courseHighlights: string;
};

export const buildCourseConclusionPrompt = ({
  fullContext,
  plan,
  courseHighlights,
}: BuildCourseConclusionPromptArgs) => `You are wrapping up a personalized course for one learner.

Return ONLY valid JSON matching this schema:
${courseConclusionJsonSchema}

Make the tone celebratory but grounded in what the learner actually achieved. Tie recommendations to their original motivations and constraints.

Learner & conversation context:
${fullContext}

Plan overview:
${formatPlanOutline(plan)}

Course highlights so far:
${courseHighlights}
`;
