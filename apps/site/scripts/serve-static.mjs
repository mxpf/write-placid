import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist/static-public");
const port = Number(process.argv[3] || 4173);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

async function findFile(pathname) {
  const relative = pathname.replace(/^\/+/, "");
  const candidates = pathname.endsWith("/")
    ? [path.join(root, relative, "index.html")]
    : [path.join(root, relative), path.join(root, `${relative}.html`)];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) continue;
    try {
      if ((await stat(resolved)).isFile()) return resolved;
    } catch {}
  }
  return null;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const filename = await findFile(pathname === "/" ? "/index.html" : pathname);
    if (!filename) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": mimeTypes.get(path.extname(filename)) || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(await readFile(filename));
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
