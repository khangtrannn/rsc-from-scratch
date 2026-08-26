import path from "node:path";
import { readFile, rm } from "node:fs/promises";
import webpack from "webpack";
import { discoverClientBoundaries } from "./framework/discover-client-boundaries.js";
import { generateClientEntry } from "./framework/generate-client-entry.js";
import { generateSsrEntry } from "./framework/generate-ssr-entry.js";
import { generateSsrManifest } from "./framework/generate-ssr-manifest.js";
import { createWebpackConfigs } from "./webpack.config.js";

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, "dist");
const generatedDir = path.resolve(rootDir, ".rsc");

const clientBoundaries = await discoverClientBoundaries({
  entryPoint: path.resolve(rootDir, "app/Router.jsx"),
  rootDir,
});

printClientBoundaries(clientBoundaries);

const clientEntryFile = await generateClientEntry({
  clientBoundaries,
  outputFile: path.resolve(generatedDir, "client-entry.js"),
});

const ssrEntryFile = await generateSsrEntry({
  clientBoundaries,
  outputFile: path.resolve(generatedDir, "ssr-entry.js"),
});

console.log(`Generated client entry: ${clientEntryFile}`);
console.log(`Generated SSR entry: ${ssrEntryFile}`);

await cleanDist(distDir);

const webpackConfigs = createWebpackConfigs({
  clientBoundaries,
});

const webpackStats = await compile(webpackConfigs);

const clientManifest = await readJson(
  path.resolve(distDir, "client-manifest.json"),
);

const ssrCompilation = getCompilation(webpackStats, "ssr");

await generateSsrManifest({
  clientBoundaries,
  clientManifest,
  compilation: ssrCompilation,
  outputFile: path.resolve(distDir, "ssr-manifest.json"),
});

console.log("Generated SSR manifest.");

function printClientBoundaries(clientBoundaries) {
  console.log("Discovered client boundaries:");

  for (const boundary of clientBoundaries) {
    console.log(`- ${boundary.referenceId}`);
  }
}

async function cleanDist(distDir) {
  await rm(distDir, {
    recursive: true,
    force: true,
  });
}

function compile(configs) {
  return new Promise((resolve, reject) => {
    webpack(
      configs,
      (error, stats) => {
        if (error) {
          reject(error);
          return;
        }

        if (!stats) {
          reject(new Error("Webpack did not return build stats."));
          return;
        }

        if (stats.hasErrors()) {
          reject(
            new Error(
              stats.toString({
                colors: true,
                errors: true,
                warnings: true,
              }),
            ),
          );

          return;
        }

        console.log(
          stats.toString({
            colors: true,
            chunks: false,
            modules: false,
          }),
        );

        resolve(stats);
      },
    );
  });
}

function getCompilation(webpackStats, name) {
  const childStats = webpackStats.stats.find(
    ({ compilation }) => compilation.options.name === name,
  );

  if (!childStats) {
    throw new Error(`Missing Webpack compilation: ${name}`);
  }

  return childStats.compilation;
}

async function readJson(filePath) {
  const source = await readFile(filePath, "utf8");
  return JSON.parse(source);
}
