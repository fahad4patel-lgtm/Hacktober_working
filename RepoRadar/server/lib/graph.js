import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const graphPath = process.env.GRAPHIFY_GRAPH_PATH
  ? path.resolve(process.env.GRAPHIFY_GRAPH_PATH)
  : path.join(projectRoot, "graphify-out", "graph.json");

const sample = {
  name: "Sample Commerce App",
  nodes: [
    { id: "src/server.js", label: "server.js", type: "file", description: "Express application entry point" },
    { id: "src/routes/orders.js", label: "orders.js", type: "file", description: "Order API routes" },
    { id: "src/services/orderService.js", label: "orderService.js", type: "file", description: "Business logic for orders" },
    { id: "src/db/connection.js", label: "connection.js", type: "file", description: "Creates the database connection pool" },
    { id: "src/repositories/orderRepository.js", label: "orderRepository.js", type: "file", description: "Database queries for orders" },
    { id: "src/controllers/orderController.js", label: "orderController.js", type: "file", description: "Handles incoming order requests" },
    { id: "src/services/paymentService.js", label: "paymentService.js", type: "file", description: "Payment processing" },
    { id: "tests/orderService.test.js", label: "orderService.test.js", type: "test", description: "Tests order creation and retrieval" },
    { id: "src/config/env.js", label: "env.js", type: "file", description: "Loads environment configuration" }
  ],
  edges: [
    { source: "src/server.js", target: "src/routes/orders.js", label: "registers route" },
    { source: "src/routes/orders.js", target: "src/controllers/orderController.js", label: "calls" },
    { source: "src/controllers/orderController.js", target: "src/services/orderService.js", label: "calls" },
    { source: "src/services/orderService.js", target: "src/repositories/orderRepository.js", label: "uses" },
    { source: "src/repositories/orderRepository.js", target: "src/db/connection.js", label: "imports" },
    { source: "src/db/connection.js", target: "src/config/env.js", label: "reads config" },
    { source: "src/services/orderService.js", target: "src/services/paymentService.js", label: "calls" },
    { source: "tests/orderService.test.js", target: "src/services/orderService.js", label: "tests" }
  ]
};

function firstDefined(obj, keys) {
  for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  return undefined;
}

