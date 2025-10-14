export const extractJsonFromText = (raw: string) => {
  const trimmed = raw.trim();

  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const firstJsonCharIndex = trimmed.search(/[{\[]/);
  if (firstJsonCharIndex !== -1) {
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = firstJsonCharIndex; i < trimmed.length; i += 1) {
      const char = trimmed[i];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (char === '\\') {
          isEscaped = true;
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
        depth += 1;
        continue;
      }

      if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) {
          return trimmed.slice(firstJsonCharIndex, i + 1).trim();
        }
        continue;
      }
    }

    return trimmed.slice(firstJsonCharIndex).trim();
  }

  return trimmed;
};
