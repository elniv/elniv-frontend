const clean = (value: string | undefined): string => (typeof value === "string" ? value.trim().replace(/\/+$/, "") : "");

/** Public build-time configuration (see .env.example). Mutable so tests can override it. */
export const config = {
  apiUrl: clean(typeof __API_URL__ !== "undefined" ? __API_URL__ : undefined),
  supabaseUrl: clean(typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : undefined),
  supabaseAnonKey: typeof __SUPABASE_ANON_KEY__ !== "undefined" ? __SUPABASE_ANON_KEY__.trim() : "",
};

export function configIssues(): string[] {
  const issues: string[] = [];
  if (!config.apiUrl) issues.push("ELNIV_API_URL");
  if (!config.supabaseUrl) issues.push("ELNIV_SUPABASE_URL");
  if (!config.supabaseAnonKey) issues.push("ELNIV_SUPABASE_ANON_KEY");
  return issues;
}

export const apiUrl = (path: string): string => `${config.apiUrl}/api/v1${path}`;
