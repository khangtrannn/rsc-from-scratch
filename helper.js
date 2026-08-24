import { Readable, PassThrough } from "node:stream";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import {
  renderToPipeableStream as renderToHTMLStream,
} from "react-dom/server";

export async function sendSSRDocument(res, pathname) {
  const { model, browserStream } = await fetchRSCForSSR(pathname);

  const browserFlightPromise = readFlightChunks(browserStream);

  res.setHeader("Content-Type", "text/html");

  const htmlStream = new PassThrough();

  htmlStream.pipe(res, { end: false });

  htmlStream.on("end", async () => {
    const flightChunks = await browserFlightPromise;

    const flightPushScripts = flightChunks
      .map((chunk) => {
        const serializedChunk = JSON.stringify(chunk).replace(/</g, "\\u003c");

        return `
          window.__FLIGHT_QUEUE__.push({
            type: "chunk",
            value: ${serializedChunk}
          });
        `;
      })
      .join("\n");

    res.end(`
      <script>
        ${flightPushScripts}
        window.__FLIGHT_QUEUE__.push({ type: "done" });
      </script>
    `);
  });

  const { pipe } = renderToHTMLStream(model, {
    bootstrapScriptContent: `
      window.__FLIGHT_QUEUE__ = [];
    `,
    bootstrapScripts: ["/client.js"],
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

async function readFlightChunks(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  const chunks = [];

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(
      decoder.decode(value, { stream: true }),
    );
  }

  const remaining = decoder.decode();

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
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
