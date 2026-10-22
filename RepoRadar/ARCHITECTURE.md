# Architecture notes

`src/` is the Vite React application.
`server/index.js` exposes the API and serves `dist/` in production.
`server/lib/graph.js` loads and normalizes graph JSON, traverses relationships, and selects evidence.
`server/lib/gemma.js` passes the selected graph evidence to Gemma and validates the structured response.
`data/sample-graph.json` is an example graph fixture for reference.

The application intentionally uses a sample graph when no Graphify output is available, and labels that state in the UI. This lets the UI be demonstrated while Graphify is configured. For a submission claiming Graphify integration, replace the sample graph with a graph generated from a real repository and verify the backend loads it (`GET /api/health` should report `"mode": "graphify"`).
