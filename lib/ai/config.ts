export const AI_MODEL_USE_CASES = ['chat', 'plan', 'course', 'title'] as const;

export type AIModelUseCase = (typeof AI_MODEL_USE_CASES)[number];

export type AIModelConfig = Record<AIModelUseCase, string>;

export const AI_MODEL_CONFIG = {
  openai: {
    chat: 'gpt-5',
    plan: 'gpt-5-mini',
    course: 'gpt-5',
    title: 'gpt-5-nano',
  },
  cerebras: {
    chat: 'gpt-oss-120b',
    plan: 'gpt-oss-120b',
    course: 'gpt-oss-120b',
    title: 'gpt-oss-20b',
  },
} as const satisfies Record<string, AIModelConfig>;

export type AIProviderName = keyof typeof AI_MODEL_CONFIG;
