# RepoRadar

**Know what breaks before you change code.**

RepoRadar is a hackathon MVP that combines a code dependency graph with Gemma to explain the potential impact of changing a component.

## Features

- Interactive dependency graph (React Flow)
- Target selection and change-impact questions
- Graph evidence supplied to Gemma for a structured impact report
- Findings, relationship evidence, and a suggested test plan
- Explicit uncertainty and limitations
- Deterministic fallback report when the API key is not configured
- Sample commerce graph so the UI can be demoed before Graphify is installed

## Stack

- React + Vite
- Node.js + Express
- Graphify-generated JSON graph
- Google Gen AI SDK (`@google/genai`) with a configurable Gemma model
- React Flow and Lucide icons

## Requirements

- Node.js 20+ recommended
- npm
- Google AI Studio API key for live Gemma responses
- Graphify installation for a graph generated from your own repository

## Quick start (Windows / VS Code PowerShell)

```powershell
npm install
Copy-Item .env.example .env
```

Open `.env` and set `GEMINI_API_KEY`. Leave `GRAPHIFY_GRAPH_PATH` blank to use the default `graphify-out\graph.json`, or set it to an absolute path to a Graphify graph JSON file.

Start frontend and backend:

```powershell
npm run dev
```

Open http://localhost:5173

## Graphify setup

Follow the current Graphify installation and quickstart instructions:
- https://docs.graphify.com/quickstart
- https://github.com/Graphify-Labs/graphify

Generate a graph for the target repository using the workflow described by Graphify's documentation. Configure `GRAPHIFY_GRAPH_PATH` in `.env` to point to the resulting JSON graph.

**Compatibility note:** Graphify's output format may change. The backend normalizes common `nodes`/`edges` and `vertices`/`links` formats. If your generated graph uses a different schema, update `normalizeGraph()` in `server/lib/graph.js` to match that output. Until a valid graph is configured, RepoRadar uses its clearly labelled sample graph.

## API

- `GET /api/health` — app, model-key, and graph status
- `GET /api/graph` — normalized graph nodes and edges
- `POST /api/impact` — analyze a target component

Example body:

```json
{
  "target": "src/db/connection.js",
  "question": "What might be affected if I change the database connection?"
}
```

## Model configuration

The default model is `gemma-4-26b-a4b-it` and can be changed using `GEMMA_MODEL`. Confirm the model ID and API access permitted by your hackathon before submission. The code uses the official `@google/genai` SDK and requests JSON output. If the configured model does not support your requested method or access is unavailable, the server will return an error; check the official model docs and event rules.

## Security

- Keep `.env` private; do not commit API keys.
- The app does not execute suggested commands or modify source code.
- Model output is advisory, not proof of runtime impact.
- Static graphs may omit reflection, dynamic imports, runtime configuration, and other relationships.

## Demo script

1. Select `src/db/connection.js`.
2. Ask what could be affected by changing the database connection.
3. Show the relationship graph and evidence-backed findings.
4. Review the test plan and state that recommendations must be verified by running tests.

## Build

```powershell
npm run build
npm start
```

Production server serves the built frontend and API on port 3001.
