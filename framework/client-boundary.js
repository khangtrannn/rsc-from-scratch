import { parseAsync } from "@babel/core";
import { relative } from "node:path";

export async function analyzeClientBoundary({
  source,
  filePath,
  rootDir,
}) {
  const ast = await parseAsync(source, {
    filename: filePath,
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    parserOpts: {
      plugins: ['jsx']
    }
  });

  const isClientBoundary = ast.program.directives.some(
    (directive) => directive.value.value === 'use client',
  );

  if (!isClientBoundary) {
    return null;
  }

  const hasDefaultExport = ast.program.body.some(
    (statement) => statement.type === 'ExportDefaultDeclaration',
  );

  if (!hasDefaultExport) {
    throw new Error(
      `${filePath} uses "use client" but does not have a default export.`,
    );
  }

  const moduleId = createModuleId(filePath, rootDir);

  return {
    filePath,
    moduleId,
    exportName: 'default',
    referenceId: `${moduleId}#default`,
  };
}

function createModuleId(filePath, rootDir) {
  const relativePath = relative(rootDir, filePath).replaceAll('\\', '/');
  return `./${relativePath}`;
}
