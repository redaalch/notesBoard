import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST_ASSETS = path.join(ROOT, "dist", "assets");

function isVendorChunk(name) {
  return /^vendor-[^.]+-[^.]+\.js$/.test(name);
}

function parseVendorImports(code) {
  const imports = [];
  const re = /from\"\.\/([^\"]+)\"/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    const imported = match[1];
    if (imported.startsWith("vendor-") && imported.endsWith(".js")) {
      imports.push(imported);
    }
  }
  return Array.from(new Set(imports));
}

async function loadVendorGraph() {
  const entries = await fs.readdir(DIST_ASSETS, { withFileTypes: true });
  const vendorFiles = entries
    .filter((entry) => entry.isFile() && isVendorChunk(entry.name))
    .map((entry) => entry.name)
    .sort();

  const graph = new Map();
  for (const fileName of vendorFiles) {
    const fullPath = path.join(DIST_ASSETS, fileName);
    const source = await fs.readFile(fullPath, "utf8");
    const edges = parseVendorImports(source).filter((dep) =>
      vendorFiles.includes(dep),
    );
    graph.set(fileName, edges);
  }

  return graph;
}

function findCycle(graph) {
  const visited = new Set();
  const visiting = new Set();
  const stack = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return stack.slice(cycleStart).concat(node);
    }

    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);

    for (const dep of graph.get(node) ?? []) {
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }

  return null;
}

function formatGraph(graph) {
  return Array.from(graph.entries())
    .map(
      ([file, deps]) =>
        `${file} -> ${deps.length ? deps.join(", ") : "(none)"}`,
    )
    .join("\n");
}

async function main() {
  const graph = await loadVendorGraph();

  if (graph.size === 0) {
    throw new Error(
      "No vendor chunks found in dist/assets. Run `npm run build` first.",
    );
  }

  const cycle = findCycle(graph);
  const graphText = formatGraph(graph);

  if (cycle) {
    console.error("Vendor chunk cycle detected:");
    console.error(cycle.join(" -> "));
    console.error("\nCurrent vendor graph:");
    console.error(graphText);
    process.exit(1);
  }

  console.log("Vendor chunk graph verified (acyclic).");
  console.log(graphText);
}

main().catch((error) => {
  console.error("Vendor graph verification failed:", error.message || error);
  process.exit(1);
});
