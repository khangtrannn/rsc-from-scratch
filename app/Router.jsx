import sanitizeFilename from "sanitize-filename";

import { BlogLayout } from "./BlogLayout.jsx";
import { BlogIndexPage } from "./pages/BlogIndexPage.jsx";
import { BlogPostPage } from "./pages/BlogPostPage.jsx";

export function Router({ url }) {
  let page;

  if (url.pathname === "/") {
    page = <BlogIndexPage />;
  } else {
    const postSlug = sanitizeFilename(url.pathname.slice(1));

    page = <BlogPostPage postSlug={postSlug} />;
  }

  return <BlogLayout>{page}</BlogLayout>;
}