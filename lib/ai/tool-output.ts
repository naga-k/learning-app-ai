import { isToolOrDynamicToolUIPart, type UIMessage } from 'ai';
import type {
  CourseWithIds,
  LearningPlanWithIds,
} from '@/lib/curriculum';

export type PlanToolOutput = {
  plan: string;
  structuredPlan?: LearningPlanWithIds;
  summary?: string;
  startedAt?: number;
  durationMs?: number;
  ctaSuggestions?: {
    label: string;
    message: string;
  }[];
};

export type CourseModuleProgress = {
  overviewReady?: boolean;
  conclusionReady?: boolean;
  totalSubmodules?: number;
  readySubmodules?: number;
  modules?: {
    moduleId: string;
    readyCount: number;
    totalCount: number;
    submodules: {
      id: string;
      ready: boolean;
    }[];
  }[];
};

export type CourseEngagementBlockSummary = {
  blockId: string;
  blockType: string;
  blockRevision: number;
  contentHash: string;
  submoduleId: string;
};

export type CourseToolOutput = {
  course?: string;
  courseStructured?: CourseWithIds;
  jobId?: string;
  status?: "queued" | "processing" | "completed" | "failed";
  summary?: string;
  startedAt?: number;
  durationMs?: number;
  moduleProgress?: CourseModuleProgress;
  courseId?: string;
  courseVersionId?: string;
  engagementBlocks?: CourseEngagementBlockSummary[];
};

export type ToolErrorOutput = {
  errorMessage: string;
  startedAt?: number;
  durationMs?: number;
};

const hasStringProperty = (value: unknown, key: string): boolean =>
  Boolean(
    value &&
      typeof value === 'object' &&
      key in value &&
      typeof (value as Record<string, unknown>)[key] === 'string',
  );

export const isPlanToolOutput = (value: unknown): value is PlanToolOutput =>
  hasStringProperty(value, 'plan');

export const isCourseToolOutput = (value: unknown): value is CourseToolOutput => {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;

  if (typeof record.course === 'string' && record.course.trim().length > 0) {
    return true;
  }

  if (typeof record.jobId === 'string' && record.jobId.trim().length > 0) {
    return true;
  }

  if (typeof record.status === 'string' && record.status.trim().length > 0) {
    return true;
  }

  if (record.courseStructured) {
    return true;
  }

  return false;
};

export const isToolErrorOutput = (value: unknown): value is ToolErrorOutput =>
  hasStringProperty(value, 'errorMessage');

export const hasRenderableAssistantContent = (
  message: UIMessage | null,
): boolean => {
  if (!message || message.role !== 'assistant') return false;
  if (!Array.isArray(message.parts) || message.parts.length === 0) return false;

  return message.parts.some((part) => {
    if (part.type === 'text') {
      return Boolean(part.text && part.text.trim().length > 0);
    }

    if (!isToolOrDynamicToolUIPart(part)) return false;

    if (
      part.state === 'input-streaming' ||
      part.state === 'input-available' ||
      part.state === 'output-error'
    ) {
      return true;
    }

    if (part.state === 'output-available') {
      if (part.preliminary) return true;

      const payload =
        (part as { output?: unknown }).output ??
        (part as { result?: unknown }).result;

      if (!payload) return false;

      return (
        isPlanToolOutput(payload) ||
        isCourseToolOutput(payload) ||
        isToolErrorOutput(payload)
      );
    }

    return false;
  });
};
