const tryParseJson = (candidate: string) => {
  const trimmedCandidate = candidate.trim();

  if (!trimmedCandidate) return null;

  try {
    JSON.parse(trimmedCandidate);
    return trimmedCandidate;
  } catch {
    return null;
  }
};

const unwrapCodeFence = (value: string) => {
  if (!value.startsWith('```')) return null;

  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? null;
};

const extractBalancedJsonFrom = (text: string, startIndex: number) => {
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      if (stack.length === 0) return null;

      const last = stack.pop();
      const isMatchingPair =
        (char === '}' && last === '{') || (char === ']' && last === '[');

      if (!isMatchingPair) return null;

      if (stack.length === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
};

export const extractJsonFromText = (raw: string) => {
  const trimmed = raw.trim();

  const fenced = unwrapCodeFence(trimmed);
  const fencedParsed = fenced ? tryParseJson(fenced) : null;
  if (fencedParsed) return fencedParsed;

  const directParsed = tryParseJson(trimmed);
  if (directParsed) return directParsed;

  const candidates = new Set<string>();

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (char === '{' || char === '[') {
      const candidate = extractBalancedJsonFrom(trimmed, i);
      if (candidate) candidates.add(candidate.trim());
    }
  }

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed) return parsed;
  }

  const preview = trimmed.slice(0, 200);
  throw new Error(
    `Could not extract valid JSON from model output. Preview: ${preview}`,
  );
};
