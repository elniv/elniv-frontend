import { apiUrl } from "./config";
import { getAccessToken, refreshSession, signOut } from "./auth";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const FALLBACKS: Record<number, string> = {
  400: "That request wasn't valid.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have access to that.",
  404: "We couldn't find that.",
  413: "That file is too large.",
  415: "That file type isn't supported.",
  429: "Too many requests. Please wait a moment and try again.",
};

/** Turn a FastAPI error body into a short, user-facing sentence. */
export function messageFromBody(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first?.msg === "string") return first.msg.replace(/^Value error,\s*/i, "");
    }
  }
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return FALLBACKS[status] ?? "Something went wrong. Please try again.";
}

async function send(path: string, token: string | null, opts: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? 30_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // the browser sets the multipart boundary
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  try {
    return await fetch(apiUrl(path), { method: opts.method ?? "GET", headers, body, signal: controller.signal });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    if (timedOut) throw new ApiError(0, "This is taking longer than expected. Please try again.");
    throw new ApiError(0, "Can't reach Elniv. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  let response = await send(path, token, opts);

  if (response.status === 401 && token) {
    const refreshed = await refreshSession().catch(() => null);
    if (!refreshed) {
      await signOut();
      throw new ApiError(401, FALLBACKS[401] ?? "Please sign in again.");
    }
    response = await send(path, refreshed.access_token, opts);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) throw new ApiError(response.status, messageFromBody(response.status, parsed));
  return parsed as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T = void>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "DELETE" }),
  upload: <T>(path: string, form: FormData, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST", form, timeoutMs: 90_000 }),
};
