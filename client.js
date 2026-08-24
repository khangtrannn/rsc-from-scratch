import { hydrateRoot } from "react-dom/client";
import { createFromFetch } from "react-server-dom-webpack/client";

let currentPathname = window.location.pathname;
let root;

bootstrap();

async function bootstrap() {
  if (window.__INITIAL_FLIGHT__) {
    const model = await createFromFetch(
      Promise.resolve(
        new Response(window.__INITIAL_FLIGHT__, {
          headers: {
            'Content-Type': 'text/x-component'
          }
        }),
      ),
    );

    root = hydrateRoot(document, model);
  }
}

async function navigate(pathname) {
  currentPathname = pathname;
  const clientJSX = await fetchClientJSX(pathname);
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
