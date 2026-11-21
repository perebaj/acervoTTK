import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import itemsHandler from "../api/items.js";

const PORT = Number(process.env.PORT || 8777);
const PUBLIC_DIR = path.resolve("public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/api/items") {
    const wrappedRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        res.writeHead(this.statusCode, {
          "Content-Type": "application/json; charset=utf-8",
          ...this.headers,
        });
        res.end(JSON.stringify(payload));
      },
    };
    await itemsHandler({ method: req.method }, wrappedRes);
    return;
  }

  let relPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(relPath));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Preview local rodando em http://localhost:${PORT}`);
});
