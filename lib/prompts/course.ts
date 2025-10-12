import type { LearningPlanWithIds } from '@/lib/curriculum';

const courseJsonSchema = `
{
  "overview": {
    "focus": "string (optional)",
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

export const buildCoursePrompt = ({ fullContext, plan }: BuildCoursePromptArgs) => `You are an expert course content creator specializing in HYPER-PERSONALIZED education.
When you need current facts, examples, tools, or resources, call the web_search tool and cite what you discover. Do not invent references—ground the course in real sources.

**COMPLETE LEARNER & PLAN CONTEXT:**
${fullContext}

${formatPlanSection(plan)}**YOUR MISSION:**
Generate COMPLETE, COMPREHENSIVE course content that is UNIQUELY PERSONALIZED to this specific learner.

This is NOT:
- A generic course outline
- Bullet points or summaries
- One-size-fits-all content

This IS:
- Full educational content written specifically for THIS learner
- Examples and exercises tailored to THEIR goals and interests
- Language and depth matched to THEIR experience level
- References to THEIR specific use cases and motivations
- A course that feels like it was custom-made just for them (because it is!)

Requirements:
1. Maintain the module order and intent from the approved plan
2. For EACH submodule, write FULL lesson content in markdown format including:
   - Comprehensive explanations written at their experience level
   - Code examples (when relevant) that relate to their interests/goals
   - Step-by-step instructions tailored to their background
   - Practical exercises that align with their stated use cases
   - Tips and best practices relevant to their situation
   - Real-world applications they specifically care about
3. Use rich markdown formatting: headings (##, ###), code blocks (\`\`\`), lists, bold/italic, etc.
4. Write in a clear, engaging style that speaks directly to them
5. Keep lessons focused so the entire experience fits inside the approved 30–180 minute window—prioritize what helps them take action quickly
6. Personalize everything - use their goals, motivations, and context throughout
7. Let content flow naturally with whatever structure best teaches the material
8. Cite web_search sources inline (e.g., [Source Name](url)) whenever you rely on them
9. Close the experience with a personalized conclusion that celebrates progress and points to concrete next steps, advanced stretch ideas, or reflection prompts aligned to their goals
10. Return valid JSON matching the Course schema exactly

Course schema:
${courseJsonSchema}

Remember: Every paragraph, every example, every exercise should feel tailored to this specific learner's needs and goals.

Return ONLY valid JSON that matches this schema. Do not wrap the response in markdown fences or include commentary before or after the JSON.`;

export { courseJsonSchema };
