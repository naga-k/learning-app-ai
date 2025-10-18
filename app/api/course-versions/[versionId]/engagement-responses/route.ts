import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getCourseVersionForUser,
  listCourseEngagementResponses,
  listCourseEngagementBlocks,
  getCourseEngagementBlock,
  upsertCourseEngagementResponse,
} from '@/lib/db/operations';

const UpsertEngagementResponseSchema = z.object({
  blockId: z.string().min(1),
  blockType: z.enum(['quiz', 'reflection']),
  submoduleId: z.string().min(1),
  contentHash: z.string().min(1).optional(),
  response: z.unknown(),
  score: z.number().int().optional(),
  isCorrect: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json(
      { error: 'courseVersionId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const record = await getCourseVersionForUser({
    courseVersionId: versionId,
    userId: user.id,
  });

  if (!record) {
    return NextResponse.json({ error: 'Course version not found' }, { status: 404 });
  }

  const [blocks, responses] = await Promise.all([
    listCourseEngagementBlocks({ courseVersionId: versionId }),
    listCourseEngagementResponses({ courseVersionId: versionId, userId: user.id }),
  ]);

  const blockHash = new Map(
    blocks.map((block) => [block.blockId, block] as const),
  );

  return NextResponse.json({
    courseId: record.course.id,
    courseVersionId: versionId,
    responses: responses.map((response) => {
      const block = blockHash.get(response.blockId);
      const isStale =
        Boolean(block) && block!.contentHash !== response.contentHash;
      return {
        blockId: response.blockId,
        blockType: response.blockType,
        submoduleId: response.submoduleId,
        blockRevision: response.blockRevision,
        contentHash: response.contentHash,
        response: response.response,
        score: response.score,
        isCorrect: response.isCorrect,
        stale: isStale,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
    }),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json(
      { error: 'courseVersionId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const parseResult = UpsertEngagementResponseSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parseResult.data;

  const record = await getCourseVersionForUser({
    courseVersionId: versionId,
    userId: user.id,
  });

  if (!record) {
    return NextResponse.json({ error: 'Course version not found' }, { status: 404 });
  }

  const block = await getCourseEngagementBlock({
    courseVersionId: versionId,
    blockId: payload.blockId,
  });

  if (!block) {
    return NextResponse.json(
      { error: 'Engagement block not found' },
      { status: 404 },
    );
  }

  if (
    payload.contentHash &&
    payload.contentHash.trim().length > 0 &&
    payload.contentHash !== block.contentHash
  ) {
    return NextResponse.json(
      {
        error: 'Engagement block has been updated. Please refresh and try again.',
        code: 'stale-block',
        expectedHash: block.contentHash,
      },
      { status: 409 },
    );
  }

  await upsertCourseEngagementResponse({
    userId: user.id,
    courseId: record.course.id,
    courseVersionId: versionId,
    blockId: block.blockId,
    blockType: block.blockType,
    submoduleId: block.submoduleId,
    blockRevision: block.blockRevision,
    contentHash: block.contentHash,
    response: payload.response,
    score: payload.score ?? null,
    isCorrect: payload.isCorrect ?? null,
  });

  return NextResponse.json({
    ok: true,
    courseId: record.course.id,
    courseVersionId: versionId,
    blockId: block.blockId,
    stale: false,
  });
}
