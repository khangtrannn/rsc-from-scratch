import React, { startTransition, use } from "react";

import { hydrateRoot } from "react-dom/client";
import "./app/components/Counter.jsx";

import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client.browser";

/**
 * ============================================================
 * Initial RSC stream
 *
 * Server sends Flight inside HTML:
 *
 *   self.__next_f.push([0])
 *   self.__next_f.push([1, "...flight chunk..."])
 *
 * We turn those pushes back into a ReadableStream.
 * ============================================================
 */

const encoder = new TextEncoder();

let flightController = null;
let bufferedFlightChunks = [];
let initialFlightComplete = false;

/**
 * Handle:
 * [0]
 * [1, "flight payload"]
 */
function handleFlightSegment(segment) {
  const type = segment[0];

  console.log("[__next_f.push]", segment);

  // Bootstrap marker.
  if (type === 0) {
    return;
  }

  // Text Flight payload.
  if (type === 1) {
    const text = segment[1];
    const bytes = encoder.encode(text);

    if (flightController) {
      flightController.enqueue(bytes);
    } else {
      /**
       * client.js may not have initialized the ReadableStream yet.
       * Keep these chunks temporarily.
       */
      bufferedFlightChunks.push(bytes);
    }

    return;
  }

  console.warn("Unknown Flight segment type:", segment);
}

/**
 * ============================================================
 * Connect to server-created __next_f queue
 * ============================================================
 */

const flightQueue = (window.__next_f = window.__next_f || []);

/**
 * Some inline scripts may have executed before client.js:
 *
 *   self.__next_f.push(...)
 *
 * At that point __next_f was still just an Array.
 *
 * Consume those buffered segments first.
 */
for (const segment of flightQueue) {
  handleFlightSegment(segment);
}

flightQueue.length = 0;

/**
 * From this point forward:
 *
 *   self.__next_f.push(segment)
 *
 * becomes:
 *
 *   handleFlightSegment(segment)
 *
 * instead of normal Array.push().
 */
flightQueue.push = handleFlightSegment;

/**
 * ============================================================
 * Reconstruct initial Flight ReadableStream
 * ============================================================
 */

const initialFlightStream = new ReadableStream({
  start(controller) {
    flightController = controller;

    /**
     * Flush anything that arrived before
     * this stream existed.
     */
    for (const chunk of bufferedFlightChunks) {
      controller.enqueue(chunk);
    }

    bufferedFlightChunks = [];

    /**
     * It is possible client.js executes
     * after the document has already finished.
     */
    if (initialFlightComplete) {
      controller.close();
    }
  },
});

/**
 * Our server guarantees:
 *
 *   all Flight scripts
 *        ↓
 *   </body></html>
 *
 * Therefore once the browser finishes parsing this document,
 * there cannot be any more initial Flight chunks.
 */
function finishInitialFlight() {
  if (initialFlightComplete) {
    return;
  }

  initialFlightComplete = true;

  if (flightController) {
    flightController.close();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", finishInitialFlight, {
    once: true,
  });
} else {
  finishInitialFlight();
}

/**
 * ============================================================
 * Decode initial RSC model
 * ============================================================
 */

const initialModel = createFromReadableStream(initialFlightStream);

/**
 * ============================================================
 * Stable client root
 *
 * IMPORTANT:
 *
 * Initial:
 *
 *   <Root model={initialModel} />
 *
 * Navigation:
 *
 *   <Root model={nextModel} />
 *
 * Root component type never changes.
 *
 * This allows React reconciliation to preserve layouts,
 * DOM nodes, component state, uncontrolled inputs, etc.
 * ============================================================
 */

function Root({ model }) {
  return use(model);
}

/**
 * If your RSC tree renders:
 *
 *   <html>
 *     <body>
 *       ...
 *
 * hydrate the document itself.
 */
const root = hydrateRoot(document, <Root model={initialModel} />);

/**
 * ============================================================
 * Client navigation
 * ============================================================
 */

let currentPathname = window.location.pathname;

/**
 * Request a new Flight payload.
 *
 * Notice:
 *
 * Initial load:
 *   HTML document
 *     ↓
 *   __next_f
 *     ↓
 *   ReadableStream
 *
 * Navigation:
 *   GET /rsc
 *     ↓
 *   HTTP Flight stream
 *
 * Both eventually produce the same thing:
 *
 *   RSC model
 */
function fetchRSC(pathname) {
  return createFromFetch(
    fetch(`/rsc?url=${encodeURIComponent(pathname)}`, {
      headers: {
        Accept: "text/x-component",
      },
    }),
  );
}

function navigate(pathname, { pushState = true } = {}) {
  /**
   * Start fetching immediately.
   * createFromFetch returns the React Flight thenable/model.
   */
  const nextModel = fetchRSC(pathname);

  if (pushState) {
    window.history.pushState(null, "", pathname);
  }

  currentPathname = pathname;

  startTransition(() => {
    root.render(<Root model={nextModel} />);
  });
}

/**
 * ============================================================
 * Link interception
 * ============================================================
 */

document.addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  if (event.button !== 0) {
    return;
  }

  const anchor = event.target.closest("a");

  if (!anchor) {
    return;
  }

  if (anchor.target && anchor.target !== "_self") {
    return;
  }

  if (anchor.hasAttribute("download")) {
    return;
  }

  const url = new URL(anchor.href, window.location.href);

  if (url.origin !== window.location.origin) {
    return;
  }

  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  ) {
    return;
  }

  event.preventDefault();

  const pathname = `${url.pathname}${url.search}`;

  if (pathname === `${window.location.pathname}${window.location.search}`) {
    return;
  }

  navigate(pathname);
});

window.addEventListener("popstate", () => {
  const pathname = `${window.location.pathname}${window.location.search}`;

  if (pathname === currentPathname) {
    return;
  }

  navigate(pathname, {
    pushState: false,
  });
});
