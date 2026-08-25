import { createServer } from "http";
import { readFile } from "node:fs/promises";
import { Readable, PassThrough } from "node:stream";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import { renderToPipeableStream as renderToHTMLStream } from "react-dom/server";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/.well-known/") || url.pathname.startsWith("/favicon.ico")) {
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

async function sendSSRDocument(res, pathname) {
  const { model, browserStream } = await fetchRSCForSSR(pathname);

  const browserFlightPromise = new Response(browserStream).text();

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const htmlStream = new PassThrough();

  htmlStream.pipe(res, { end: false });

  htmlStream.on('end', async () => {
    try {
      const flight = await browserFlightPromise;
      const serializedFlight = JSON.stringify(flight).replace(/</g, "\\u003c");

      res.end(`
        <script>
          window.__INITIAL_FLIGHT__ = ${serializedFlight};
        </script>

        <script src="/client.js"></script>
      `);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end();
    }
  });

  const { pipe } = renderToHTMLStream(model, {
    onShellReady() {
      pipe(htmlStream);
    },

    onError(error) {
      console.error(error);
    }
  })
}

export async function proxyRSC(res, pathname) {
  const response = await fetch(
    `http://localhost:8081/rsc?url=${encodeURIComponent(pathname)}`,
  );

  res.statusCode = response.status;

  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") ?? "text/x-component",
  );

  Readable.fromWeb(response.body).pipe(res);
}

async function fetchRSCForSSR(pathname) {
  const response = await fetch(
    `http://localhost:8081/rsc?url=${encodeURIComponent(pathname)}`,
  );

  if (!response.ok) {
    throw new Error(`RSC request failed: ${response.status}`);
  }

  const [ssrStream, browserStream] = response.body.tee();

  const model = createFromNodeStream(Readable.fromWeb(ssrStream), {
    moduleMap: {},
    moduleLoading: null,
    serverModuleMap: null,
  });

  return {
    model,
    browserStream,
  };
}