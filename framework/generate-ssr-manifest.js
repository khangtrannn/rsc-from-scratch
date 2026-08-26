import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export async function generateSsrManifest({
  clientBoundaries,
  clientManifest,
  compilation,
  outputFile,
}) {
  const manifest = {};

  for (const boundary of clientBoundaries) {
    const clientReference =
      clientManifest[boundary.referenceId];

    if (!clientReference) {
      throw new Error(
        `Missing client manifest entry for ${boundary.referenceId}.`,
      );
    }

    const ssrModule = findModule(
      compilation,
      boundary.filePath,
    );

    const ssrModuleId =
      compilation.chunkGraph.getModuleId(
        ssrModule,
      );

    if (ssrModuleId == null) {
      throw new Error(
        `Could not determine SSR module id for ${boundary.referenceId}.`,
      );
    }

    manifest[clientReference.id] ??= {};

    manifest[clientReference.id][
      boundary.exportName
    ] = {
      id: ssrModuleId,
      chunks: [],
      name: boundary.exportName,
    };
  }

  await mkdir(path.dirname(outputFile), {
    recursive: true,
  });

  await writeFile(
    outputFile,
    JSON.stringify(manifest, null, 2),
  );

  return manifest;
}

function findModule(compilation, filePath) {
  const boundaryPath = path.resolve(filePath);

  for (const module of compilation.modules) {
    if (
      module.resource &&
      path.resolve(module.resource) === boundaryPath
    ) {
      return module;
    }
  }

  throw new Error(
    `Could not find ${filePath} in the SSR compilation.`,
  );
}