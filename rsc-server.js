import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import sanitizeFilename from "sanitize-filename";
import { Suspense } from "react";
import {
  renderToPipeableStream as renderToFlightStream,
} from "react-server-dom-webpack/server";

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname !== "/rsc") {
      res.statusCode = 404;
      return res.end();
    }

    const targetUrl = new URL(
      url.searchParams.get("url") ?? "/",
      `http://${req.headers.host}`
    );

    sendRSC(res, <Router url={targetUrl} useSuspense />);
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8081, () => {
  console.log("RSC server listening on http://localhost:8081");
});

function sendRSC(res, jsx) {
  res.setHeader("Content-Type", "text/x-component");

  const stream = renderToFlightStream(jsx, {});
  stream.pipe(res);
}

function Router({ url, useSuspense = false }) {
  let page;

  if (url.pathname === "/") {
    page = <BlogIndexPage />;
  } else {
    const postSlug = sanitizeFilename(url.pathname.slice(1));
    page = <BlogPostPage postSlug={postSlug} />;
  }

  if (useSuspense) {
    page = (
      <Suspense fallback={<p>Loading post...</p>}>
        {page}
      </Suspense>
    );
  }

  return <BlogLayout>{page}</BlogLayout>;
}

async function BlogIndexPage() {
  const postFiles = await readdir("./posts");
  const postSlugs = postFiles.map((file) =>
    file.slice(0, file.lastIndexOf("."))
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

function throwNotFound(cause) {
  const notFound = new Error("Not found.", { cause });
  notFound.statusCode = 404;
  throw notFound;
}
