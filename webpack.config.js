import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: "development",

  entry: "./client.js",

  target: "web",

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "client.js",
    clean: true,
  },
};