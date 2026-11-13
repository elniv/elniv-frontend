import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { buildOptions, finalize, loadEnv, root } from "./shared.mjs";

const outdir = path.join(root, "dist");
const env = loadEnv();

for (const key of ["ELNIV_API_URL", "ELNIV_SUPABASE_URL", "ELNIV_SUPABASE_ANON_KEY"]) {
  if (!env[key]) console.warn(`Warning: ${key} is not set. The app will show a configuration screen until it is.`);
}

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const result = await esbuild.build(buildOptions(outdir, { minify: true }));
finalize(outdir, result.metafile);
console.log(`Built to ${path.relative(root, outdir)}/`);
