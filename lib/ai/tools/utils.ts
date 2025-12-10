const PROGRAMMING_DOMAINS = [
  "frontend-development",
  "backend-development",
  "programming",
  "javascript",
  "typescript",
  "python",
  "java",
  "react",
  "node",
  "web-development",
  "software-engineering",
  "coding",
];

export const isProgrammingDomain = (domain?: string) => {
  const normalized = domain?.trim().toLowerCase() ?? "";
  return PROGRAMMING_DOMAINS.some((entry) => normalized.includes(entry));
};

export const PROGRAMMING_DOMAINS_LIST = PROGRAMMING_DOMAINS;
import { generateText } from 'ai';
import { z } from 'zod';

type GenerateTextParams = Parameters<typeof generateText>[0];

const JSON_ONLY_REMINDER =
    '\n\nReminder: Respond with valid JSON that matches the required schema. Do not include commentary before or after the JSON.';

export const isJsonStructureError = (error: unknown) => {
    if (error instanceof z.ZodError) return true;
    if (!(error instanceof Error)) return false;

    const message = error.message ?? '';

    if (/Could not extract valid JSON/i.test(message)) return true;
    if (/Unexpected token/i.test(message) && message.includes('JSON')) return true;
    if (/Unexpected end of JSON input/i.test(message)) return true;
    if (error.name === 'SyntaxError' && /JSON/.test(message)) return true;

    return false;
};

type GenerateJsonWithRetryParams<T> = {
    prompt: string;
    model: GenerateTextParams['model'];
    tools?: GenerateTextParams['tools'];
    providerOptions?: GenerateTextParams['providerOptions'];
    parse: (text: string) => T;
};

export const generateJsonWithRetry = async <T>({
    prompt,
    model,
    tools,
    providerOptions,
    parse,
}: GenerateJsonWithRetryParams<T>) => {
    const attempt = async (effectivePrompt: string) => {
        const options: GenerateTextParams = {
            model,
            prompt: effectivePrompt,
            tools,
            providerOptions,
        };
        const generation = await generateText(options);

        return parse(generation.text);
    };

    try {
        return await attempt(prompt);
    } catch (error) {
        if (!isJsonStructureError(error)) throw error;
        return await attempt(`${prompt}${JSON_ONLY_REMINDER}`);
    }
};
