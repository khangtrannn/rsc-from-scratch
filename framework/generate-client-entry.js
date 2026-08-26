import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { createClientChunkName } from "./client-chunk-name.js";

export async function generateClientEntry({
  clientBoundaries,
  outputFile,
}) {
  const moduleLoaders = clientBoundaries
    .map((boundary) => createModuleLoader(boundary, outputFile))
    .join(",\n");

  const source = [
    "export const clientModuleLoaders = {",
    moduleLoaders,
    "};",
    "",
  ].join("\n");

  await mkdir(dirname(outputFile), {
    recursive: true,
  });

  await writeFile(outputFile, source);

  return outputFile;
}

function createModuleLoader(boundary, outputFile) {
  const importSpecifier = createImportSpecifier(
    boundary.filePath,
    outputFile,
  );

  const chunkName = createClientChunkName(
    boundary.moduleId,
  );

  return [
    `  ${JSON.stringify(boundary.referenceId)}: () =>`,
    `    import(/* webpackChunkName: ${JSON.stringify(chunkName)} */ ${JSON.stringify(importSpecifier)})`,
  ].join("\n");
}

function createImportSpecifier(filePath, outputFile) {
  const relativePath = relative(
    dirname(outputFile),
    filePath,
  ).replaceAll("\\", "/");

  return relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;
}
