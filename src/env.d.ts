// Build-time constants injected by scripts/shared.mjs (esbuild `define`).
declare const __API_URL__: string;
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.css";
