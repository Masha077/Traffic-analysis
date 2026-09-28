# Traffic Flow Analysis

An academic traffic analytics workspace that profiles uploaded datasets, compares classification models, predicts traffic conditions, and explains results with retrieved traffic knowledge.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for dataset, model, prediction, analysis, and RAG contracts.
- `artifacts/api-server/src/lib/traffic-analysis.ts` — dataset parsing, profiling, demo data, model evaluation, prediction, and local knowledge retrieval.
- `artifacts/api-server/src/routes/traffic.ts` — REST routes under `/api`.
- `artifacts/traffic-flow-analysis/src/App.tsx` — responsive analysis workspace UI.
- `artifacts/traffic-flow-analysis/src/index.css` — visual theme, grid texture, and motion primitives.

## Architecture decisions

- The first build keeps dataset and training state in process memory so the demo path works without database setup; the API contract is ready for persistence later.
- ML classification is separate from RAG: model evaluation and prediction are produced by the analysis pipeline, while RAG retrieves traffic references and adds context.
- Upload parsing supports CSV natively and standard XLSX worksheet XML through the system unzip utility, avoiding a runtime package dependency for ingestion.
- The built-in demo dataset exercises profiling, model comparison, prediction, and grounded insights without an upload.

## Product

Users can load a demo or upload CSV/XLSX traffic data, inspect schema and quality signals, select a target, compare five classifiers, review feature-associated signals and a confusion matrix, make a prediction, and ask grounded traffic questions.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Train after loading a dataset and selecting a target column; predictions require a completed training run.
- Generated API clients live in `lib/api-client-react` and must be regenerated after OpenAPI changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
