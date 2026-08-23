import { readFile } from "node:fs/promises";
import * as babel from "@babel/core";
import transformReactJsx from "@babel/plugin-transform-react-jsx";

const babelOptions = {
  babelrc: false,
  ignore: [/\/(build|node_modules)\//],
  plugins: [[transformReactJsx, { runtime: "automatic" }]],
};

export async function load(url, context, defaultLoad) {
  const isJsx = url.endsWith(".jsx");
  const result = isJsx
    ? { source: await readFile(new URL(url), "utf8"), format: "module" }
    : await defaultLoad(url, context, defaultLoad);

  if (result.format !== "module") {
    return result;
  }

  const transformed = await babel.transformAsync(result.source, {
    ...babelOptions,
    filename: url,
  });

  return {
    source: transformed?.code ?? result.source,
    format: "module",
    shortCircuit: isJsx,
  };
}
