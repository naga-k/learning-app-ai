export const extractJsonFromText = (raw: string) => {
  const trimmed = raw.trim();

  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return trimmed;
};
