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
When you need current facts, examples, tools, or resources, call the web_search tool and cite what you discover. Do not invent references—ground the course in real sources. Use inline markdown links: [Brief Description](URL) or (Source: [Name](URL)).

⚠️ CRITICAL OUTPUT FORMAT: Return ONLY valid JSON matching the Course schema (provided below). No markdown fences (\`\`\`json or \`\`\`), no preamble, no commentary before or after the JSON.

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
   - Comprehensive explanations written at their experience level (adapt depth based on their familiarity - see pacing guidance below)
   - Concept foundations: For beginners especially, explain WHAT things are, WHY they matter, and HOW they work before showing code
   - Essential vocabulary: Define key terms when introducing new concepts, especially for beginners
   - Code examples (when relevant) that relate to their interests/goals
   - Step-by-step instructions tailored to their background
   - Context before projects: Before any hands-on exercise, ensure learners understand the concepts, goals, and approach
   - Practical exercises that align with their stated use cases
   - Tips and best practices relevant to their situation
   - Real-world applications they specifically care about
3. Use rich markdown formatting: headings (##, ###), code blocks (\`\`\`), lists, bold/italic, etc.
4. Write in a clear, engaging style that speaks directly to them
5. Keep lessons focused so the entire experience fits inside the approved 30–180 minute window—prioritize what helps them take action quickly

   PACING GUIDANCE - Adapt depth to expertise level:

   Time estimates for different content types:
   - Reading/explanatory content: ~200-250 words per minute of learner time
   - Code examples to study/understand: 2-3x the reading time (learners pause, trace logic, experiment)
   - Hands-on exercises/projects: Estimate actual coding/building time, NOT just word count
     * Small exercise (modify existing code, try one feature): 5-10 minutes
     * Medium project (build a component, write a script): 15-30 minutes
     * Larger project (integrate multiple concepts, mini-app): 30-60 minutes
   - Build in ~10-15% buffer time for breaks, troubleshooting, or going deeper on tricky parts

   CRITICAL - Match explanation depth to their expertise:

   FOR BEGINNERS (new to the topic, limited experience):
   - DO NOT skip foundational concepts or assume prior knowledge
   - Define technical terms and vocabulary the first time you use them
   - Explain the "why" behind concepts before jumping into implementation
   - Before any hands-on exercise or project, provide:
     * Conceptual overview: What is this? Why does it matter?
     * Key vocabulary: Define 3-5 essential terms they'll encounter
     * How it works: Explain the underlying mechanism in plain language
     * Walkthrough: Break projects into smaller steps with explanations between each step
   - Example: A 30-minute coding project for a beginner needs 400-600 words of context/explanation PLUS step-by-step guidance
   - Don't assume they know setup, tools, syntax basics, or development workflows

   FOR INTERMEDIATE (some hands-on experience, understands basics):
   - Provide context for new/unfamiliar concepts, but can move faster through basics they know
   - Focus explanations on how new concepts connect to what they already understand
   - Can include more complex examples with inline comments explaining key points
   - Before projects, briefly explain goals and architecture, then let them implement
   - Example: A 30-minute project needs 250-400 words of context focusing on novel concepts

   FOR ADVANCED (strong experience, comfortable with complexity):
   - Focus on nuances, edge cases, architectural decisions, and advanced patterns
   - Can present projects with high-level requirements and let them design solutions
   - Explanations emphasize trade-offs, alternatives, and best practices
   - Example: A 30-minute project needs 200-300 words highlighting architecture and considerations

   Remember: It's better to provide too much helpful context than to leave beginners confused. The goal is confident learning, not artificial brevity.

6. Personalize everything - use their goals, motivations, and context throughout
7. Let content flow naturally with whatever structure best teaches the material
8. Close the experience with a personalized conclusion that celebrates progress and points to concrete next steps, advanced stretch ideas, or reflection prompts aligned to their goals
9. Return valid JSON matching the Course schema exactly

Course schema:
${courseJsonSchema}

Remember: Every paragraph, every example, every exercise should feel tailored to this specific learner's needs and goals.`;

export { courseJsonSchema };
