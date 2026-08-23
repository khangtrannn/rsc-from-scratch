import { createServer } from "http";
import { readFile, readdir } from "fs/promises";
import escapeHtml from "escape-html";
import sanitizeFilename from "sanitize-filename";
import { Readable } from "node:stream";
import {
  renderToPipeableStream as renderToHTMLStream,
} from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { Suspense } from "react";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/.well-known/")) {
      res.statusCode = 404;
      return res.end();
    }

    if (url.pathname === "/client.js") {
      await sendScript(res, "./dist/client.js");
    } else if (url.pathname === "/rsc") {
      const pathname = url.searchParams.get("url") ?? "/";
      await proxyRSC(res, pathname);
    } else if (url.pathname === "/debug-rsc") {
      const pathname = url.searchParams.get("url") ?? "/";
      const model = await fetchRSCModel(pathname);

      console.dir(model, { depth: 4 });

      res.end("Decoded Flight. Check the 8080 terminal.");
    } else if (url.pathname === "/debug-ssr") {
      const pathname = url.searchParams.get("url") ?? "/";

      const model = await fetchRSCModel(pathname);

      res.setHeader("Content-Type", "text/html");

      const { pipe } = renderToHTMLStream(model, {
        onShellReady() {
          pipe(res);
        },
        onError(error) {
          console.error(error);
        },
      });
    } else if (url.searchParams.has("jsx")) {
      url.searchParams.delete("jsx"); // Keep the url passed to the <Router> clean
      await sendJSX(res, <Router url={url} />);
    } else {
      await sendHTML(res, <Router url={url} />);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8080);

function Router({ url, useSuspense = false }) {
  let page;

  if (url.pathname === "/") {
    page = <BlogIndexPage />;
  } else {
    const postSlug = sanitizeFilename(url.pathname.slice(1));
    page = <BlogPostPage postSlug={postSlug} />;
  }

  if (useSuspense) {
    page = <Suspense fallback={<p>Loading post...</p>}>{page}</Suspense>;
  }

  return <BlogLayout>{page}</BlogLayout>;
}

async function BlogIndexPage() {
  const postFiles = await readdir("./posts");
  const postSlugs = postFiles.map((file) =>
    file.slice(0, file.lastIndexOf(".")),
  );
  return (
    <section>
      <h1>Welcome to my blog</h1>
      <div>
        {postSlugs.map((slug) => (
          <Post key={slug} slug={slug} />
        ))}
      </div>
    </section>
  );
}

function BlogPostPage({ postSlug }) {
  return <Post slug={postSlug} />;
}

async function Post({ slug }) {
  let content;
  try {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    content = await readFile("./posts/" + slug + ".txt", "utf8");
  } catch (err) {
    throwNotFound(err);
  }
  return (
    <section>
      <h2>
        <a href={"/" + slug}>{slug}</a>
      </h2>
      <article>{content}</article>
    </section>
  );
}

function BlogLayout({ children }) {
  const author = "Jae Doe";
  return (
    <html>
      <head>
        <title>My blog</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <hr />
          <input />
          <hr />
        </nav>
        <main>{children}</main>
        <Footer author={author} />
      </body>
    </html>
  );
}

function Footer({ author }) {
  return (
    <footer>
      <hr />
      <p>
        <i>{`(c) ${author} ${new Date().getFullYear()}`}</i>
      </p>
    </footer>
  );
}

async function proxyRSC(res, pathname) {
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

async function fetchRSCModel(pathname) {
  const response = await fetch(
    `http://localhost:8081/rsc?url=${encodeURIComponent(pathname)}`,
  );

  if (!response.ok) {
    throw new Error(`RSC request failed: ${response.status}`);
  }

  const nodeStream = Readable.fromWeb(response.body);

  return createFromNodeStream(nodeStream, {
    moduleMap: {},
    moduleLoading: null,
    serverModuleMap: null,
  });
}

async function sendHTML(res, jsx) {
  let html = await renderJSXToHTML(jsx);

  // Serialize the JSX payload after the HTML to avoid blocking paint
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX, 2);

  html += `<script>window.__INITIAL_CLIENT_JSX_STRING__ = `;
  html += JSON.stringify(clientJSXString).replace(/</g, "\\u003c");
  html += `</script>`;

  html += `
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.2.8",
          "react-dom": "https://esm.sh/react-dom@19.2.8",
          "react-dom/client": "https://esm.sh/react-dom@19.2.8/client"
        }
      }
    </script>
    <script type="module" src="/client.js"></script>
  `;
  res.setHeader("Content-Type", "text/html");
  res.end(html);
}