function normalizeGraph(raw) {
  // Accommodates common node/edge JSON graph formats. Graphify output schemas can evolve;
  // if a schema is unfamiliar, the demo graph remains available rather than crashing.
  const rawNodes = firstDefined(raw, ["nodes", "vertices", "entities"]) || [];
  const rawEdges = firstDefined(raw, ["edges", "links", "relationships", "relations"]) || [];
  const nodes = [];
  const idMap = new Map();

  for (const item of rawNodes) {
    if (!item || typeof item !== "object") continue;
    const id = String(firstDefined(item, ["id", "key", "name", "path", "qualified_name"]) ?? "");
    if (!id) continue;
    const label = String(firstDefined(item, ["label", "name", "title", "symbol", "path"]) ?? id.split(/[/.#]/).filter(Boolean).pop() ?? id);
    const node = {
      id,
      label,
      type: String(firstDefined(item, ["type", "kind", "category"]) ?? "code"),
      description: String(firstDefined(item, ["description", "docstring", "summary"]) ?? ""),
      path: String(firstDefined(item, ["path", "file", "filename"]) ?? id)
    };
    nodes.push(node);
    idMap.set(id, id);
    idMap.set(label, id);
  }

  const edges = [];
  for (const item of rawEdges) {
    if (!item || typeof item !== "object") continue;
    const sourceRaw = firstDefined(item, ["source", "from", "src", "start", "source_id"]);
    const targetRaw = firstDefined(item, ["target", "to", "dst", "end", "target_id"]);
    const source = typeof sourceRaw === "object" ? String(firstDefined(sourceRaw, ["id", "name", "key"]) ?? "") : String(sourceRaw ?? "");
    const target = typeof targetRaw === "object" ? String(firstDefined(targetRaw, ["id", "name", "key"]) ?? "") : String(targetRaw ?? "");
    if (!source || !target) continue;
    edges.push({
      source: idMap.get(source) || source,
      target: idMap.get(target) || target,
      label: String(firstDefined(item, ["label", "type", "kind", "relationship"]) ?? "related")
    });
  }

  if (nodes.length === 0) throw new Error("No recognizable nodes in graph JSON");
  const nodeIds = new Set(nodes.map(n => n.id));
  const cleanEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  return { name: String(raw.name || raw.title || "Graphify codebase"), nodes, edges: cleanEdges };
}

function loadGraph() {
  try {
    if (fs.existsSync(graphPath)) {
      const raw = JSON.parse(fs.readFileSync(graphPath, "utf8"));
      return { graph: normalizeGraph(raw), mode: "graphify", notice: `Loaded graph from ${graphPath}` };
    }
  } catch (error) {
    return { graph: sample, mode: "sample", notice: `Could not parse Graphify graph (${error.message}); using the included demo graph.` };
  }
  return {
    graph: sample,
    mode: "sample",
    notice: `No Graphify graph found at ${graphPath}. Showing the included demo graph until Graphify is configured.`
  };
}

export function getGraphStatus() {
  const loaded = loadGraph();
  return {
    mode: loaded.mode,
    graphName: loaded.graph.name,
    nodeCount: loaded.graph.nodes.length,
    edgeCount: loaded.graph.edges.length,
    graphPath,
    notice: loaded.notice
  };
}

function nodeMatches(node, target) {
  const q = target.toLowerCase();
  return node.id.toLowerCase().includes(q) ||
    node.label.toLowerCase().includes(q) ||
    node.path.toLowerCase().includes(q) ||
    node.description.toLowerCase().includes(q);
}

export function searchImpact({ target, question, maxDepth = 3 }) {
  const loaded = loadGraph();
  const allNodes = loaded.graph.nodes;
  const allEdges = loaded.graph.edges;
  const matches = target ? allNodes.filter(n => nodeMatches(n, target)) : allNodes;
  const chosen = matches[0] || allNodes[0];
  const seedIds = target ? (matches.length ? matches.slice(0, 3).map(n => n.id) : [chosen?.id].filter(Boolean)) : allNodes.slice(0, 8).map(n => n.id);

  const adjacency = new Map(allNodes.map(n => [n.id, []]));
  for (const edge of allEdges) {
    adjacency.get(edge.source)?.push({ id: edge.target, edge, direction: "outgoing" });
    adjacency.get(edge.target)?.push({ id: edge.source, edge, direction: "incoming" });
  }

  const seen = new Set(seedIds);
  const queue = seedIds.map(id => ({ id, depth: 0 }));
  const selectedEdges = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const next of (adjacency.get(current.id) || [])) {
      if (!seen.has(next.id)) {
        seen.add(next.id);
        queue.push({ id: next.id, depth: current.depth + 1 });
      }
      if (!selectedEdges.some(e => e.source === next.edge.source && e.target === next.edge.target)) {
        selectedEdges.push(next.edge);
      }
    }
  }

  const selectedNodes = allNodes.filter(n => seen.has(n.id));
  const relevantEdges = selectedEdges.filter(e => seen.has(e.source) && seen.has(e.target));
  return {
    mode: loaded.mode,
    graphName: loaded.graph.name,
    notice: loaded.notice,
    targetNode: chosen || null,
    matchedNodes: matches.slice(0, 5),
    nodes: selectedNodes.slice(0, 35),
    edges: relevantEdges.slice(0, 70),
    allNodes,
    allEdges,
    stats: { totalNodes: allNodes.length, totalEdges: allEdges.length, matchedNodes: matches.length, relevantNodes: selectedNodes.length, relevantEdges: relevantEdges.length },
    evidence: relevantEdges.map(e => {
      const s = allNodes.find(n => n.id === e.source);
      const t = allNodes.find(n => n.id === e.target);
      return { source: e.source, sourceLabel: s?.label || e.source, target: e.target, targetLabel: t?.label || e.target, relationship: e.label };
    }).slice(0, 30)
  };
}
