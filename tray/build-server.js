const { build } = require("esbuild");
const path = require("path");

const serverRoot = path.join(__dirname, "..");

build({
  entryPoints: [path.join(serverRoot, "src/server/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(__dirname, "resources/server.cjs"),
  // Keep native/npm modules external — copied alongside as node_modules
  external: [
    "pg",
    "pg-native",
    "@prisma/adapter-pg",
  ],
  define: {
    "import.meta.url": "__importMetaUrl",
  },
  banner: {
    js: `
const __importMetaUrl = require('url').pathToFileURL(__filename).href;
`,
  },
}).then(() => {
  console.log("Server bundled → resources/server.cjs");
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
