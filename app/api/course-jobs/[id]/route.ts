import { NextResponse } from 'next/server';
import type { UIMessage } from 'ai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getChatMessage, getCourseGenerationJob } from '@/lib/db/operations';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  if (!jobId || jobId.trim().length === 0) {
    return NextResponse.json({ error: 'Job id is required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const job = await getCourseGenerationJob({
    jobId,
    userId: user.id,
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  let messageContent: UIMessage | null = null;

  if (job.assistantMessageId) {
    const messageRow = await getChatMessage(job.assistantMessageId);
    if (messageRow && messageRow.sessionId === job.sessionId) {
      messageContent = messageRow.content as UIMessage;
    }
  }

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      summary: job.resultSummary,
      error: job.error,
      assistantMessageId: job.assistantMessageId,
      resultSummary: job.resultSummary,
      resultCourseStructured: job.resultCourseStructured,
      messageContent,
    },
  });
}
