import { createServer } from "http";
import { readFile } from "node:fs/promises";
import { Readable, PassThrough, Transform } from "node:stream";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import { renderToPipeableStream as renderToHTMLStream } from "react-dom/server";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (
      url.pathname.startsWith("/.well-known/") ||
      url.pathname.startsWith("/favicon.ico")
    ) {
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

  res.setHeader("Content-Type", "text/html");

  const htmlStream = new PassThrough();

  const inlineFlightStream = createInlineFlightStream(browserStream);

  htmlStream
    .pipe(createFlightInjectionTransform(inlineFlightStream))
    .pipe(createMoveClosingTagsTransform())
    .pipe(res);

  const { pipe, abort } = renderToHTMLStream(model, {
    bootstrapScripts: ["/client.js"],

    onShellReady() {
      pipe(htmlStream);
    },

    onError(error) {
      console.error(error);
    },
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      abort();
    }
  });
}

function createInlineFlightStream(flightStream) {
  async function* generate() {
    // bootstrap instruction
    yield Buffer.from(
      `<script>(self.__next_f=self.__next_f||[]).push([0])</script>`,
    );

    const reader = flightStream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const text = decoder.decode(value, { stream: true });

      if (text) {
        yield createFlightScript(text);
      }
    }

    const remaining = decoder.decode();

    if (remaining) {
      yield createFlightScript(remaining);
    }
  }

  return Readable.from(generate());
}

function createFlightScript(text) {
  const payload = JSON.stringify([1, text]).replace(/</g, "\\u003c");

  return Buffer.from(`<script>self.__next_f.push(${payload})</script>`);
}

function createFlightInjectionTransform(flightStream) {
  let pulling = null;

  function startPulling(target) {
    if (pulling) {
      return pulling;
    }

    pulling = (async () => {
      // Let initial HTML shell go first.
      await new Promise((resolve) => setImmediate(resolve));

      for await (const flightChunk of flightStream) {
        target.push(flightChunk);
      }
    })();

    pulling.catch((error) => {
      target.destroy(error);
    });

    return pulling;
  }

  return new Transform({
    transform(htmlChunk, encoding, callback) {
      // HTML wins first.
      this.push(htmlChunk);

      // Once HTML starts flowing,
      // start forwarding Flight too.
      startPulling(this);

      callback();
    },

    flush(callback) {
      // HTML finished.
      // But don't end HTTP response until
      // Flight stream also finishes.
      startPulling(this).then(() => callback(), callback);
    },
  });
}

function createMoveClosingTagsTransform() {
  const closingTags = Buffer.from("</body></html>");

  let foundClosingTags = false;

  return new Transform({
    transform(chunk, encoding, callback) {
      if (foundClosingTags) {
        this.push(chunk);
        callback();
        return;
      }

      const index = chunk.indexOf(closingTags);

      if (index === -1) {
        this.push(chunk);
        callback();
        return;
      }

      foundClosingTags = true;

      // Everything before </body></html>
      this.push(chunk.subarray(0, index));

      // Preserve anything after them.
      const after = chunk.subarray(index + closingTags.length);

      if (after.length > 0) {
        this.push(after);
      }

      callback();
    },

    flush(callback) {
      if (foundClosingTags) {
        this.push(closingTags);
      }

      callback();
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
