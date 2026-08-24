import { readdir } from "node:fs/promises";
import { Suspense } from "react";

import { Post } from "../components/Post.jsx";

export function BlogIndexPage() {
  return (
    <section>
      <h1>Welcome to my blog</h1>

      <Suspense fallback={<p>Loading posts...</p>}>
        <PostList />
      </Suspense>
    </section>
  );
}

async function PostList() {
  const postFiles = await readdir("./posts");

  const postSlugs = postFiles.map((file) =>
    file.slice(0, file.lastIndexOf(".")),
  );

  return (
    <div>
      {postSlugs.map((slug) => (
        <Post key={slug} slug={slug} />
      ))}
    </div>
  );
}