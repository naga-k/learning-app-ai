import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import {
  AI_MODEL_CONFIG,
  type AIModelUseCase,
  type AIProviderName,
} from '@/lib/ai/config';

const DEFAULT_CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';

const SUPPORTED_PROVIDERS = Object.keys(AI_MODEL_CONFIG) as AIProviderName[];

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

const modelConfig = AI_MODEL_CONFIG[providerName];

export function getModelId(useCase: AIModelUseCase = 'chat'): string {
  return modelConfig[useCase];
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
