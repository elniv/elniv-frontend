import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { buildOptions, finalize, root } from "./shared.mjs";

const outdir = path.join(root, "dist-dev");
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const rebuild = {
  name: "finalize",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0 && result.metafile) finalize(outdir, result.metafile);
    });
  },
};

const ctx = await esbuild.context({ ...buildOptions(outdir, { minify: false }), plugins: [rebuild] });
await ctx.watch();
const { port } = await ctx.serve({ servedir: outdir, port: 3000, fallback: path.join(outdir, "index.html") });
console.log(`Elniv dev server: http://localhost:${port}`);