async function sendJSX(res, jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX, 2); // Indent with two spaces
  res.setHeader("Content-Type", "application/json");
  res.end(clientJSXString);
}

async function sendScript(res, filename) {
  const content = await readFile(filename, "utf8");
  res.setHeader("Content-Type", "text/javascript");
  res.end(content);
}

function stringifyJSX(key, value) {
  if (value === Symbol.for("react.element")) {
    // Preserve the exact React element symbol across the JSON boundary.
    return "$RE";
  } else if (value === Symbol.for("react.transitional.element")) {
    return "$RTE";
  } else if (typeof value === "string" && value.startsWith("$")) {
    // To avoid clashes, prepend an extra $ to any string already starting with $.
    return "$" + value;
  } else {
    return value;
  }
}

function throwNotFound(cause) {
  const notFound = new Error("Not found.", { cause });
  notFound.statusCode = 404;
  throw notFound;
}

async function renderJSXToClientJSX(jsx) {
  if (
    typeof jsx === "string" ||
    typeof jsx === "number" ||
    typeof jsx === "boolean" ||
    jsx == null
  ) {
    // Don't need to do anything special with these types.
    return jsx;
  } else if (Array.isArray(jsx)) {
    // Process each item in an array.
    return Promise.all(jsx.map((child) => renderJSXToClientJSX(child)));
  } else if (jsx instanceof Promise) {
    // Resolve async values before attempting to serialize them.
    return renderJSXToClientJSX(await jsx);
  } else if (jsx != null && typeof jsx === "object") {
    if (
      jsx.$$typeof === Symbol.for("react.element") ||
      jsx.$$typeof === Symbol.for("react.transitional.element")
    ) {
      if (typeof jsx.type === "string") {
        // This is a component like <div />.
        // Go over its props to make sure they can be turned into JSON.
        return {
          ...jsx,
          props: await renderJSXToClientJSX(jsx.props),
        };
      } else if (typeof jsx.type === "function") {
        // This is a custom React component (like <Footer />).
        // Call its function, and repeat the procedure for the JSX it returns.
        const Component = jsx.type;
        const props = jsx.props;
        const returnedJsx = await Component(props);
        return renderJSXToClientJSX(returnedJsx);
      } else throw new Error("Not implemented.");
    } else {
      // This is an arbitrary object (for example, props, or something inside of them).
      // Go over every value inside, and process it too in case there's some JSX in it.
      return Object.fromEntries(
        await Promise.all(
          Object.entries(jsx).map(async ([propName, value]) => [
            propName,
            await renderJSXToClientJSX(value),
          ]),
        ),
      );
    }
  } else throw new Error("Not implemented");
}

async function renderJSXToHTML(jsx) {
  if (typeof jsx === "string" || typeof jsx === "number") {
    return escapeHtml(jsx);
  } else if (jsx == null || typeof jsx === "boolean") {
    return "";
  } else if (Array.isArray(jsx)) {
    const renderedChildren = await Promise.all(
      jsx.map((child) => renderJSXToHTML(child)),
    );
    return renderedChildren.join("");
  } else if (jsx instanceof Promise) {
    return renderJSXToHTML(await jsx);
  } else if (typeof jsx === "object") {
    if (
      jsx.$$typeof === Symbol.for("react.element") ||
      jsx.$$typeof === Symbol.for("react.transitional.element")
    ) {
      if (typeof jsx.type === "string") {
        let html = "<" + jsx.type;
        for (const propName in jsx.props) {
          if (jsx.props.hasOwnProperty(propName) && propName !== "children") {
            html += " ";
            html += propName;
            html += "=";
            html += escapeHtml(jsx.props[propName]);
          }
        }
        html += ">";
        html += await renderJSXToHTML(jsx.props.children);
        html += "</" + jsx.type + ">";
        return html;
      } else if (typeof jsx.type === "function") {
        const Component = jsx.type;
        const props = jsx.props;
        const returnedJsx = await Component(props);
        return renderJSXToHTML(returnedJsx);
      } else throw new Error("Not implemented.");
    } else throw new Error("Cannot render an object.");
  } else throw new Error("Not implemented.");
}
