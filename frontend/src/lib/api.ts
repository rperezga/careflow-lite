// Thrown for any non-2xx API response so callers can branch on status/code.
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include', // send the httpOnly auth cookie
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
  const body: unknown = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, b.error ?? 'request_failed', b.message);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
