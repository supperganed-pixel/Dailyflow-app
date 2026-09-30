const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../artifacts/dailyflow/dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const relative = decodeURIComponent(url.pathname);
    let file = path.resolve(root, "." + relative);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, "index.html");
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("DailyFlow preview: http://127.0.0.1:4173"),
  );
