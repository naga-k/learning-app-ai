import { NextResponse } from 'next/server';
import { z } from 'zod';
import { streamText } from 'ai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCourseVersionByShareToken } from '@/lib/db/operations';
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  supportsOpenAIWebSearch,
} from '@/lib/ai/provider';

const requestSchema = z.object({
  question: z.string().min(1).max(2000),
  moduleTitle: z.string().min(1).max(200),
  moduleSummary: z.string().optional(),
  lessonTitle: z.string().min(1).max(200),
  lessonSummary: z.string().optional(),
  lessonContent: z.string().min(1),
  selection: z.string().optional(),
  shareToken: z.string().min(1).optional(),
});

const OPENAI_PROVIDER_OPTIONS = {
  openai: {
    reasoningEffort: 'low',
    textVerbosity: 'low',
  },
} as const;

const webSearchTool = supportsOpenAIWebSearch
  ? activeAIProvider.tools.webSearch({
      searchContextSize: 'high',
    })
  : undefined;
const webSearchTools = webSearchTool ? { web_search: webSearchTool } : undefined;

function trimContent(content: string, maxLength = 4000): string {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}\n...[content truncated for brevity]`;
}

function buildSelectionContext(lessonContent: string, selection: string) {
  const normalizedSelection = selection.trim();
  if (!normalizedSelection) return null;

  const index = lessonContent.indexOf(normalizedSelection);
  if (index === -1) {
    return `Highlighted passage:\n"${normalizedSelection}"`;
  }

  const windowSize = 1200;
  const start = Math.max(0, index - windowSize);
  const end = Math.min(lessonContent.length, index + normalizedSelection.length + windowSize);
  const surrounding = lessonContent.slice(start, end);

  return [
    'Relevant passage from the lesson:',
    trimContent(surrounding, 2400),
    '',
    `Highlighted focus:\n"${normalizedSelection}"`,
  ].join('\n');
}

function buildLessonContext(lessonContent: string, selection?: string) {
  if (selection && selection.trim().length > 0) {
    const selectionContext = buildSelectionContext(lessonContent, selection);
    if (selectionContext) return selectionContext;
  }

  return [
    'Lesson content:',
    trimContent(lessonContent, 4000),
  ].join('\n');
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let parsedBody;
  try {
    const json = await req.json();
    parsedBody = requestSchema.parse(json);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body', details: error }, { status: 400 });
  }

  const {
    question,
    moduleTitle,
    moduleSummary,
    lessonTitle,
    lessonSummary,
    lessonContent,
    selection,
    shareToken,
  } = parsedBody;

  if (!user) {
    if (!shareToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const shareRecord = await getCourseVersionByShareToken(shareToken);
    if (!shareRecord) {
      return NextResponse.json({ error: 'Invalid or expired share link' }, { status: 403 });
    }
  }

  const lessonContext = buildLessonContext(lessonContent, selection);
  const systemPrompt = [
    'You are a friendly teaching assistant helping a learner understand a specific lesson in a personalized course.',
    'Prioritize grounding your answer in the provided module and lesson content.',
    'If the learner asks about something related to but not directly covered in the lesson, use web search to find relevant, up-to-date information to supplement and expand on the lesson. Clearly distinguish between what is in the lesson and what you found through web search.',
    'If the learner asks about something completely out of context from the lesson, clearly state it is not covered in the current material, but you can offer supplementary information from web search if it would be helpful.',
    'Respond with a concise explanation (2-3 short paragraphs) and include an optional quick tip or next step when it adds value.',
  ].join(' ');

  const userPrompt = [
    `Module: ${moduleTitle}`,
    moduleSummary ? `Module summary: ${moduleSummary}` : '',
    '',
    `Lesson: ${lessonTitle}`,
    lessonSummary ? `Lesson summary: ${lessonSummary}` : '',
    '',
    lessonContext,
    '',
    'Learner question:',
    question,
  ]
    .filter(Boolean)
    .join('\n');

  const providerOptions =
    activeAIProviderName === 'openai' ? OPENAI_PROVIDER_OPTIONS : undefined;

  try {
    const result = streamText({
      model: getModel('chat'),
      system: systemPrompt,
      prompt: userPrompt,
      tools: webSearchTools,
      providerOptions,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[course-chat] failed to generate answer', error);
    return NextResponse.json(
      {
        error: 'Unable to answer question at this time. Please try again.',
      },
      { status: 500 },
    );
  }
}
