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
};

export type CourseToolOutput = {
  course: string;
  courseStructured?: CourseWithIds;
  summary?: string;
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

export const isCourseToolOutput = (value: unknown): value is CourseToolOutput =>
  hasStringProperty(value, 'course');

export const hasRenderableAssistantContent = (
  message: UIMessage | null,
): boolean => {
  if (!message || message.role !== 'assistant') return false;
  if (message.parts.length === 0) return false;

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

      return isPlanToolOutput(payload) || isCourseToolOutput(payload);
    }

    return false;
  });
};
