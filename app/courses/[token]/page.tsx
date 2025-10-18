import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { CourseWithIds } from '@/lib/curriculum';
import {
  getCourseVersionByShareToken,
  listCourseEngagementBlocks,
} from '@/lib/db/operations';
import type { CourseEngagementBlockSummary } from '@/lib/ai/tool-output';
import { SharedCourseWorkspace } from '@/components/course/shared-course-workspace';

type PageParams = {
  token: string;
};

async function loadSharedCourse(token: string) {
  if (!token || token.trim().length === 0) {
    return null;
  }

  const record = await getCourseVersionByShareToken(token);
  if (!record) return null;

  const structured = record.version.structured as CourseWithIds | null;
  if (!structured) return null;

  const blocks = await listCourseEngagementBlocks({
    courseVersionId: record.version.id,
  });

  const engagementSummary: CourseEngagementBlockSummary[] = blocks.map((block) => ({
    blockId: block.blockId,
    blockType: block.blockType,
    blockRevision: block.blockRevision,
    contentHash: block.contentHash,
    submoduleId: block.submoduleId,
  }));

  return {
    course: structured,
    summary: record.version.summary ?? null,
    metadata: {
      courseId: record.course.id,
      courseVersionId: record.version.id,
      engagementBlocks: engagementSummary,
    },
    courseTitle:
      structured.overview?.title && structured.overview.title.trim().length > 0
        ? structured.overview.title.trim()
        : record.course.title,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadSharedCourse(token);
  if (!data) {
    return {
      title: 'Shared course | Course Architect',
    };
  }

  return {
    title: `${data.courseTitle} | Course Architect`,
    description:
      data.summary ??
      data.course.overview?.description ??
      'Explore this shared Course Architect learning path.',
  };
}

export default async function SharedCoursePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { token } = await params;
  const data = await loadSharedCourse(token);

  if (!data) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Suspense fallback={null}>
        <SharedCourseWorkspace
          course={data.course}
          summary={data.summary}
          courseMetadata={data.metadata}
          shareToken={token}
        />
      </Suspense>
    </div>
  );
}
