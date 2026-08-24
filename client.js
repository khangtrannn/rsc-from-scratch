import { hydrateRoot } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client";

let currentPathname = window.location.pathname;
const rootPromise = bootstrap();

async function bootstrap() {
  const stream = createInitialFlightStream();

  pumpInitialFlight().catch((error) => {
    window.__FLIGHT_QUEUE__.push({ type: 'error', value: error });
  });

  const model = await createFromReadableStream(stream);

  return hydrateRoot(document, model);
}

function createInitialFlightStream() {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const queue = window.__FLIGHT_QUEUE__;

      let closed = false;

      function handleEntry(entry) {
        if (closed) {
          return;
        }

        if (entry.type === 'chunk') {
          controller.enqueue(encoder.encode(entry.value));
        }

        if (entry.type === 'done') {
          closed = true;
          controller.close();
        }

        if (entry.type === 'error') {
          closed = true;
          controller.error(entry.value);
        }
      }

      // Consume everything that arrived before the client.js started.
      const existingEntries = [...queue];

      // Future pushes go directly into the ReadableStream.
      queue.push = handleEntry;

      for (const entry of existingEntries) {
        handleEntry(entry);
      }
    }
  });
}

async function pumpInitialFlight() {
  const response = await fetch(
    window.__INITIAL_FLIGHT_URL__,
  );

  if (!response.ok) {
    throw new Error(`Intial Flight request failed: ${response.status}`);
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });

    if (chunk) {
      window.__FLIGHT_QUEUE__.push({ type: 'chunk', value: chunk });
    }
  }

  const remaining = decoder.decode();

  if (remaining) {
    window.__FLIGHT_QUEUE__.push({ type: 'chunk', value: remaining });
  }

  window.__FLIGHT_QUEUE__.push({ type: 'done' });
}

function fetchClientJSX(pathname) {
  return createFromFetch(
    fetch(`/rsc?url=${encodeURIComponent(pathname)}`)
  );
}

async function navigate(pathname) {
  currentPathname = pathname;
  const clientJSX = await fetchClientJSX(pathname);
  const root = await rootPromise;

  if (pathname === currentPathname) {
    root.render(clientJSX);
  }
}

window.addEventListener(
  "click",
  (e) => {
    if (e.target.tagName !== "A") {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const href = e.target.getAttribute("href");
    if (!href.startsWith("/")) {
      return;
    }
    e.preventDefault();
    window.history.pushState(null, null, href);
    navigate(href);
  },
  true
);

window.addEventListener("popstate", () => {
  navigate(window.location.pathname);
});
