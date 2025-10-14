import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';

const DEFAULT_CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';

const SUPPORTED_PROVIDERS = ['openai', 'cerebras'] as const;

export type AIProviderName = (typeof SUPPORTED_PROVIDERS)[number];
export type AIModelUseCase = 'chat' | 'plan' | 'course';

function resolveProviderName(): AIProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? 'openai';
  if ((SUPPORTED_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as AIProviderName;
  }

  throw new Error(
    `Unsupported AI provider "${raw}". Please set AI_PROVIDER to one of: ${SUPPORTED_PROVIDERS.join(
      ', ',
    )}.`,
  );
}

function requireEnv(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

const providerName = resolveProviderName();

const provider: OpenAIProvider =
  providerName === 'cerebras'
    ? createOpenAI({
        name: 'cerebras',
        apiKey: requireEnv(
          process.env.CEREBRAS_API_KEY,
          'CEREBRAS_API_KEY is required when AI_PROVIDER=cerebras.',
        ),
        baseURL: process.env.CEREBRAS_BASE_URL?.trim() || DEFAULT_CEREBRAS_BASE_URL,
      })
    : createOpenAI({
        name: 'openai',
        apiKey: requireEnv(
          process.env.OPENAI_API_KEY,
          'OPENAI_API_KEY is required when AI_PROVIDER=openai.',
        ),
      });

const defaultModel =
  process.env.AI_MODEL_ID?.trim() ||
  (providerName === 'openai' ? 'gpt-5-mini' : 'llama3.1-8b-instruct');

const modelMap: Record<AIModelUseCase, string> = {
  chat: process.env.AI_MODEL_CHAT?.trim() || defaultModel,
  plan:
    process.env.AI_MODEL_PLAN?.trim() ||
    process.env.AI_MODEL_CHAT?.trim() ||
    defaultModel,
  course:
    process.env.AI_MODEL_COURSE?.trim() ||
    process.env.AI_MODEL_CHAT?.trim() ||
    defaultModel,
};

export function getModelId(useCase: AIModelUseCase = 'chat'): string {
  return modelMap[useCase];
}

export function getModel(useCase: AIModelUseCase = 'chat') {
  const modelId = getModelId(useCase);
  if (providerName === 'cerebras') {
    return provider.chat(modelId);
  }
  return provider(modelId);
}

export const activeAIProviderName = providerName;
export const activeAIProvider = provider;
export const supportsOpenAIWebSearch = providerName === 'openai';
