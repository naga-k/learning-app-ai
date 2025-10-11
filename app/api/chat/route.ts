import { openai } from '@ai-sdk/openai';
import { streamText, generateObject, generateText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import {
  CourseSchema,
  LearningPlanSchema,
  formatLearningPlanText,
  normalizeCourse,
  normalizeLearningPlan,
  summarizeCourseForChat,
  type LearningPlanWithIds,
} from '@/lib/curriculum';

export const runtime = 'edge';

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
  "resources": [
    {
      "title": "string",
      "description": "string (optional)",
      "url": "string (optional)",
      "type": "string (optional)"
    }
  ] (optional)
}`.trim();

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  let latestStructuredPlan: LearningPlanWithIds | null = null;

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
      console.log('[generate_plan] Tool called with:', { topic, timeAvailable, experienceLevel });
      
      const planningPrompt = `You are an expert learning plan creator. Generate a high-level, structured learning plan that conforms to the provided JSON schema.

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

JSON schema:
${learningPlanJsonSchema}

Requirements:
1. Respect the overall time constraint and distribute time realistically across modules.
2. Plan modules must align to the user's experience level and motivation.
3. Provide 2-4 subtopics per module with concise descriptions.
4. Include a single deliverable per module that describes what the learner will achieve.
5. Optional deep-dive resources are only included when they add value.`;

      try {
        console.log('[generate_plan] Calling generateObject...');
        const { object: planObject } = await generateObject({
          model: openai('gpt-5'),
          prompt: planningPrompt,
          schema: LearningPlanSchema,
        });
        console.log('[generate_plan] Success!');

        const structuredPlan = normalizeLearningPlan(planObject);
        latestStructuredPlan = structuredPlan;
        const planText = formatLearningPlanText(structuredPlan);

        return {
          plan: planText,
          structuredPlan,
          summary: `Generated a learning plan for ${topic} (${timeAvailable}, ${experienceLevel} level)`,
        };
      } catch (error) {
        console.error('[generate_plan] structured plan failed', error);
        latestStructuredPlan = null;

        const fallbackPrompt = `You are an expert learning plan creator.

Topic: ${topic}
Time Available: ${timeAvailable}
Experience Level: ${experienceLevel}
Motivation: ${motivation}
${specificFocus ? `Specific Focus: ${specificFocus}` : ''}

Create a practical learning plan in plain text with:
- A short overview (goal, total duration, key outcomes)
- 3-5 numbered modules with durations, objectives, and 2-4 timed subtopics
- A deliverable for each module
- Optional deep-dive suggestions if relevant

Keep it readable with line breaks so it can be shown directly to the learner.`;

        const fallbackPlan = await generateText({
          model: openai('gpt-5'),
          prompt: fallbackPrompt,
        });

        return {
          plan: fallbackPlan.text,
          summary: `Generated a fallback learning plan for ${topic} (${timeAvailable}, ${experienceLevel} level)`,
        };
      }
    },
  };

  // Tool for generating course content
  const generateCourseTool = {
    description: 'Generate detailed course content based on an approved learning plan.',
    inputSchema: z.object({
      approvedPlan: z.string().describe('The approved learning plan in plain text'),
      topic: z.string().describe('The main topic'),
      experienceLevel: z.string().describe('User experience level'),
      planStructure: z
        .string()
        .optional()
        .describe(
          'JSON string representing the structured learning plan as returned by generate_plan',
        ),
    }),
    execute: async ({
      approvedPlan,
      topic,
      experienceLevel,
      planStructure,
    }: {
      approvedPlan: string;
      topic: string;
      experienceLevel: string;
      planStructure?: string;
    }) => {
      let parsedPlan: LearningPlanWithIds | null = null;

      if (planStructure) {
        try {
          const json = JSON.parse(planStructure);
          parsedPlan = normalizeLearningPlan(LearningPlanSchema.parse(json));
        } catch {
          parsedPlan = null;
        }
      }

      if (!parsedPlan && latestStructuredPlan) {
        parsedPlan = latestStructuredPlan;
      }

      const coursePrompt = `You are an expert course content creator and educational writer.

APPROVED LEARNING PLAN (text):
${approvedPlan}

${parsedPlan ? `APPROVED LEARNING PLAN (JSON):\n${JSON.stringify(parsedPlan, null, 2)}\n` : ''}

Topic: ${topic}
Experience Level: ${experienceLevel}

Generate COMPLETE, COMPREHENSIVE course content for each lesson. This is NOT an outline - write full educational content as if creating actual course materials.

Requirements:
1. Maintain the module order and intent from the approved plan.
2. For each submodule, write FULL lesson content in markdown format including:
   - Comprehensive explanations and conceptual walkthrough
   - Code examples with detailed explanations (when relevant)
   - Step-by-step instructions or demonstrations
   - Practical exercises with clear instructions
   - Tips, best practices, and common pitfalls
   - Any additional notes or context that aids learning
3. Use markdown formatting: headings (##, ###), code blocks (\`\`\`), lists, bold/italic emphasis, etc.
4. Write in a clear, engaging style appropriate for the stated experience level.
5. Each lesson should be substantial - aim for comprehensive coverage (roughly 10-15 minutes of reading/learning per submodule).
6. Let the content flow naturally - organize it however makes most sense for teaching the topic effectively.
7. The duration field from the plan should guide content depth.
8. Return valid JSON that matches the provided Course schema exactly.

Course schema:
${courseJsonSchema}`;

      const { object: courseObject } = await generateObject({
        model: openai('gpt-5'),
        prompt: coursePrompt,
        schema: CourseSchema,
        providerOptions: {
          openai: {
            textVerbosity: 'high',        // Produces comprehensive, detailed responses
            reasoning_effort: 'high',      // Increases thoughtful content generation
          },
        },
      });

      const structuredCourse = normalizeCourse(courseObject, parsedPlan);
      const courseSummary = summarizeCourseForChat(structuredCourse);

      return {
        course: courseSummary,
        courseStructured: structuredCourse,
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
- Use the generate_course tool with the approved plan. Include the original plan text, topic, experience level, and the Structured JSON returned from the plan tool (pass it as planStructure).
- Once the course is generated, summarize what was created (the UI will handle detailed rendering).
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
    messages: convertToModelMessages(messages),
    tools: {
      generate_plan: generatePlanTool,
      generate_course: generateCourseTool,
    },
    providerOptions: {
      openai: {
        reasoning_effort: 'minimal', // Minimal reasoning for faster, more direct responses
      },
    },
  });

  // Return UIMessage stream for Elements compatibility
  return result.toUIMessageStreamResponse();
}
