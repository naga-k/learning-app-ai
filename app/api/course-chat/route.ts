import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { activeAIProviderName, getModel } from '@/lib/ai/provider';

const requestSchema = z.object({
  question: z.string().min(1).max(2000),
  moduleTitle: z.string().min(1).max(200),
  moduleSummary: z.string().optional(),
  lessonTitle: z.string().min(1).max(200),
  lessonSummary: z.string().optional(),
  lessonContent: z.string().min(1),
  selection: z.string().optional(),
});

const OPENAI_PROVIDER_OPTIONS = {
  openai: {
    reasoningEffort: 'low',
    textVerbosity: 'low',
  },
} as const;

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

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

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
  } = parsedBody;

  const lessonContext = buildLessonContext(lessonContent, selection);
  const prompt = [
    'You are a friendly teaching assistant helping a learner understand a specific lesson in a personalized course.',
    'Always ground your answer in the provided module and lesson content.',
    'If the learner asks something that is not covered, state that it is not in the lesson and suggest how they could explore it further.',
    '',
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
    '',
    'Respond with a concise explanation (2-3 short paragraphs) and include an optional quick tip or next step if helpful.',
  ]
    .filter(Boolean)
    .join('\n');

  const providerOptions =
    activeAIProviderName === 'openai' ? OPENAI_PROVIDER_OPTIONS : undefined;

  try {
    const result = await generateText({
      model: getModel('chat'),
      prompt,
      providerOptions,
    });

    return NextResponse.json({
      answer: result.text.trim(),
    });
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
