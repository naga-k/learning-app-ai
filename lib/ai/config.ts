export const AI_MODEL_USE_CASES = ['chat', 'plan', 'course'] as const;

export type AIModelUseCase = (typeof AI_MODEL_USE_CASES)[number];

export type AIModelConfig = Record<AIModelUseCase, string>;

export const AI_MODEL_CONFIG = {
  openai: {
    chat: 'gpt-5-mini',
    plan: 'gpt-5-mini',
    course: 'gpt-5-mini',
  },
  cerebras: {
    chat: 'gpt-oss-120b',
    plan: 'gpt-oss-120b',
    course: 'gpt-oss-120b',
  },
} as const satisfies Record<string, AIModelConfig>;

export type AIProviderName = keyof typeof AI_MODEL_CONFIG;
