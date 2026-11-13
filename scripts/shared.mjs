import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Read .env (if present) and let real environment variables win. */
export function loadEnv() {
  const env = {};
  const file = path.join(root, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const key of ["ELNIV_API_URL", "ELNIV_SUPABASE_URL", "ELNIV_SUPABASE_ANON_KEY"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

export function buildOptions(outdir, { minify }) {
  const env = loadEnv();
  return {
    entryPoints: [path.join(root, "src/main.tsx")],
    bundle: true,
    splitting: true,
    format: "esm",
    outdir: path.join(outdir, "assets"),
    entryNames: "[name]-[hash]",
    chunkNames: "chunks/[name]-[hash]",
    assetNames: "[name]-[hash]",
    loader: { ".svg": "file" },
    publicPath: "/assets",
    jsx: "automatic",
    target: ["es2022", "chrome111", "safari16.4", "firefox115"],
    minify,
    sourcemap: minify ? false : "inline",
    metafile: true,
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": JSON.stringify(minify ? "production" : "development"),
      __API_URL__: JSON.stringify(env.ELNIV_API_URL ?? ""),
      __SUPABASE_URL__: JSON.stringify(env.ELNIV_SUPABASE_URL ?? ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.ELNIV_SUPABASE_ANON_KEY ?? ""),
    },
  };
}

/** Write index.html with the hashed entry assets, and copy static files. */
export function finalize(outdir, metafile) {
  const rel = (p) => "/" + path.relative(outdir, path.join(root, p)).replace(/\\/g, "/");
  const entries = Object.entries(metafile.outputs).filter(([, out]) => out.entryPoint === "src/main.tsx");
  if (entries.length === 0) throw new Error("Entry output not found in metafile.");
  const [jsFile, out] = entries[0];
  const jsUrl = "/" + path.relative(outdir, path.join(root, jsFile)).replace(/\\/g, "/");
  const cssFile = out.cssBundle ? "/" + path.relative(outdir, path.join(root, out.cssBundle)).replace(/\\/g, "/") : null;
  void rel;

  let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  html = html.replace("<!--ASSETS_HEAD-->", cssFile ? `<link rel="stylesheet" href="${cssFile}" />` : "");
  html = html.replace("<!--ASSETS_BODY-->", `<script type="module" src="${jsUrl}"></script>`);
  fs.writeFileSync(path.join(outdir, "index.html"), html);

  fs.cpSync(path.join(root, "public"), outdir, { recursive: true });
  // One canonical logo asset: the favicon is a copy of the brand mark.
  fs.copyFileSync(path.join(root, "src/assets/brand/elniv-mark.svg"), path.join(outdir, "favicon.svg"));
}
