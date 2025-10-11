const learningPlanJsonSchema = `
{
  "overview": {
    "goal": "string",
    "totalDuration": "string",
    "outcomes": ["string", "..."]
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
      "deliverable": "string"
    }
  ],
  "optionalDeepDive": {
    "title": "string",
    "description": "string (optional)",
    "resources": ["string", "..."] (optional)
  } (optional)
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

${modificationSection}

**COMPLETE LEARNER CONTEXT:**
${fullConversationContext}

**YOUR MISSION:**
Create a learning plan that is UNIQUELY tailored to THIS specific learner. This is not a generic course - every module, every subtopic, every example should reflect their specific:
- Goals and motivations
- Time constraints
- Experience level
- Interests and preferences
- Real-world applications they care about

**PURPOSE:** This is a learning PLAN (roadmap), not the full course content. Keep it scannable and adjustable. 
Detailed lessons, code examples, and step-by-step exercises will be created later.

JSON schema:
${learningPlanJsonSchema}

Requirements:
1. Distribute time realistically based on their availability
2. Align depth and pace to their experience level
3. Frame objectives and deliverables around their stated goals
4. Include 2-4 subtopics per module that address their specific interests
5. Reference their real-world use cases when describing what they'll learn
6. Make it feel personal - like this plan was crafted just for them (because it was!)

Return ONLY valid JSON that conforms to this schema. Do not include markdown fences or additional commentary.`;
};

export const buildLearningPlanFallbackPrompt = (
  fullConversationContext: string,
) => `You are an expert learning plan creator.

**COMPLETE LEARNER CONTEXT:**
${fullConversationContext}

Create a personalized learning plan in plain text with:
- A short overview (goal, total duration, key outcomes) that reflects their specific situation
- 3-5 numbered modules with durations, objectives, and 2-4 timed subtopics
- Deliverables that align with their stated goals
- Optional deep-dive suggestions relevant to their interests

Make it personal and tailored to their unique context. Keep it readable with line breaks.`;

export { learningPlanJsonSchema };
