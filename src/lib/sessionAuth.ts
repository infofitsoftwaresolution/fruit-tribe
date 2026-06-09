export const SESSION_EXPIRED_EVENT = 'ft:session-expired';

export const SESSION_EXPIRED_TITLE = 'Your session has expired';
export const SESSION_EXPIRED_DESCRIPTION =
  'Please sign in again to continue. For your security, we signed you out after a period of inactivity.';

const PUBLIC_AUTH_PATH =
  /\/auth\/(login|register|verify-email|resend-email-code|forgot-password|reset-password|whatsapp\/)/;

let sessionExpiryNotified = false;

export class SessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED';

  constructor() {
    super(SESSION_EXPIRED_TITLE);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

export function hasStoredAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    localStorage.getItem('token')
    || localStorage.getItem('accessToken')
    || sessionStorage.getItem('token')
    || sessionStorage.getItem('accessToken')
  );
}

function requestHadAuth(init?: RequestInit): boolean {
  if (hasStoredAuthToken()) return true;
  const headers = init?.headers;
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === 'authorization');
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isPublicAuthRequest(url: string): boolean {
  return PUBLIC_AUTH_PATH.test(url);
}

export function notifySessionExpired(): void {
  if (typeof window === 'undefined' || sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  window.setTimeout(() => {
    sessionExpiryNotified = false;
  }, 3000);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const url = resolveRequestUrl(input);

  if (
    res.status === 401
    && requestHadAuth(init)
    && !isPublicAuthRequest(url)
  ) {
    notifySessionExpired();
    throw new SessionExpiredError();
  }

  return res;
}
