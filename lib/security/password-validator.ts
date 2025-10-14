const COMMON_PATTERNS = ['password', '123456', '123456789', 'qwerty', 'letmein'];

export const PASSWORD_REQUIREMENTS = [
  'Use at least 12 characters.',
  'Include at least one letter.',
  'Include at least one number.',
  'Include at least one special character (e.g. !@#$).',
  'Avoid common or easily guessed phrases.',
];

export type PasswordRuleStatus = {
  length: boolean;
  letter: boolean;
  number: boolean;
  special: boolean;
  common: boolean;
};

export type PasswordValidationResult = {
  valid: boolean;
  issues: string[];
  rules: PasswordRuleStatus;
};

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()[\]{}\-_=+~`|:;"'<>,.?/\\]/;

export const validatePassword = (password: string): PasswordValidationResult => {
  const issues: string[] = [];
  const normalized = password.trim();
  const lower = normalized.toLowerCase();

  const rules: PasswordRuleStatus = {
    length: normalized.length >= 12,
    letter: /[a-z]/i.test(normalized),
    number: /\d/.test(normalized),
    special: SPECIAL_CHAR_PATTERN.test(normalized),
    common: normalized.length > 0 ? !COMMON_PATTERNS.some((pattern) => lower.includes(pattern)) : false,
  };

  if (!rules.length) {
    issues.push('Password must contain at least 12 characters.');
  }

  if (!rules.letter) {
    issues.push('Add at least one letter.');
  }

  if (!rules.number) {
    issues.push('Add at least one number.');
  }

  if (!rules.special) {
    issues.push('Add at least one special character (e.g. !@#$).');
  }

  if (!rules.common) {
    issues.push('Avoid common passwords or words that are easy to guess.');
  }

  return {
    valid: issues.length === 0,
    issues,
    rules,
  };
};
