type ErrorLike = {
  message?: unknown;
  error?: unknown;
  statusCode?: unknown;
};

function extractMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractMessage(item))
      .filter((item): item is string => !!item);
    return parts.length ? parts.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return extractMessage(obj.message) ?? extractMessage(obj.error) ?? null;
  }
  return null;
}

function stripNoise(message: string): string {
  return message
    .replace(/^Error:\s*/i, '')
    .replace(/^Bad Request:\s*/i, '')
    .trim();
}

function maybeParseJsonMessage(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed) as ErrorLike;
    return extractMessage(parsed);
  } catch {
    return null;
  }
}

export function getUserErrorMessage(error: unknown, fallback: string): string {
  const fromObj = extractMessage(error);
  if (fromObj) {
    const nested = maybeParseJsonMessage(fromObj);
    return stripNoise(nested || fromObj) || fallback;
  }

  const raw = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as ErrorLike;
    const parsedMessage = extractMessage(parsed);
    if (parsedMessage) return stripNoise(parsedMessage);
  } catch {
    // Not JSON payload
  }

  // Avoid showing giant backend payloads and internal details to users.
  if (trimmed.includes('{') && trimmed.includes('}') && trimmed.length > 120) {
    return fallback;
  }

  return stripNoise(trimmed) || fallback;
}
