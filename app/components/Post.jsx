import { readFile } from "node:fs/promises";

export async function Post({ slug }) {
  let content;

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    content = await readFile(
      `./posts/${slug}.txt`,
      "utf8",
    );
  } catch (error) {
    throwNotFound(error);
  }

  return (
    <section>
      <h2>
        <a href={`/${slug}`}>{slug}</a>
      </h2>

      <article>{content}</article>
    </section>
  );
}

function throwNotFound(cause) {
  const error = new Error("Not found.", {
    cause,
  });

  error.statusCode = 404;

  throw error;
}