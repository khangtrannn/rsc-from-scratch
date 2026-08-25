import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: "development",

  entry: "./client.js",

  target: "web",

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            plugins: [
              [
                "@babel/plugin-transform-react-jsx",
                { runtime: "automatic" },
              ],
            ],
          },
        },
      },
    ],
  },

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "client.js",
    clean: true,
  },
};
