import { createServer } from "node:http";
import { renderToPipeableStream as renderToFlightStream } from "react-server-dom-webpack/server";
import { Router } from "./app/Router.jsx";
import { readFile } from "node:fs/promises";

const clientManifest = await loadClientManifest();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname !== "/rsc") {
      res.statusCode = 404;
      return res.end();
    }

    const targetUrl = new URL(
      url.searchParams.get("url") ?? "/",
      `http://${req.headers.host}`,
    );

    sendRSC(res, <Router url={targetUrl} />);
  } catch (err) {
    console.error(err);

    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8081, () => {
  console.log("RSC server listening on http://localhost:8081");
});

async function sendRSC(res, jsx) {
  res.setHeader("Content-Type", "text/x-component");
  const stream = renderToFlightStream(jsx, clientManifest);
  stream.pipe(res);
}

async function loadClientManifest() {
  const manifestUrl = new URL("./dist/client-manifest.json", import.meta.url);

  const source = await readFile(manifestUrl, "utf-8");

  return JSON.parse(source);
}
