import path from "node:path";
import webpack from "webpack";
import { createClientChunkName } from "./client-chunk-name.js";

const { Compilation, sources } = webpack;

const PLUGIN_NAME = "ClientManifestPlugin";

export class ClientManifestPlugin {
  constructor({ clientBoundaries, filename = "client-manifest.json" }) {
    this.clientBoundaries = clientBoundaries;
    this.filename = filename;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          const manifest = createClientManifest(
            compilation,
            this.clientBoundaries,
          );

          compilation.emitAsset(
            this.filename,
            new sources.RawSource(JSON.stringify(manifest, null, 2)),
          );
        },
      );
    });
  }
}

function createClientManifest(compilation, clientBoundaries) {
  const manifest = {};

  for (const boundary of clientBoundaries) {
    const chunkName = createClientChunkName(boundary.moduleId);

    const chunkGroup = compilation.namedChunkGroups.get(chunkName);

    if (!chunkGroup) {
      throw new Error(
        `Could not find chunk group for ${boundary.referenceId}.`,
      );
    }

    const module = findBoundaryModule(
      compilation,
      chunkGroup,
      boundary.filePath,
    );

    const moduleId = compilation.chunkGraph.getModuleId(module);

    if (moduleId == null) {
      throw new Error(
        `Could not determine module id for ${boundary.referenceId}.`,
      );
    }

    manifest[boundary.referenceId] = {
      id: moduleId,
      chunks: createChunkReferences(chunkGroup),
      name: boundary.exportName,
    };
  }

  return manifest;
}

function findBoundaryModule(compilation, chunkGroup, filePath) {
  const boundaryPath = path.resolve(filePath);

  for (const chunk of chunkGroup.chunks) {
    const modules = compilation.chunkGraph.getChunkModulesIterable(chunk);

    for (const module of modules) {
      if (module.resource && path.resolve(module.resource) === boundaryPath) {
        return module;
      }
    }
  }

  throw new Error(
    `Could not find client module ${filePath} in its chunk group.`,
  );
}

function createChunkReferences(chunkGroup) {
  const chunks = [];

  for (const chunk of chunkGroup.chunks) {
    const file = [...chunk.files].find(isJavaScriptChunk);

    if (!file) {
      continue;
    }

    chunks.push(chunk.id, file);
  }

  return chunks;
}

function isJavaScriptChunk(file) {
  return (
    (file.endsWith(".js") || file.endsWith(".mjs")) &&
    !file.includes(".hot-update.")
  );
}
