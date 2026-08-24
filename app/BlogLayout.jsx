import { Footer } from "./components/Footer.jsx";

export function BlogLayout({ children }) {
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