import { hydrateRoot } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client";

let currentPathname = window.location.pathname;

const rootPromise = bootstrap();

async function bootstrap() {
  const model = await createFromFetch(
    Promise.resolve(
      new Response(window.__INITIAL_FLIGHT__, {
        headers: {
          "Content-Type": "text/x-component",
        },
      }),
    ),
  );

  return hydrateRoot(document, model);
}

/**
 * Client-side navigation.
 *
 * Unlike the initial page load, navigation doesn't need SSR HTML.
 * We fetch Flight directly from /rsc.
 */
function fetchFlightModel(pathname) {
  return createFromFetch(fetch(`/rsc?url=${encodeURIComponent(pathname)}`));
}

async function navigate(pathname) {
  currentPathname = pathname;

  const model = await fetchFlightModel(pathname);
  const root = await rootPromise;

  // Ignore stale navigation responses.
  if (pathname === currentPathname) {
    root.render(model);
  }
}

window.addEventListener(
  "click",
  (event) => {
    if (event.target.tagName !== "A") {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const href = event.target.getAttribute("href");

    if (!href?.startsWith("/")) {
      return;
    }

    event.preventDefault();

    window.history.pushState(null, null, href);

    navigate(href);
  },
  true,
);

window.addEventListener("popstate", () => {
  navigate(window.location.pathname);
});
