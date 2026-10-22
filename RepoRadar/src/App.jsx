import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, BrainCircuit, Check,
  ChevronDown, CircleDot, Code2, Copy, FileCode2, GitBranch, Github,
  LoaderCircle, Network, RefreshCw, Search, ShieldCheck, Sparkles, Terminal,
  Waypoints, Zap
} from "lucide-react";

const API = "/api";

function prettyRisk(risk) {
  const value = String(risk || "unknown").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function makeFlow(nodes = [], edges = []) {
  const width = 210;
  const height = 90;
  const columns = 3;
  const flowNodes = nodes.slice(0, 24).map((node, i) => ({
    id: node.id,
    position: { x: (i % columns) * 245, y: Math.floor(i / columns) * 145 },
    data: { label: <div className="flow-node-content"><span className="flow-node-type">{node.type || "CODE"}</span><strong>{node.label || node.id}</strong><small>{node.path || node.id}</small></div> },
    style: {
      width,
      minHeight: height,
      borderRadius: 13,
      border: i === 0 ? "1px solid #a78bfa" : "1px solid #29344b",
      background: i === 0 ? "#292344" : "#131c2d",
      color: "#e8edfa",
      padding: 10,
      boxShadow: i === 0 ? "0 0 0 2px #8b5cf622" : "none"
    }
  }));
  const ids = new Set(nodes.map(n => n.id));
  const flowEdges = edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 55).map((edge, i) => ({
    id: `${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
    style: { stroke: "#64748b", strokeWidth: 1.5 },
    labelStyle: { fill: "#aebbd0", fontSize: 10 },
    labelBgStyle: { fill: "#0e1626", fillOpacity: 0.92 }
  }));
  return { nodes: flowNodes, edges: flowEdges };
}

function App() {
  const [health, setHealth] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [target, setTarget] = useState("src/db/connection.js");
  const [question, setQuestion] = useState("If I change the database connection function, what parts of the app could be affected and what should I test?");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("impact");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  async function refresh() {
    try {
      const [h, g] = await Promise.all([
        fetch(`${API}/health`).then(r => r.json()),
        fetch(`${API}/graph`).then(r => r.json())
      ]);
      setHealth(h);
      setGraph(g);
      if (g.nodes?.length && !g.nodes.some(n => n.id === target)) {
        setTarget(g.nodes.find(n => /connection|database|service/i.test(n.label))?.id || g.nodes[0].id);
      }
    } catch {
      setError("Can't reach the backend. Run npm run dev from the project folder.");
    }
  }

  useEffect(() => { refresh(); }, []);

  async function analyze(nextTarget = target) {
    setLoading(true);
    setError("");
    setActiveTab("impact");
    try {
      const response = await fetch(`${API}/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: nextTarget, question })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
      setGraph(prev => ({ ...prev, nodes: data.graph.nodes, edges: data.graph.edges, mode: data.graph.mode, notice: data.graph.notice }));
    } catch (e) {
      setError(e.message || "Could not complete the analysis.");
    } finally {
      setLoading(false);
    }
  }

  const flow = useMemo(() => makeFlow(graph.nodes, graph.edges), [graph.nodes, graph.edges]);
  const filteredNodes = useMemo(() => graph.nodes.filter(n =>
    `${n.label} ${n.id} ${n.type}`.toLowerCase().includes(search.toLowerCase())
  ), [graph.nodes, search]);

  async function copyReport() {
    if (!result) return;
    const report = [
      `RepoRadar Impact Report: ${result.target}`,
      result.report.summary,
      `Risk: ${prettyRisk(result.report.risk)} | Confidence: ${result.report.confidence}`,
      "",
      "Findings:",
      ...(result.report.findings || []).map((f, i) => `${i + 1}. ${f.title}: ${f.detail}\nEvidence: ${f.evidence || "Not provided"}`),
      "",
      "Suggested test plan:",
      ...(result.report.testPlan || []).map((s, i) => `${i + 1}. ${s}`),
      "",
      "Limitations: Static graph evidence does not prove runtime behavior."
    ].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setError("Clipboard access failed. Select and copy the report manually."); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Waypoints size={21} /></div>
          <div><div className="brand-name">RepoRadar</div><div className="brand-caption">CHANGE IMPACT INTELLIGENCE</div></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="repo-card">
          <div className="repo-icon"><Code2 size={17} /></div>
          <div className="repo-meta"><strong>{health?.graph?.graphName || "Loading repository…"}</strong><span>{health?.graph?.mode === "graphify" ? "Graphify graph loaded" : "Demo repository"}</span></div>
          <span className="status-dot" />
        </div>
        <div className="side-nav">
          <div className="nav-item active"><Activity size={17} /><span>Impact analysis</span></div>
          <div className="nav-item"><Network size={17} /><span>Code graph</span><span className="nav-count">{graph.nodes?.length || 0}</span></div>
        </div>
        <div className="sidebar-bottom">
          <div className="stack-label">POWERED BY</div>
          <div className="tech-chip"><Network size={14} /><span>Graphify</span><span className="chip-role">STRUCTURE</span></div>
          <div className="tech-chip"><BrainCircuit size={14} /><span>Gemma 4</span><span className="chip-role">ANALYSIS</span></div>
          <div className="sidebar-note"><ShieldCheck size={15} /><span>Evidence-first analysis. No claim is treated as verified unless tested.</span></div>
          <div className="sidebar-footer"><span className="online-dot" /> Local workspace <span className="version">v1.0.0</span></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>Impact analysis</strong></div>
          <div className="top-actions">
            <div className={`connection-pill ${health?.gemmaConfigured ? "connected" : "warning"}`}><span className="tiny-dot" />{health?.gemmaConfigured ? "Gemma configured" : "Gemma key missing"}</div>
            <button className="icon-button" title="Refresh status" onClick={refresh}><RefreshCw size={16} /></button>
            <div className="avatar">RR</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><Sparkles size={13} /> REPOSITORY INTELLIGENCE</div>
              <h1>Understand the <span>blast radius.</span></h1>
              <p>Explore code relationships before you change a thing.</p>
            </div>
            <div className="heading-badge"><GitBranch size={15} /> Graph-backed analysis</div>
          </div>

          <section className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Graph nodes</span><Network size={16} /></div><div className="stat-value">{health?.graph?.nodeCount ?? "—"}</div><div className="stat-foot">Components mapped</div></div>
            <div className="stat-card"><div className="stat-top"><span>Relationships</span><GitBranch size={16} /></div><div className="stat-value">{health?.graph?.edgeCount ?? "—"}</div><div className="stat-foot">Known connections</div></div>
            <div className="stat-card"><div className="stat-top"><span>AI engine</span><BrainCircuit size={16} /></div><div className="stat-value stat-text">{health?.gemmaConfigured ? "Gemma 4" : "Offline mode"}</div><div className="stat-foot">{health?.gemmaConfigured ? "API key detected" : "Add key to enable AI"}</div></div>
          </section>

          {graph.notice && <div className={`notice ${graph.mode === "graphify" ? "notice-good" : ""}`}><AlertTriangle size={15} /><span>{graph.notice}</span></div>}
          {error && <div className="error-banner"><AlertTriangle size={16} />{error}<button onClick={() => setError("")}>Dismiss</button></div>}

          <section className="analysis-layout">
            <div className="panel query-panel">
              <div className="panel-header"><div><div className="panel-kicker">01 / DEFINE CHANGE</div><h2>What are you changing?</h2></div><div className="panel-icon"><Search size={18} /></div></div>
              <label className="field-label" htmlFor="target">Target component</label>
              <div className="select-wrap">
                <select id="target" value={target} onChange={e => setTarget(e.target.value)}>
                  {graph.nodes?.map(node => <option value={node.id} key={node.id}>{node.label} — {node.id}</option>)}
                  {!graph.nodes?.length && <option value={target}>{target}</option>}
                </select><ChevronDown size={16} />
              </div>
              <label className="field-label" htmlFor="question">Impact question</label>
              <textarea id="question" rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What might break if I change this component?" />
              <div className="prompt-suggestions">
                <button onClick={() => setQuestion("What components depend on this target, and what should I test?")}>Dependencies & tests</button>
                <button onClick={() => setQuestion("Explain the shortest graph paths connecting this target to user-facing routes.")}>User-facing impact</button>
              </div>
              <button className="primary-button" disabled={loading || !target} onClick={() => analyze()}>
                {loading ? <><LoaderCircle size={17} className="spin" /> Analyzing graph…</> : <><Sparkles size={17} /> Analyze change impact <ArrowRight size={16} /></>}
              </button>
              <div className="query-foot"><ShieldCheck size={14} /><span>Analysis is based on available graph evidence, not code execution.</span></div>
            </div>

            <div className="panel graph-panel">
              <div className="panel-header graph-header"><div><div className="panel-kicker">02 / EXPLORE RELATIONSHIPS</div><h2>Dependency map</h2></div><div className="graph-legend"><span><i className="legend-target" /> Target</span><span><i /> Related</span></div></div>
              <div className="graph-canvas">
                {flow.nodes.length ? <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView fitViewOptions={{ padding: 0.22 }} minZoom={0.25} maxZoom={1.5} nodesDraggable={false} nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }}>
                  <Background color="#253148" gap={20} size={1} />
                  <Controls showInteractive={false} />
                  <MiniMap nodeColor={n => n.style?.border?.includes("#a78bfa") ? "#8b5cf6" : "#334155"} maskColor="rgba(8,13,24,0.7)" />
                </ReactFlow> : <div className="graph-empty"><Network size={26} /><p>Loading code relationships…</p></div>}
              </div>
              <div className="graph-footer"><span><span className="online-dot" /> Graph data loaded</span><span>{graph.nodes?.length || 0} nodes · {graph.edges?.length || 0} edges</span></div>
            </div>
          </section>

          <section className="panel results-panel">
            <div className="results-heading">
              <div><div className="panel-kicker">03 / EVIDENCE & RECOMMENDATIONS</div><h2>Impact report</h2></div>
              <div className="result-actions">
                <div className="tab-switch"><button className={activeTab === "impact" ? "selected" : ""} onClick={() => setActiveTab("impact")}>Analysis</button><button className={activeTab === "nodes" ? "selected" : ""} onClick={() => setActiveTab("nodes")}>Components</button></div>
                <button className="secondary-button" disabled={!result} onClick={copyReport}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Export report"}</button>
              </div>
            </div>

            {activeTab === "impact" ? (
              result ? <div className="report-content">
                <div className="summary-box">
                  <div className="summary-icon"><Zap size={18} /></div>
                  <div className="summary-copy"><div className="summary-title">Impact summary <span className={`risk risk-${result.report.risk}`}>{prettyRisk(result.report.risk)} risk</span></div><p>{result.report.summary}</p><div className="summary-meta"><span><CircleDot size={12} /> Confidence: {result.report.confidence || "unknown"}</span><span><GitBranch size={12} /> {result.graph.stats.relevantEdges} related edges inspected</span><span className="mode-label">{result.report.mode === "gemma" ? "Gemma-generated" : "Fallback analysis"}</span></div></div>
                </div>
                {result.report.note && <div className="notice"><AlertTriangle size={14} />{result.report.note}</div>}
                <div className="report-section-title">Potential impact findings <span>{result.report.findings?.length || 0}</span></div>
                <div className="findings-list">
                  {result.report.findings?.length ? result.report.findings.map((finding, i) => <div className="finding" key={i}><div className="finding-number">{String(i + 1).padStart(2, "0")}</div><div className="finding-body"><div className="finding-title-row"><strong>{finding.title}</strong><span className={`priority priority-${finding.priority || "medium"}`}>{finding.priority || "medium"}</span></div><p>{finding.detail}</p>{finding.evidence && <div className="evidence-line"><GitBranch size={13} /><code>{finding.evidence}</code></div>}</div></div>) : <div className="empty-report">No findings returned. Try a different target or question.</div>}
                </div>
                <div className="report-section-title test-title"><span className="test-icon"><Check size={15} /></span> Recommended test plan</div>
                <div className="test-list">{(result.report.testPlan || []).map((item, i) => <div className="test-item" key={i}><span>{i + 1}</span><p>{item}</p></div>)}</div>
                {result.report.assumptions?.length > 0 && <div className="assumptions"><strong>Assumptions & limitations</strong>{result.report.assumptions.map((item, i) => <p key={i}>• {item}</p>)}</div>}
                <div className="report-disclaimer"><ShieldCheck size={15} /><span>Recommendations are not verified until tests are run. Static dependency graphs may omit runtime relationships.</span></div>
              </div> : <div className="empty-state"><div className="empty-illustration"><BrainCircuit size={29} /></div><h3>Your analysis appears here</h3><p>Select a target, ask a change-impact question, then run the analysis to get evidence-backed findings and a test plan.</p><button className="secondary-button" onClick={() => analyze()} disabled={loading || !target}><Sparkles size={15} /> Try sample analysis</button></div>
            ) : (
              <div className="components-view">
                <div className="component-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components…" /></div>
                <div className="component-list">{filteredNodes.map(node => <button className="component-row" key={node.id} onClick={() => { setTarget(node.id); setActiveTab("impact"); }}><div className="component-icon"><FileCode2 size={16} /></div><div className="component-details"><strong>{node.label}</strong><span>{node.id}</span></div><span className="component-type">{node.type}</span><ArrowDownRight size={15} /></button>)}</div>
              </div>
            )}
          </section>
          <footer className="page-footer"><span>RepoRadar <span className="footer-sep">·</span> Built with Graphify + Gemma</span><span><span className="online-dot" /> API {health?.ok ? "connected" : "checking"}</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
