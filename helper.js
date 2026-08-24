import { Readable, PassThrough } from "node:stream";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import {
  renderToPipeableStream as renderToHTMLStream,
} from "react-dom/server";
import { randomUUID } from "node:crypto";

const initialFlightStreams = new Map();

export async function sendSSRDocument(res, pathname) {
  const { model, browserStream } = await fetchRSCForSSR(pathname);

  const flightId = randomUUID();
  const initialFlightUrl = `/initial-flight?id=${encodeURIComponent(flightId)}`;

  initialFlightStreams.set(flightId, browserStream);

  res.setHeader("Content-Type", "text/html");

  const htmlStream = new PassThrough();

  htmlStream.pipe(res, { end: false });

  htmlStream.on('end', () => {
    res.end();
  });

  const { pipe } = renderToHTMLStream(model, {
    bootstrapScriptContent: `
      window.__FLIGHT_QUEUE__ = [];
      window.__INITIAL_FLIGHT_URL__ = ${JSON.stringify(initialFlightUrl)};
    `,

    bootstrapScripts: ["/client.js"],

    onShellReady() {
      pipe(htmlStream);
    },

    onError(err) {
      console.error(err);
    }
  });
}

export function sendInitialFlight(res, flightId) {
  if (!flightId) {
    res.statusCode = 400;
    return res.end('Missing Flight ID');
  }

  const stream = initialFlightStreams.get(flightId);

  if (!stream) {
    res.statusCode = 404;
    return res.end('Flight stream not found');
  }

  // Stream can only be consumed once.
  initialFlightStreams.delete(flightId);

  res.setHeader("Content-Type", "text/x-component");

  Readable.fromWeb(stream).pipe(res);
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
