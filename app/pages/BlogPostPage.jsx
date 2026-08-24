import { Suspense } from "react";

import { Post } from "../components/Post.jsx";

export function BlogPostPage({ postSlug }) {
  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <Post slug={postSlug} />
    </Suspense>
  );
}