import path from "node:path";
import { fileURLToPath } from "node:url";

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
              ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],
            ],
          },
        },
      },
    ],
  },

  optimization: {
    moduleIds: "named",
    concatenateModules: false,
    minimize: false,
  },
};

export default [
  {
    ...common,
    name: "browser",
    target: "web",
    entry: "./client.js",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "client.js",
    },
  },
  {
    ...common,
    name: "ssr",
    target: "node",
    entry: "./server.js",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "server.cjs",
    },
  },
];
