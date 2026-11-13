// Supabase Auth (GoTrue) over its public REST API. The backend only verifies the
// resulting access token, so the browser talks to Supabase directly for sign-in.
import { config } from "./config";

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  /** Unix time in seconds. */
  expires_at: number;
  user: AuthUser;
}

export class AuthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

const STORAGE_KEY = "elniv.session";
const REFRESH_MARGIN_SECONDS = 60;

let session: Session | null | undefined;
let refreshing: Promise<Session | null> | null = null;
const listeners = new Set<() => void>();

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.access_token === "string" &&
    typeof v.refresh_token === "string" &&
    typeof v.expires_at === "number" &&
    typeof v.user === "object" &&
    v.user !== null
  );
}

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setSession(next: Session | null): void {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode); the session lives in memory only */
  }
  listeners.forEach((listener) => listener());
}

export function getSession(): Session | null {
  if (session === undefined) session = readStored();
  return session;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keep multiple tabs in sync. Call once at startup. */
export function watchOtherTabs(): void {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    session = readStored();
    listeners.forEach((listener) => listener());
  });
}

/** Test helper. */
export function resetAuthForTests(): void {
  session = undefined;
  refreshing = null;
  listeners.clear();
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

function friendlyAuthMessage(status: number, code: string, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Please try again.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return fallback || "Please choose a stronger password.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "signup_disabled":
      return "New sign-ups are currently turned off.";
    case "same_password":
      return "Your new password must be different from the current one.";
    default:
      break;
  }
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "Sign-in is temporarily unavailable. Please try again shortly.";
  return fallback || "Something went wrong. Please try again.";
}

async function authFetch<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new AuthError("Sign-in isn't configured for this deployment.", "not_configured", 0);
  }

  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${init.token ?? config.supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new AuthError("Can't reach Elniv. Check your connection and try again.", "network", 0);
  }

  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const code = String(body.error_code ?? body.code ?? body.error ?? "");
    const detail = String(body.msg ?? body.error_description ?? body.message ?? "");
    throw new AuthError(friendlyAuthMessage(response.status, code, detail), code, response.status);
  }
  return body as T;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: AuthUser;
}

function toSession(body: TokenResponse): Session {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? nowSeconds() + (body.expires_in ?? 3600),
    user: body.user,
  };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const body = await authFetch<TokenResponse>("/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const next = toSession(body);
  setSession(next);
  return next;
}

export type SignUpResult = { session: Session } | { confirmationRequired: true };

export async function signUp(email: string, password: string, displayName: string): Promise<SignUpResult> {
  const body = await authFetch<Partial<TokenResponse>>("/signup", {
    method: "POST",
    body: { email, password, data: { display_name: displayName } },
  });
  if (body.access_token && body.refresh_token && body.user) {
    const next = toSession(body as TokenResponse);
    setSession(next);
    return { session: next };
  }
  return { confirmationRequired: true };
}

export async function signOut(): Promise<void> {
  const current = getSession();
  setSession(null);
  if (current) {
    try {
      await authFetch("/logout?scope=local", { method: "POST", token: current.access_token });
    } catch {
      /* the local session is already cleared */
    }
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirect = encodeURIComponent(`${window.location.origin}/reset-password`);
  await authFetch(`/recover?redirect_to=${redirect}`, { method: "POST", body: { email } });
}

/** Refresh the session. Returns null (and signs out) when the refresh token is no longer valid. */
export function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const current = getSession();
  if (!current) return Promise.resolve(null);

  refreshing = (async () => {
    try {
      const body = await authFetch<TokenResponse>("/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: current.refresh_token },
      });
      const next = toSession(body);
      setSession(next);
      return next;
    } catch (error) {
      if (error instanceof AuthError && error.status >= 400 && error.status < 500) {
        setSession(null);
        return null;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** A valid access token, refreshed shortly before it expires. */
export async function getAccessToken(): Promise<string | null> {
  const current = getSession();
  if (!current) return null;
  if (current.expires_at - nowSeconds() > REFRESH_MARGIN_SECONDS) return current.access_token;
  try {
    const next = await refreshSession();
    return next?.access_token ?? null;
  } catch {
    // Offline or Supabase unavailable: use what we have and let the API decide.
    return current.access_token;
  }
}

export async function updateUser(patch: { data?: Record<string, unknown>; password?: string }): Promise<AuthUser> {
  const token = await getAccessToken();
  if (!token) throw new AuthError("Please sign in again.", "no_session", 401);
  const user = await authFetch<AuthUser>("/user", { method: "PUT", token, body: patch });
  const current = getSession();
  if (current) setSession({ ...current, user: { ...current.user, ...user } });
  return user;
}

export type RedirectResult = { type: "recovery" | "signup" | "magiclink" | "other" } | { error: string } | null;

/** Handle links from Supabase emails (confirmation, password recovery), which return tokens in the URL hash. */
export async function consumeAuthRedirect(): Promise<RedirectResult> {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);

  const error = params.get("error_description");
  if (error) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return { error: error.replace(/\+/g, " ") };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  history.replaceState(null, "", window.location.pathname + window.location.search);

  const user = await authFetch<AuthUser>("/user", { token: accessToken });
  const expiresIn = Number(params.get("expires_in") ?? 3600);
  setSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: nowSeconds() + expiresIn, user });

  const type = params.get("type");
  if (type === "recovery" || type === "signup" || type === "magiclink") return { type };
  return { type: "other" };
}

export function displayName(user: AuthUser | null | undefined): string {
  if (!user) return "";
  const name = user.user_metadata?.display_name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return (user.email ?? "").split("@")[0] ?? "";
}

export const isOnboarded = (user: AuthUser | null | undefined): boolean => user?.user_metadata?.onboarded === true;
