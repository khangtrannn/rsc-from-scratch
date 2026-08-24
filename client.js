import { hydrateRoot } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client";

let currentPathname = window.location.pathname;
const rootPromise = bootstrap();

async function bootstrap() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      for (const chunk of window.__FLIGHT_CHUNKS__) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    }
  });

  const model = await createFromReadableStream(stream);

  return hydrateRoot(document, model);
}

async function navigate(pathname) {
  currentPathname = pathname;
  const clientJSX = await fetchClientJSX(pathname);
  const root = await rootPromise;

  if (pathname === currentPathname) {
    root.render(clientJSX);
  }
}

function fetchClientJSX(pathname) {
  return createFromFetch(
    fetch(`/rsc?url=${encodeURIComponent(pathname)}`)
  );
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
