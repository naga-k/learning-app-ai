import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getCourseVersionForUser,
  listCourseEngagementBlocks,
} from '@/lib/db/operations';

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

  const blocks = await listCourseEngagementBlocks({
    courseVersionId: versionId,
  });

  return NextResponse.json({
    courseId: record.course.id,
    courseVersionId: versionId,
    blocks: blocks.map((block) => ({
      id: block.blockId,
      type: block.blockType,
      order: block.blockOrder,
      revision: block.blockRevision,
      contentHash: block.contentHash,
      submoduleId: block.submoduleId,
      payload: block.payload,
    })),
  });
}
