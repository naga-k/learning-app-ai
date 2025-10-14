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
Whenever you need current facts, examples, or resources, call the web_search tool and cite what you find. Do not guess or rely solely on memory. Use inline markdown links: [Brief Description](URL) or (Source: [Name](URL)).

${modificationSection}

**COMPLETE LEARNER CONTEXT:**
${fullConversationContext}

**YOUR MISSION:**
Design a quick, high-level learning plan that fits inside a 30 to 180 minute sprint. Keep it laser-focused on what helps THIS learner make immediate progress, and include just enough context so each activity has a clear purpose. Tie everything back to their:
- Goals and motivations
- Desired outcomes (career moves, business growth, personal wins)
- Time budget (stay inside the 30-180 minute window)
- Current familiarity and confidence (echo their own words when useful)
- Interests, use cases, constraints, preferred tools, and success criteria

**PURPOSE:** Produce a scannable roadmap (not full lessons). The plan should be easy to skim in under a minute and simple to tweak.

JSON schema:
${learningPlanJsonSchema}

Requirements:
1. Shape the modules and subtopics around what will unlock the learner fastest--choose the count and pacing that makes sense for the request, and err on the side of providing richer guidance rather than leaving gaps.
2. Allocate total time within 30-180 minutes and note the duration for each module and subtopic so the sum stays within the agreed window.
3. When the learner is new, uncertain, or rebuilding fundamentals, surface foundational context before deep dives so they understand the "what" and "why" ahead of any hands-on work.
4. For more experienced learners, remix primers and application as needed, but still connect every activity to their prior experience, active projects, or stated goals.
5. Write objectives and subtopic descriptions in plain language the learner will immediately understand. Each subtopic description should be a short action-plus-purpose phrase (for example, "Contrast supervised vs unsupervised to pick the right dataset").
6. Include deliverables only when they provide useful accountability or proof of progress; omit them otherwise.
7. Add notes only when a quick reminder, tool setup hint, troubleshooting cue, or reflection question will help.
8. Keep it scannable: aim for about 120 words overall (stretch when needed for clarity), and use short, skimmable phrasing rather than dense paragraphs.
9. Make it unmistakably personal--mirror their goals, desired outcomes, constraints, motivations, personal interests, preferred tools, and self-described familiarity instead of generic level labels.
10. If the learner requested a very broad topic, clearly state whether this sprint delivers a focused slice or a high-level overview so expectations stay realistic.

Return ONLY valid JSON that conforms to this schema. Do not include markdown fences or additional commentary.`;
};

export { learningPlanJsonSchema };
