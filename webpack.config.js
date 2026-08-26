import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClientManifestPlugin } from "./framework/client-manifest-plugin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const common = {
  mode: "development",
  context: __dirname,
  devtool: false,
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            configFile: false,
            plugins: [
              [
                "@babel/plugin-transform-react-jsx",
                {
                  runtime: "automatic",
                },
              ],
            ],
          },
        },
      },
    ],
  },
  optimization: {
    moduleIds: "named",
    chunkIds: "named",
    concatenateModules: false,
    minimize: false,
  },
};

export function createWebpackConfigs({ clientBoundaries }) {
  return [
    {
      ...common,
      name: "browser",
      target: "web",
      entry: ["./client.js", "./.rsc/client-entry.js"],
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "client.js",
        chunkFilename: "chunks/[name].js",
        publicPath: "/",
      },
      plugins: [
        new ClientManifestPlugin({
          clientBoundaries,
        }),
      ],
    },
    {
      ...common,
      name: "ssr",
      target: "node",
      entry: ["./server.js", "./.rsc/ssr-entry.js"],
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "server.cjs",
      },
    },
  ];
}
