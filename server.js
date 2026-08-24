import { createServer } from "http";
import { readFile } from "node:fs/promises";
import { proxyRSC, sendSSRDocument } from "./helper.js";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/.well-known/")) {
      res.statusCode = 404;
      return res.end();
    }

    if (url.pathname === "/client.js") {
      await sendScript(res, "./dist/client.js");
    } else if (url.pathname === "/rsc") {
      const pathname = url.searchParams.get("url") ?? "/";
      await proxyRSC(res, pathname);
    } else {
      await sendSSRDocument(res, url.pathname);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8080);

async function sendScript(res, filename) {
  const content = await readFile(filename, "utf8");
  res.setHeader("Content-Type", "text/javascript");
  res.end(content);
}
