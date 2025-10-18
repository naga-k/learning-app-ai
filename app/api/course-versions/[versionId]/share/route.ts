import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  disableCourseVersionShare,
  enableCourseVersionShare,
  getCourseVersionShareStatus,
} from '@/lib/db/operations';

const enableRequestSchema = z.object({
  regenerate: z.boolean().optional(),
});

async function ensureUser(): Promise<{ userId: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null };
  }

  return { userId: user.id };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json({ error: 'courseVersionId is required' }, { status: 400 });
  }

  const { userId } = await ensureUser();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = await getCourseVersionShareStatus({
    courseVersionId: versionId,
    userId,
  });

  if (!status) {
    return NextResponse.json({ error: 'Course version not found' }, { status: 404 });
  }

  return NextResponse.json({
    shareToken: status.shareToken,
    shareEnabledAt: status.shareEnabledAt?.toISOString() ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json({ error: 'courseVersionId is required' }, { status: 400 });
  }

  const { userId } = await ensureUser();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let regenerate = false;
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      const body = await req.json();
      const parsed = enableRequestSchema.parse(body);
      regenerate = Boolean(parsed.regenerate);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request body', details: error }, { status: 400 });
    }
  }

  try {
    const status = await enableCourseVersionShare({
      courseVersionId: versionId,
      userId,
      regenerateToken: regenerate,
    });

    return NextResponse.json({
      shareToken: status.shareToken,
      shareEnabledAt: status.shareEnabledAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[share] failed to enable sharing', error);
    return NextResponse.json({ error: 'Unable to enable sharing' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  if (!versionId || versionId.trim().length === 0) {
    return NextResponse.json({ error: 'courseVersionId is required' }, { status: 400 });
  }

  const { userId } = await ensureUser();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    await disableCourseVersionShare({
      courseVersionId: versionId,
      userId,
    });
  } catch (error) {
    console.error('[share] failed to disable sharing', error);
    return NextResponse.json({ error: 'Unable to disable sharing' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
