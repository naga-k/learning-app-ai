import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from "ai";
import type { CourseToolOutput } from "@/lib/ai/tool-output";
import { isCourseToolOutput } from "@/lib/ai/tool-output";
import { getChatMessage, updateChatMessageContent } from "@/lib/db/operations";

export async function mergeCourseToolOutputIntoMessage(params: {
  messageId: string;
  updates: Partial<CourseToolOutput>;
}) {
  const { messageId, updates } = params;

  const messageRow = await getChatMessage(messageId);
  if (!messageRow || !messageRow.sessionId) return false;

  const message = messageRow.content as UIMessage;
  if (!message || !Array.isArray(message.parts)) return false;

  let changed = false;

  const updatedParts = message.parts.map((part) => {
    if (!isToolOrDynamicToolUIPart(part)) return part;
    if (getToolOrDynamicToolName(part) !== "generate_course") return part;
    if (part.state !== "output-available") return part;

    const existing =
      (part as { output?: unknown }).output ??
      (part as { result?: unknown }).result;

    changed = true;

    if ("output" in part) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextPart = { ...(part as any) };
      const basePayload = isCourseToolOutput(existing) ? existing : {};
      nextPart.output = { ...basePayload, ...updates } as CourseToolOutput;
      return nextPart;
    }

    if ("result" in part) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextPart = { ...(part as any) };
      const basePayload = isCourseToolOutput(existing) ? existing : {};
      nextPart.result = { ...basePayload, ...updates } as CourseToolOutput;
      return nextPart;
    }

    return part;
  });

  if (!changed) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedMessage = { ...(message as any) };
  updatedMessage.parts = updatedParts;

  await updateChatMessageContent({
    id: messageId,
    sessionId: messageRow.sessionId,
    content: updatedMessage,
  });

  return true;
}
