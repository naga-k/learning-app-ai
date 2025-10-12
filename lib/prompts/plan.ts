const learningPlanJsonSchema = `
{
  "overview": {
    "goal": "string",
    "totalDuration": "string",
    "outcomes": ["string", "..."] (optional)
  },
  "modules": [
    {
      "title": "string",
      "duration": "string",
      "objective": "string",
      "subtopics": [
        {
          "title": "string",
          "duration": "string",
          "description": "string"
        }
      ],
      "deliverable": "string (optional)"
    }
  ],
  "notes": ["string", "..."] (optional)
}`.trim();

type BuildLearningPlanPromptArgs = {
  fullConversationContext: string;
  modificationRequest?: string | null;
  currentPlan?: string | null;
};

const buildModificationSection = (
  modificationRequest?: string | null,
  currentPlan?: string | null,
) => {
  const trimmedModification = (modificationRequest ?? '').trim();
  const trimmedPlan = (currentPlan ?? '').trim();

  if (!trimmedModification) return '';

  const planSection =
    trimmedPlan.length > 0
      ? `**CURRENT PLAN TO MODIFY:**
${trimmedPlan}

`
      : '';

  return `**MODIFICATION REQUEST:**
${trimmedModification}

${planSection}Adjust the plan based on the modification request while maintaining personalization.
`;
};

export const buildLearningPlanPrompt = ({
  fullConversationContext,
  modificationRequest,
  currentPlan,
}: BuildLearningPlanPromptArgs) => {
  const modificationSection = buildModificationSection(
    modificationRequest,
    currentPlan,
  );

  return `You are an expert learning plan creator specializing in HYPER-PERSONALIZED education.
Whenever you need current facts, examples, or resources, call the web_search tool and cite what you find. Do not guess or rely solely on memory.

${modificationSection}

**COMPLETE LEARNER CONTEXT:**
${fullConversationContext}

**YOUR MISSION:**
Design a quick, high-level learning plan that fits inside a 30 to 180 minute sprint. Keep it laser-focused on what helps THIS learner make immediate progress. Tie everything back to their:
- Goals and motivations
- Time budget (stick to the 30–180 minute window)
- Current level and confidence
- Interests, use cases, and constraints

**PURPOSE:** Produce a scannable roadmap (not full lessons). The plan should be easy to skim in under a minute and simple to tweak.

JSON schema:
${learningPlanJsonSchema}

Requirements:
1. Keep it concise: 1–2 modules with 1–2 subtopics each is ideal (never exceed 3 modules total).
2. Allocate total time within 30–180 minutes and note the duration for each module/subtopic.
3. Write objectives in plain language the learner will immediately understand.
4. Include deliverables only if they clearly help the learner (otherwise omit them).
    5. When you reference resources, cite the web_search results you used.
    6. Add a note only if there’s a quick tip or reminder the learner should keep in mind.
    7. Make it obviously personal—mention the learner’s goals, motivations, and constraints.

Return ONLY valid JSON that conforms to this schema. Do not include markdown fences or additional commentary.`;
};

export { learningPlanJsonSchema };
