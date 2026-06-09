import { toast } from 'sonner';
import {
  isSessionExpiredError,
  SESSION_EXPIRED_DESCRIPTION,
  SESSION_EXPIRED_TITLE,
} from './sessionAuth';

type ErrorLike = {
  message?: unknown;
  error?: unknown;
  statusCode?: unknown;
};

const SESSION_EXPIRED_TOAST_ID = 'ft-session-expired';

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

function isUnauthorizedMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'unauthorized'
    || normalized === 'unauthorised'
    || normalized.includes('jwt expired')
    || normalized.includes('token expired')
    || normalized.includes('invalid token')
    || normalized.includes('session expired')
  );
}

export function toastSessionExpired(): void {
  toast.error(SESSION_EXPIRED_TITLE, {
    id: SESSION_EXPIRED_TOAST_ID,
    description: SESSION_EXPIRED_DESCRIPTION,
    duration: 6000,
  });
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
  if (isSessionExpiredError(error)) {
    return SESSION_EXPIRED_TITLE;
  }

  const fromObj = extractMessage(error);
  if (fromObj) {
    const nested = maybeParseJsonMessage(fromObj);
    const message = stripNoise(nested || fromObj) || fallback;
    return isUnauthorizedMessage(message) ? SESSION_EXPIRED_TITLE : message;
  }

  const raw = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as ErrorLike;
    const parsedMessage = extractMessage(parsed);
    if (parsedMessage) {
      const message = stripNoise(parsedMessage);
      return isUnauthorizedMessage(message) ? SESSION_EXPIRED_TITLE : message;
    }
  } catch {
    // Not JSON payload
  }

  // Avoid showing giant backend payloads and internal details to users.
  if (trimmed.includes('{') && trimmed.includes('}') && trimmed.length > 120) {
    return fallback;
  }

  const message = stripNoise(trimmed) || fallback;
  return isUnauthorizedMessage(message) ? SESSION_EXPIRED_TITLE : message;
}

/** Show a user-facing API error toast; session expiry is handled once globally. */
export function toastUserError(error: unknown, fallback: string): void {
  if (isSessionExpiredError(error)) return;

  const message = getUserErrorMessage(error, fallback);
  const sessionLike = message === SESSION_EXPIRED_TITLE;

  toast.error(message, {
    id: sessionLike ? SESSION_EXPIRED_TOAST_ID : undefined,
    description: sessionLike ? SESSION_EXPIRED_DESCRIPTION : undefined,
    duration: sessionLike ? 6000 : 4000,
  });
}
