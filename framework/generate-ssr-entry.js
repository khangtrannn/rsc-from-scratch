import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

export async function generateSsrEntry({ clientBoundaries, outputFile }) {
  const imports = clientBoundaries
    .map((boundary) => createImportStatement(boundary.filePath, outputFile))
    .join("\n");

  await mkdir(dirname(outputFile), {
    recursive: true,
  });

  await writeFile(outputFile, `${imports}\n`);

  return outputFile;
}

function createImportStatement(filePath, outputFile) {
  const importSpecifier = createImportSpecifier(filePath, outputFile);

  return `import ${JSON.stringify(importSpecifier)};`;
}

function createImportSpecifier(filePath, outputFile) {
  const relativePath = relative(dirname(outputFile), filePath).replaceAll(
    "\\",
    "/",
  );

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
