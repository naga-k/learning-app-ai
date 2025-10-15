'use server';

import { generateText } from 'ai';
import type { UIMessage } from 'ai';
import { getModel } from '@/lib/ai/provider';
import { getChatSession, updateChatSessionTitle } from '@/lib/db/operations';

type GenerateChatTitleParams = {
  sessionId: string;
  userId: string;
  messages: UIMessage[];
  force?: boolean;
};

const TITLE_MAX_LENGTH = 80;
const MAX_CONTENT_CHARS = 700;
const MAX_MESSAGES_FOR_CONTEXT = 8;
const MIN_USER_TEXT_LENGTH = 10;
const UNTITLED_LABEL = 'Untitled session';

type SupportedTextPart = Extract<
  UIMessage['parts'][number],
  { type: 'text' | 'reasoning'; text: string }
>;

const isSupportedTextPart = (part: UIMessage['parts'][number]): part is SupportedTextPart =>
  Boolean(part && (part.type === 'text' || part.type === 'reasoning') && typeof part.text === 'string');

const extractPlainText = (message: UIMessage): string | null => {
  if (!Array.isArray(message.parts)) return null;

  const text = message.parts
    .filter(isSupportedTextPart)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return text.length > 0 ? text : null;
};

const shouldSkipGeneration = ({
  existingTitle,
  fallbackTitle,
  force,
}: {
  existingTitle: string | null;
  fallbackTitle: string;
  force: boolean;
}) => {
  if (force) return false;
  if (!existingTitle) return false;

  const normalized = existingTitle.trim();
  if (normalized.length === 0) return false;
  if (/^untitled\b/i.test(normalized)) return false;
  if (normalized === fallbackTitle) return false;

  return true;
};

const sanitizeGeneratedTitle = (raw: string, fallback: string): string => {
  const normalized = raw.replace(/[`"'“”‘’]/g, '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 3) return fallback;

  const trimmed = normalized.replace(/[.!?\s]+$/, '').trim();
  if (trimmed.length < 3) return fallback;

  return trimmed.slice(0, TITLE_MAX_LENGTH);
};

const buildConversationPreview = (messages: UIMessage[]) => {
  const collected: Array<{ role: 'user' | 'assistant'; text: string }> = [];
  let seenUserText = false;
  let fallbackUserText: string | null = null;

  for (const message of messages) {
    if (!message) continue;
    if (message.role !== 'user' && message.role !== 'assistant') continue;

    const text = extractPlainText(message);
    if (!text) continue;

    const normalized = text.replace(/\s+/g, ' ').trim();

    if (message.role === 'user') {
      if (normalized.length >= MIN_USER_TEXT_LENGTH) {
        seenUserText = true;
      }
      if (!fallbackUserText || normalized.length > fallbackUserText.length) {
        fallbackUserText = normalized;
      }
    }

    collected.push({ role: message.role, text });
    if (collected.length >= MAX_MESSAGES_FOR_CONTEXT && seenUserText) break;
  }

  if (!seenUserText && fallbackUserText) {
    collected.push({ role: 'user', text: fallbackUserText });
  }

  const hasMeaningfulUserText = seenUserText || Boolean(fallbackUserText);

  return {
    hasMeaningfulUserText,
    preview: collected
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
      .join('\n')
      .slice(0, MAX_CONTENT_CHARS)
      .trim(),
  };
};

export async function generateChatTitle({
  sessionId,
  userId,
  messages,
  force = false,
}: GenerateChatTitleParams): Promise<string | null> {
  const session = await getChatSession(sessionId, userId);
  if (!session) return null;

  const fallbackTitle = session.title?.trim() ?? UNTITLED_LABEL;

  if (shouldSkipGeneration({ existingTitle: session.title ?? null, fallbackTitle, force })) {
    return session.title ?? null;
  }

  const { preview, hasMeaningfulUserText } = buildConversationPreview(messages);
  if (!hasMeaningfulUserText || preview.length === 0) {
    return null;
  }

  const prompt = [
    'You name chat conversations.',
    'Return a concise, specific title no longer than 6 words.',
    'No quotes, emojis, or the word "chat".',
    'Use title case. Prefer nouns over verbs.',
    '',
    'Conversation:',
    preview,
  ].join('\n');

  try {
    const generation = await generateText({
      model: getModel('title'),
      prompt,
    });

    const generatedTitle = sanitizeGeneratedTitle(generation.text, fallbackTitle);

    if (generatedTitle === session.title) {
      return generatedTitle;
    }

    await updateChatSessionTitle({
      sessionId,
      userId,
      title: generatedTitle,
    });

    return generatedTitle;
  } catch (error) {
    console.error('[generateChatTitle] failed', error);
    return null;
  }
}
