import { GoogleGenAI } from "@google/genai";

const fallbackReport = ({ target, question, graph }) => {
  const targetNode = graph.targetNode;
  const related = graph.evidence.slice(0, 8);
  return {
    summary: `Potential impact analysis for "${target}".`,
    risk: related.length >= 5 ? "medium" : "low",
    confidence: "limited",
    findings: related.slice(0, 5).map((edge, i) => ({
      title: `${edge.sourceLabel} → ${edge.targetLabel}`,
      detail: `Graphify relationship: ${edge.relationship}. This is a structural connection, not proof that a runtime failure will occur.`,
      evidence: `${edge.source} —[${edge.relationship}]→ ${edge.target}`,
      priority: i < 2 ? "high" : "medium"
    })),
    testPlan: [
      "Review the target component and every directly connected caller or dependency.",
      "Run existing unit tests for the target component.",
      "Run integration tests for the routes or services connected to the target.",
      "Verify behavior in a development environment before merging."
    ],
    assumptions: [
      targetNode ? `Matched graph node: ${targetNode.id}` : "No exact target match was found.",
      "The report is based on static graph relationships; runtime behavior may differ."
    ],
    nextQuestion: question
  };
};

export async function generateImpactReport({ target, question, graph }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ...fallbackReport({ target, question, graph }),
      mode: "offline-fallback",
      note: "Gemma API key is not configured. This is a deterministic graph-based fallback, not a Gemma-generated answer."
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
  const compactEvidence = {
    target,
    question,
    graphName: graph.graphName,
    targetNode: graph.targetNode,
    nodes: graph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type, description: n.description })),
    edges: graph.edges.map(e => ({ source: e.source, target: e.target, relationship: e.label })),
    graphMode: graph.mode
  };

  const prompt = `You are RepoRadar, a cautious code change-impact analyst.
Use ONLY the supplied code graph as evidence for claims about repository relationships.
Do not invent files, functions, imports, call relationships, tests, or runtime outcomes.
Distinguish observed graph facts from hypotheses. A static graph cannot prove runtime impact.
If no node matches the target, state that clearly and use the closest relevant evidence without pretending it is an exact match.
Return valid JSON only, matching this schema:
{
  "summary": "short plain-English impact summary",
  "risk": "low|medium|high|unknown",
  "confidence": "low|medium|high",
  "findings": [{"title":"short label","detail":"explanation","evidence":"exact node IDs and relationship from supplied graph","priority":"low|medium|high"}],
  "testPlan": ["actionable test step"],
  "assumptions": ["limitation or assumption"],
  "nextQuestion": "one useful follow-up question"
}
Keep findings to at most 5 and testPlan to at most 5. Recommendations must be practical and must not claim tests were run.

Repository evidence JSON:
${JSON.stringify(compactEvidence)}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 0.2, responseMimeType: "application/json" }
  });

  const text = response.text || "";
  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ...fallbackReport({ target, question, graph }),
      mode: "fallback-invalid-model-response",
      note: "Gemma returned an unreadable response; displaying the graph-based fallback instead."
    };
  }

  return {
    summary: String(parsed.summary || "Impact report generated."),
    risk: ["low", "medium", "high", "unknown"].includes(parsed.risk) ? parsed.risk : "unknown",
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    findings: Array.isArray(parsed.findings) ? parsed.findings.slice(0, 5) : [],
    testPlan: Array.isArray(parsed.testPlan) ? parsed.testPlan.slice(0, 5) : [],
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 6) : [],
    nextQuestion: String(parsed.nextQuestion || ""),
    mode: "gemma",
    model
  };
}
