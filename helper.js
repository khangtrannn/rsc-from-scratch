import { Readable, PassThrough } from "node:stream";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import {
  renderToPipeableStream as renderToHTMLStream,
} from "react-dom/server";

export async function sendSSRDocument(res, pathname) {
  const { model, browserStream } = await fetchRSCForSSR(pathname);

  const browserFlightPromise = new Response(browserStream).text();

  res.setHeader("Content-Type", "text/html");

  const htmlStream = new PassThrough();

  htmlStream.pipe(res, { end: false });

  htmlStream.on("end", async () => {
    const flight = await browserFlightPromise;

    const serializedFlight = JSON.stringify(flight).replace(/</g, "\\u003c");

    res.end(`
      <script>
        window.__INITIAL_FLIGHT__ = ${serializedFlight}
      </script>
      <script src="/client.js"></script>
    `);
  });

  const { pipe } = renderToHTMLStream(model, {
    onShellReady() {
      pipe(htmlStream);
    },
    onError(error) {
      console.error(error);
    },
  });
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
    `http://localhost:8081/rsc?url=${encodeURIComponent(pathname)}`
  );

  if (!response.ok) {
    throw new Error(`RSC request failed: ${response.status}`);
  }

  const [ssrStream, browserStream] = response.body.tee();

  const model = createFromNodeStream(
    Readable.fromWeb(ssrStream),
    {
      moduleMap: {},
      moduleLoading: null,
      serverModuleMap: null,
    }
  );

  return {
    model,
    browserStream,
  };
}
