import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  deleteCourseEngagementResponse,
  getCourseVersionForUser,
} from '@/lib/db/operations';

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ versionId: string; blockId: string }> },
) {
  const { versionId, blockId } = await params;

  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json(
      { error: 'courseVersionId is required' },
      { status: 400 },
    );
  }

  if (!blockId || blockId.trim().length === 0) {
    return NextResponse.json(
      { error: 'blockId is required' },
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

  await deleteCourseEngagementResponse({
    userId: user.id,
    courseVersionId: versionId,
    blockId,
  });

  return NextResponse.json({ ok: true });
}
