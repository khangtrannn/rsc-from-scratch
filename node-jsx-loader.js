import { readFile } from "node:fs/promises";
import * as babel from "@babel/core";
import transformReactJsx from "@babel/plugin-transform-react-jsx";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";

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

  if (isJsx && hasUseClientDirective(result.source)) {
    const moduleId = getClientModuleId(url);

    console.log(`[use client] ${moduleId}`);

    return {
      format: 'module',
      shortCircuit: true,
      source: `
        import { registerClientReference } from 'react-server-dom-webpack/server';

        export default registerClientReference(
          function () {
            throw new Error('Cannot call a Client Component from the RSC server.');
          },
          ${JSON.stringify(moduleId)},
          'default',
        );
      `,
    }
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

function hasUseClientDirective(source) {
  return /^\s*["']use client["']\s*;?/.test(source);
}

function getClientModuleId(url) {
  const filename = fileURLToPath(url);

  const relativePath = relative(
    process.cwd(),
    filename
  ).replaceAll("\\", "/");

  return `./${relativePath}`;
}