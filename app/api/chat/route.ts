import { openai } from '@ai-sdk/openai';
import { streamText, generateText, convertToModelMessages } from 'ai';
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

const webSearchTool = openai.tools.webSearch({
  searchContextSize: 'high',
});

const extractJsonFromText = (raw: string) => {
  const trimmed = raw.trim();

  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return trimmed;
};

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

  // Tool for generating learning plans
  const generatePlanTool = {
    description: 'Generate a hyper-personalized learning plan based on ALL the context gathered from the conversation. This creates truly customized courses unlike generic platforms.',
    inputSchema: z.object({
      fullConversationContext: z.string().describe(`A comprehensive, detailed summary of EVERYTHING discussed with the user. Include:
- What they want to learn (topic, subject, skill)
- WHY they want to learn it (goals, motivation, use case, personal reasons)
- How much time they have available
- Their current experience level and relevant background
- Any specific focus areas, preferences, or constraints they mentioned
- Learning style preferences if discussed
- Real-world applications they're interested in
- Any prior attempts or struggles they mentioned
- Career goals or personal projects related to this learning
- Literally anything else that makes this course PERSONAL to them

Be verbose and detailed - this context is used to create a truly personalized learning experience.`),
      modificationRequest: z.string().nullable().optional().describe('If user wants to modify an existing plan, describe what changes they requested'),
      currentPlan: z.string().nullable().optional().describe('If modifying, include the full text of the current plan being modified'),
    }),
    execute: async ({ fullConversationContext, modificationRequest, currentPlan }: {
      fullConversationContext: string;
      modificationRequest?: string | null;
      currentPlan?: string | null;
    }) => {
      console.log('[generate_plan] Creating personalized plan with context length:', fullConversationContext.length);
      
      const trimmedModificationRequest =
        typeof modificationRequest === 'string' ? modificationRequest.trim() : '';
      const trimmedCurrentPlan =
        typeof currentPlan === 'string' ? currentPlan.trim() : '';

      const modificationSection =
        trimmedModificationRequest.length > 0
          ? `**MODIFICATION REQUEST:**
${trimmedModificationRequest}

${
  trimmedCurrentPlan.length > 0
    ? `**CURRENT PLAN TO MODIFY:**
${trimmedCurrentPlan}

`
    : ''
}Adjust the plan based on the modification request while maintaining personalization.
`
          : '';

      const planningPrompt = `You are an expert learning plan creator specializing in HYPER-PERSONALIZED education.

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

      try {
        console.log('[generate_plan] Calling generateText with web search for personalized plan...');
        const planGeneration = await generateText({
          model: openai('gpt-5'),
          prompt: planningPrompt,
          tools: {
            web_search: webSearchTool,
          },
          providerOptions: {
            openai: {
              reasoning_effort: 'high',
              textVerbosity: 'high',
            },
          },
        });

        const planJsonText = extractJsonFromText(planGeneration.text);
        const parsedPlan = JSON.parse(planJsonText);
        const planObject = LearningPlanSchema.parse(parsedPlan);

        console.log('[generate_plan] Personalized plan generated successfully!');

        const structuredPlan = normalizeLearningPlan(planObject);
        latestStructuredPlan = structuredPlan;
        const planText = formatLearningPlanText(structuredPlan);

        return {
          plan: planText,
          structuredPlan,
          summary: `Created a personalized learning plan tailored to your specific goals and context`,
        };
      } catch (error) {
        console.error('[generate_plan] structured plan failed', error);
        latestStructuredPlan = null;

        const fallbackPrompt = `You are an expert learning plan creator.

**COMPLETE LEARNER CONTEXT:**
${fullConversationContext}

Create a personalized learning plan in plain text with:
- A short overview (goal, total duration, key outcomes) that reflects their specific situation
- 3-5 numbered modules with durations, objectives, and 2-4 timed subtopics
- Deliverables that align with their stated goals
- Optional deep-dive suggestions relevant to their interests

Make it personal and tailored to their unique context. Keep it readable with line breaks.`;

        const fallbackPlan = await generateText({
          model: openai('gpt-5'),
          prompt: fallbackPrompt,
          tools: {
            web_search: webSearchTool,
          },
        });

        return {
          plan: fallbackPlan.text,
          summary: `Created a personalized learning plan tailored to your context`,
        };
      }
    },
  };

  // Tool for generating course content
  const generateCourseTool = {
    description: 'Generate complete, hyper-personalized course content with full lessons tailored exactly to this learner.',
    inputSchema: z.object({
      fullContext: z.string().describe(`Everything about this learner and their approved plan. Include:
- The complete approved learning plan
- All conversation context (their goals, motivations, experience level, interests, constraints)
- Any specific examples or use cases they want to see
- Their learning preferences or style if discussed
- Career goals or projects that motivated this learning
- Literally everything that makes this course PERSONAL

Be comprehensive - this is used to create course content that feels custom-made for them.`),
      planStructure: z
        .string()
        .nullable()
        .optional()
        .describe(
          'JSON string representing the structured learning plan',
        ),
    }),
    execute: async ({
      fullContext,
      planStructure,
    }: {
      fullContext: string;
      planStructure?: string | null;
    }) => {
      console.log('[generate_course] Creating personalized course with context length:', fullContext.length);
      
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

      const coursePrompt = `You are an expert course content creator specializing in HYPER-PERSONALIZED education.

**COMPLETE LEARNER & PLAN CONTEXT:**
${fullContext}

${parsedPlan ? `**PLAN STRUCTURE (JSON):**\n${JSON.stringify(parsedPlan, null, 2)}\n` : ''}

**YOUR MISSION:**
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
5. Make each lesson substantial (10-15 minutes of reading/learning)
6. Personalize everything - use their goals, motivations, and context throughout
7. Let content flow naturally with whatever structure best teaches the material
8. Return valid JSON matching the Course schema exactly

Course schema:
${courseJsonSchema}

Remember: Every paragraph, every example, every exercise should feel tailored to this specific learner's needs and goals.

Return ONLY valid JSON that matches this schema. Do not wrap the response in markdown fences or include commentary before or after the JSON.`;

      try {
        const courseGeneration = await generateText({
          model: openai('gpt-5'),
          prompt: coursePrompt,
          tools: {
            web_search: webSearchTool,
          },
          providerOptions: {
            openai: {
              textVerbosity: 'high', // Maximum detail and comprehensiveness
              reasoning_effort: 'high', // Deep thought for personalization
            },
          },
        });

        const courseJsonText = extractJsonFromText(courseGeneration.text);
        const parsedCourse = JSON.parse(courseJsonText);
        const courseObject = CourseSchema.parse(parsedCourse);

        const structuredCourse = normalizeCourse(courseObject, parsedPlan);
        const courseSummary = summarizeCourseForChat(structuredCourse);

        return {
          course: courseSummary,
          courseStructured: structuredCourse,
          summary: `Generated your personalized course with content tailored to your specific goals and needs`,
        };
      } catch (error) {
        console.error('[generate_course] structured course failed', error);

        const fallbackPrompt = `You are an expert course content creator.

Create a richly detailed learning experience tailored to the following learner context:
${fullContext}

${
  parsedPlan
    ? `Approved plan to reference:\n${JSON.stringify(parsedPlan, null, 2)}`
    : 'No structured plan JSON is available.'
}

Write the full course in engaging markdown with modules and lessons, ensuring each section references the learner’s goals, motivations, and constraints.`;

        const fallbackResult = await generateText({
          model: openai('gpt-5'),
          prompt: fallbackPrompt,
          tools: {
            web_search: webSearchTool,
          },
          providerOptions: {
            openai: {
              textVerbosity: 'high',
              reasoning_effort: 'high',
            },
          },
        });

        return {
          course: fallbackResult.text,
          summary: `Generated fallback course text tailored to your context`,
        };
      }
    },
  };

  // Main agent system prompt
  const systemPrompt = `You are the AI Learning-Plan Assistant creating HYPER-PERSONALIZED courses.

Your mission: Create learning experiences that are uniquely tailored to each individual learner. This is NOT like Udemy or Coursera where everyone gets the same content. This is a custom course built specifically for THIS person.

🧭 Deep Discovery Phase
Don't just ask basic questions - really understand WHO this person is and WHY they're learning:

Essential info:
- What they want to learn (the topic/skill)
- WHY they want to learn it (their deeper motivation, goals, dreams)
- How much time they have available
- Their current experience level and relevant background

Go deeper when natural:
- What will they DO with this knowledge? (real projects, career goals, personal interests)
- Have they tried learning this before? What happened?
- What specifically excites or worries them about this topic?
- Any specific use cases, examples, or applications they care about?
- Learning preferences (hands-on vs theory, fast-paced vs thorough, etc.)

Weave these naturally into conversation - don't interrogate. Skip what's already clear. Keep it friendly and conversational.

If the topic is too broad, help them narrow it: "That's huge! Maybe we focus on [specific part] for this session?"

⚙️ When you have rich context
Summarize what you learned:
"So you want to learn [X] because [their specific motivation]. You have [time] and you're [level]. You specifically want to [their goals/use case]. Sound right?"

When they confirm, call generate_plan with a COMPREHENSIVE fullConversationContext that includes:
- Everything they told you (topic, time, level, motivation, goals, interests, constraints)
- Their real-world use cases and what they'll build/do
- Any preferences, concerns, or background they mentioned
- Why this matters to them personally
- Literally everything that makes this course THEIRS

Be verbose in the context string - the more detail, the more personalized the plan.

📋 After the plan appears
Present it directly (no extra commentary).
Ask: "What do you think? Want to adjust anything?"

For modifications:
- Call generate_plan again with the same fullConversationContext + modificationRequest + currentPlan
- Keep all that rich personalization while making the requested changes

⚡ When they approve
Say: "Perfect! Generating your personalized course now..."

Call generate_course with:
- fullContext: EVERYTHING (the plan, all conversation details, their goals, motivations, use cases, preferences, background - be extremely comprehensive)
- planStructure: The JSON structure if available

The course will be custom-written with examples, exercises, and explanations tailored specifically to their needs.

🗣️ Tone
Friendly, warm, genuinely curious about them.
Like a personal tutor who really wants to understand their goals.
Conversational, not robotic or survey-like.
Show enthusiasm for their learning journey.

Remember: We're creating something PERSONAL - not generic course content. Every detail you gather makes the final course better.`;

  // Main agent using GPT-5-mini
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
        reasoning_effort: 'minimal',
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
