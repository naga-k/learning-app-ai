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
    }),
    execute: async ({ topic, timeAvailable, experienceLevel, motivation, specificFocus }: {
      topic: string;
      timeAvailable: string;
      experienceLevel: string;
      motivation: string;
      specificFocus?: string;
    }) => {
      // Planning agent using GPT-5 with Responses API
      const planningPrompt = `You are an expert learning plan creator. Generate a detailed, structured learning plan in **Markdown format**.

Topic: ${topic}
Time Available: ${timeAvailable}
Experience Level: ${experienceLevel}
Motivation: ${motivation}
${specificFocus ? `Specific Focus: ${specificFocus}` : ''}

Create a practical learning plan that:
1. Breaks down the topic into digestible sections
2. Fits within the available time
3. Matches the user's experience level
4. Includes specific activities or resources for each section
5. Has clear milestones and checkpoints

**IMPORTANT:** Format the plan using proper Markdown syntax:
- Use ## for main section headings
- Use ### for subsection headings
- Use **bold** for emphasis
- Use bullet points (-) for lists
- Use numbered lists (1., 2., 3.) for steps
- Use \`code\` for technical terms or commands
- Add time estimates in each section like: **⏱️ Time: 30 minutes**
- Use > blockquotes for important notes or tips
- Add emojis where appropriate (📚, 🎯, ✅, 💡, etc.) to make it visually engaging

Example structure:
## 🎯 Learning Plan: [Topic Name]

### 📋 Overview
Brief introduction...

### 📚 Section 1: [Title]
**⏱️ Time: X minutes**
- Bullet point 1
- Bullet point 2

> 💡 **Tip:** Helpful advice here

### ✅ Milestones
- [ ] Checkpoint 1
- [ ] Checkpoint 2`;


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
If they ask for edits (shorter, longer, add/remove topics, etc.), gather the updated requirements and use the tool again.
Repeat this small adjustment loop until the user is happy with the plan.

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
    },
  });

  // Return UIMessage stream for Elements compatibility
  return result.toUIMessageStreamResponse();
}
