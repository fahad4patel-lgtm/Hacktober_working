import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGraphStatus, searchImpact } from "./lib/graph.js";
import { generateImpactReport } from "./lib/gemma.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "RepoRadar",
    gemmaConfigured: Boolean(process.env.GEMINI_API_KEY),
    graph: getGraphStatus()
  });
});

app.get("/api/graph", (_req, res) => {
  const result = searchImpact({ target: "", question: "", maxDepth: 2 });
  res.json({
    mode: result.mode,
    graphName: result.graphName,
    nodes: result.allNodes,
    edges: result.allEdges,
    stats: result.stats,
    notice: result.notice
  });
});

app.post("/api/impact", async (req, res) => {
  try {
    const target = String(req.body?.target || "").trim();
    const question = String(req.body?.question || "What could be affected by changing this component?").trim();
    if (!target) return res.status(400).json({ error: "Choose a function, file, or component first." });
    if (target.length > 200 || question.length > 1200) {
      return res.status(400).json({ error: "Target or question is too long." });
    }

    const graph = searchImpact({ target, question, maxDepth: 3 });
    const report = await generateImpactReport({ target, question, graph });

    res.json({
      target,
      question,
      report,
      graph: {
        mode: graph.mode,
        graphName: graph.graphName,
        nodes: graph.nodes,
        edges: graph.edges,
        stats: graph.stats,
        notice: graph.notice
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Impact request failed:", error);
    res.status(500).json({
      error: "The impact analysis failed.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

app.use(express.static(path.resolve(__dirname, "../dist")));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.resolve(__dirname, "../dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`RepoRadar API running at http://localhost:${PORT}`);
  console.log(`Graph source: ${getGraphStatus().mode}`);
});
