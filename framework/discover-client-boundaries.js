import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative } from "node:path";
import { analyzeClientBoundary } from "./client-boundary.js";

const sourceExtensions = new Set([".js", ".jsx"]);

export async function discoverClientBoundaries({ entryPoint, rootDir }) {
  const clientBoundaries = new Map();

  await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    packages: "external",
    conditions: ["react-server"],
    logLevel: "silent",
    plugins: [
      createClientBoundaryPlugin({
        rootDir,
        clientBoundaries,
      }),
    ],
  });

  return [...clientBoundaries.values()].sort((left, right) =>
    left.referenceId.localeCompare(right.referenceId),
  );
}

function createClientBoundaryPlugin({ rootDir, clientBoundaries }) {
  return {
    name: "client-boundary-discovery",

    setup(buildContext) {
      buildContext.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData?.isDelegatedResolution) {
          return;
        }

        const resolved = await buildContext.resolve(args.path, {
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: { isDelegatedResolution: true },
        });

        if (
          resolved.errors.length > 0 ||
          resolved.external ||
          !resolved.path ||
          !isSourceModule(resolved.path) ||
          !isInsideRoot(resolved.path, rootDir)
        ) {
          return;
        }

        const source = await readFile(resolved.path, "utf8");

        const clientBoundary = await analyzeClientBoundary({
          source,
          filePath: resolved.path,
          rootDir,
        });

        if (!clientBoundary) {
          return;
        }

        clientBoundaries.set(clientBoundary.referenceId, clientBoundary);

        return {
          path: resolved.path,
          external: true,
        };
      });
    },
  };
}

function isSourceModule(filePath) {
  return sourceExtensions.has(extname(filePath));
}

function isInsideRoot(filePath, rootDir) {
  const relativePath = relative(rootDir, filePath);

  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
}
