import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

// Minimal browser shims for the modules under test.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  window: { addEventListener() {}, location: { origin: "http://localhost:3000", pathname: "/", hash: "" } },
});

const { config } = await import("../src/lib/config.ts");
const auth = await import("../src/lib/auth.ts");
const { api, ApiError } = await import("../src/lib/api.ts");

config.apiUrl = "http://api.test";
config.supabaseUrl = "http://sb.test";
config.supabaseAnonKey = "anon";

const realFetch = globalThis.fetch;
let calls: { url: string; init?: RequestInit }[] = [];
const user = { id: "u1", email: "a@b.co", user_metadata: {} };
const now = () => Math.floor(Date.now() / 1000);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  store.clear();
  auth.resetAuthForTests();
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("signIn stores the session and the API call carries the bearer token", async () => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/auth/v1/token")) return json(200, { access_token: "tok", refresh_token: "ref", expires_in: 3600, user });
    return json(200, { items: [], total: 0, limit: 100, offset: 0 });
  }) as typeof fetch;
  await auth.signIn("a@b.co", "pw");
  await api.get("/conversations/?limit=100&offset=0");
  const apiCall = calls.find((c) => c.url.startsWith("http://api.test"));
  assert.equal(apiCall?.url, "http://api.test/api/v1/conversations/?limit=100&offset=0");
  assert.equal((apiCall?.init?.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.ok(store.get("elniv.session"));
});

test("invalid credentials produce a friendly message", async () => {
  globalThis.fetch = (async () => json(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" })) as typeof fetch;
  await assert.rejects(auth.signIn("a@b.co", "bad"), (e: Error) => /don't match/.test(e.message));
});

test("a 401 triggers one refresh and a retry with the new token", async () => {
  store.set("elniv.session", JSON.stringify({ access_token: "old", refresh_token: "ref", expires_at: now() + 3600, user }));
  let apiHits = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("grant_type=refresh_token")) return json(200, { access_token: "new", refresh_token: "ref2", expires_in: 3600, user });
    apiHits++;
    const header = (init?.headers as Record<string, string>).Authorization;
    return header === "Bearer new" ? json(200, { ok: true }) : json(401, { detail: "expired" });
  }) as typeof fetch;
  assert.deepEqual(await api.get("/x/"), { ok: true });
  assert.equal(apiHits, 2);
});

test("a failed refresh signs the user out", async () => {
  store.set("elniv.session", JSON.stringify({ access_token: "old", refresh_token: "ref", expires_at: now() + 3600, user }));
  globalThis.fetch = (async (url: string) => (String(url).includes("/auth/v1/") ? json(400, { error_code: "refresh_token_not_found" }) : json(401, { detail: "no" }))) as typeof fetch;
  await assert.rejects(api.get("/x/"), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(auth.getSession(), null);
  assert.equal(store.get("elniv.session"), undefined);
});

test("network failure surfaces a connection message", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(api.get("/x/"), (e: unknown) => e instanceof ApiError && /Can't reach Elniv/.test(e.message));
});

test("multipart uploads do not set a JSON content type", async () => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return json(200, { text: "hi", provider: "groq" });
  }) as typeof fetch;
  const form = new FormData();
  form.append("audio", new Blob(["x"], { type: "audio/webm" }), "v.webm");
  await api.upload("/voice/transcribe", form);
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], undefined);
  assert.ok(calls[0]?.init?.body instanceof FormData);
});
