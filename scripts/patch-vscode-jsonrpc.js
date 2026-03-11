/**
 * Patches vscode-jsonrpc to add an "exports" map so that
 * `import "vscode-jsonrpc/node"` resolves correctly in ESM on Node 20.
 *
 * The @github/copilot-sdk imports "vscode-jsonrpc/node" (without .js)
 * which fails without an exports map on Node <22.
 */
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "node_modules", "vscode-jsonrpc", "package.json");

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  if (pkg.exports) {
    // Already has exports — nothing to do
    return;
  }

  pkg.exports = {
    ".": "./lib/node/main.js",
    "./node": "./node.js",
    "./node.js": "./node.js",
    "./browser": "./lib/browser/main.js",
    "./lib/*": "./lib/*",
  };

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
  console.log("[patch] Added exports map to vscode-jsonrpc/package.json");
} catch (err) {
  // Not a fatal error — only needed when using @github/copilot-sdk
  if (err.code !== "ENOENT") {
    console.warn("[patch] Could not patch vscode-jsonrpc:", err.message);
  }
}
