import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { root } from "./shared.mjs";

const dist = path.join(root, "dist");
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let file = path.join(dist, path.normalize(urlPath));
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    // Serve the app shell for any route that is not a real file (SPA fallback).
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Previewing dist/ at http://localhost:${port}`));
