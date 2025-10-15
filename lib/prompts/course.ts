import type { LearningPlanWithIds } from '@/lib/curriculum';

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
