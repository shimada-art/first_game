import { API_URL } from "../env.js";

const TOKEN_STORAGE_KEY = "souk.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, etc.) — session just won't persist across reloads.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues?: unknown,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const body = data as { error?: string; issues?: unknown };
    throw new ApiError(res.status, body.error ?? "unknown_error", body.issues);
  }

  return data as T;
}
