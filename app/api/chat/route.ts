import { openai } from '@ai-sdk/openai';
import { streamText, generateText, convertToModelMessages } from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Tool for generating learning plans (corresponds to Agent-HEzeu in your workflow)
  const generatePlanTool = {
    description: 'Generate a detailed learning plan based on the user\'s topic, time available, and experience level.',
    inputSchema: z.object({
      topic: z.string().describe('The main topic the user wants to learn'),
      timeAvailable: z.string().describe('How much time the user has (e.g., "30 minutes", "2 hours")'),
      experienceLevel: z.string().describe('The user\'s current experience level (beginner, intermediate, advanced)'),
      motivation: z.string().describe('Why the user wants to learn this topic'),
      specificFocus: z.string().optional().describe('Any specific area within the topic to focus on'),
      modificationRequest: z.string().optional().describe('Requested changes to an existing plan'),
      currentPlan: z.string().optional().describe('The current plan to be modified'),
    }),
    execute: async ({ topic, timeAvailable, experienceLevel, motivation, specificFocus, modificationRequest, currentPlan }: {
      topic: string;
      timeAvailable: string;
      experienceLevel: string;
      motivation: string;
      specificFocus?: string;
      modificationRequest?: string;
      currentPlan?: string;
    }) => {
      // Planning agent using GPT-5 with Responses API
      const planningPrompt = `You are an expert learning plan creator. Generate a high-level, structured learning plan.

${modificationRequest ? `
**MODIFICATION REQUEST:** ${modificationRequest}

**CURRENT PLAN TO MODIFY:**
${currentPlan}

Adjust the plan based on the modification request while keeping the overall structure and quality.
` : ''}

**PURPOSE:** This is a learning PLAN (roadmap), not the full course content. Keep it scannable and adjustable. 
Detailed lessons, code examples, and step-by-step exercises will be created later by other agents.

Topic: ${topic}
Time Available: ${timeAvailable}
Experience Level: ${experienceLevel}
Motivation: ${motivation}
${specificFocus ? `Specific Focus: ${specificFocus}` : ''}

Create a practical learning plan that:
1. Breaks down the topic into digestible modules with clear time estimates
2. Fits within the available time (distribute it logically across modules)
3. Matches the user's experience level
4. Provides a clear roadmap of what will be covered (not how it will be taught)
5. Is easy to scan and adjust

**STRUCTURE:**

**START WITH OVERVIEW:**
🧭 Overview
Goal: [Clear one-sentence goal statement]
Total Duration: [X hours/minutes]
Outcome: You'll be able to:
- [Concrete outcome 1]
- [Concrete outcome 2]
- [Concrete outcome 3]

**THEN CREATE MODULES:**
MODULE [NUMBER] — [Module Title] ([Duration])
Objective: [What the learner will grasp - one sentence]

([Time]) [Subtopic 1]:
- [Brief 5-15 word description of what's covered]

([Time]) [Subtopic 2]:
- [Brief description]

([Time]) [Subtopic 3]:
- [Brief description]

Deliverable: [One concrete outcome - what they'll understand or be able to do]

**KEY FORMATTING RULES:**
- Use plain text "MODULE 1 — Title (45 min)" format (not markdown headings)
- Keep objectives to one clear sentence
- List 2-4 subtopics per module with time estimates in parentheses: (10 min), (15 min)
- Each subtopic gets ONE brief bullet point (5-15 words) describing what's covered
- Add one "Deliverable:" per module describing the practical outcome
- Use emojis sparingly: 🧭 for overview, ✅ for optional sections

**END WITH OPTIONAL SECTION (if relevant):**
✅ Optional Deep-Dive (post-course)
If you want to go further:
- [2-3 specific resource suggestions: books, papers, or practice ideas]

**DO NOT:**
- Use ## or ### markdown headings for modules
- Include code blocks, formulas, or detailed examples (save for content generation phase)
- Write detailed step-by-step activities or instructions
- Add multiple bullet points per subtopic
- Make it overly detailed—focus on WHAT will be covered, not HOW`;


      // Using GPT-5 with Responses API (default API in AI SDK 5)
      // Note: gpt-5 is a reasoning model and doesn't support temperature setting
      const planResponse = await generateText({
        model: openai('gpt-5'),
        prompt: planningPrompt,
      });

      return {
        plan: planResponse.text,
        summary: `Generated a learning plan for ${topic} (${timeAvailable}, ${experienceLevel} level)`,
      };
    },
  };

  // Tool for generating course content
  const generateCourseTool = {
    description: 'Generate detailed course content based on an approved learning plan.',
    inputSchema: z.object({
      approvedPlan: z.string().describe('The approved learning plan'),
      topic: z.string().describe('The main topic'),
      experienceLevel: z.string().describe('User experience level'),
    }),
    execute: async ({ approvedPlan, topic, experienceLevel }: {
      approvedPlan: string;
      topic: string;
      experienceLevel: string;
    }) => {
      // Course generator using GPT-5
      const coursePrompt = `You are an expert course content creator.

**APPROVED LEARNING PLAN:**
${approvedPlan}

Topic: ${topic}
Experience Level: ${experienceLevel}

Generate detailed course content for this plan. For now, create a structured outline with:

For each MODULE in the plan:
- Expand each subtopic with key concepts to cover
- Suggest 1-2 concrete examples or exercises per subtopic
- Keep it structured and ready for future content expansion

Format as:
**MODULE X — [Title]**

**Subtopic 1: [Name]**
  Key concepts: [list]
  Example/Exercise: [brief description]

**Subtopic 2: [Name]**
  Key concepts: [list]
  Example/Exercise: [brief description]

(This is a dummy implementation - full content generation will be added later)`;

      const courseResponse = await generateText({
        model: openai('gpt-5'),
        prompt: coursePrompt,
      });

      return {
        course: courseResponse.text,
        summary: `Generated course structure for ${topic}`,
      };
    },
  };

  // Main agent system prompt (corresponds to Agent-HEyRx in your workflow)
  const systemPrompt = `You are the AI Learning-Plan Assistant.
If the user just greets you or says something vague ("hi", "hello", "what's up"), greet them back briefly and ask what they'd like to learn.

🧭 Conversation flow
Figure out what the user wants to learn and why.
Search the internet whenever necessary to make sure you are grounded, do not show the references unless the user asks or it is explicitly relevant to the conversation.
Understand how much time they have (roughly 30 minutes – 3 hours).
Ask about their current familiarity or experience level.
You don't have to ask these as rigid survey questions — weave them naturally into the chat.
If they already gave some information, skip those parts and only ask what's missing.
It's fine to ask more than one thing at once if it feels natural in context.
Keep the chat relaxed, concise, and focused on shaping a short, realistic learning goal.

🧩 When content seems too large
If what they want to learn is too big for a short course, suggest narrowing it down:
"That's a big topic — maybe we can focus on a specific part for this short session?"
Offer simple adjustments instead of rejecting the idea outright.

⚙️ When ready
When you're confident you understand:
the topic,
the motivation or goal,
their available time, and
their familiarity level,
summarize what you heard and confirm with the user:
"So you'd like to learn X to achieve Y, and you've got about Z minutes. Sound right?"
If they agree, use the generate_plan tool to create their learning plan.
Do not write the plan yourself — let the tool handle it.

📋 After showing the plan
When the plan appears:
When you use the generate_plan tool, output its result directly to the user without any additional commentary or summary. Do not generate a separate message after the tool runs.
Ask the user if they'd like to change or refine anything.
If they ask for edits (shorter, longer, add/remove topics, etc.):
  - Gather what they want to modify
  - Call generate_plan again with the original parameters AND the modification request
  - Include the current plan so it can be adjusted (not recreated from scratch)
Repeat this small adjustment loop until the user is happy with the plan.

⚡ When plan is approved
When the user approves the plan (says "looks good", "approve", "let's go", "ready", "start the course", etc.):
- Confirm: "Great! Generating your course content now..."
- Use the generate_course tool with the approved plan
- Output the course structure directly to the user
- Ask if they'd like any adjustments to the course content

🗣️ Tone & style
Friendly, direct, and short-winded.
Sounds like a smart tutor helping design a mini-course.
Avoid over-formal, survey-like language.
Use plain sentences and conversational flow.`;

  // Main agent using GPT-5-mini with Responses API
  const result = streamText({
    model: openai('gpt-5-mini'),
    system: systemPrompt,
    messages: convertToModelMessages(messages), // Use the new function name
    tools: {
      generate_plan: generatePlanTool,
      generate_course: generateCourseTool,
    },
  });

  // Return UIMessage stream for Elements compatibility
  return result.toUIMessageStreamResponse();
}
