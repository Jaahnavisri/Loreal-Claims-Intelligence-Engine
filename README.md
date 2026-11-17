# L'Oréal Claims Intelligence Engine

A small full-stack technical proposal demonstrating claim assessment with a study summary, an LLM, and persistent assessment history.

**Step 1 implementation:** NestJS API, React/Vite interface, and a local SQLite database. The Prisma schema documents the data model; the runtime uses Node's built-in SQLite module so it runs natively on Windows ARM64 devices such as Snapdragon X PCs without a Prisma native engine.

## Business process represented

Business proposes a product and claims; claim managers screen applicability and feasibility; an R&I scientist submits a formula and study evidence; an evaluator reviews the evidence against each claim. This prototype implements the evaluator handoff: a submitted claim and study summary are assessed, stored, and returned to the UI.

## Technical shape

```text
React UI  ->  NestJS POST /api/claims/assess  ->  Groq API (free-tier default)
                         |                            |
                         +------ Node SQLite <--------+
```

The API persists the claim first, calls the model for a constrained JSON assessment, then saves the assessment linked to the claim. If the model call fails, the claim remains recorded and the API returns an error; retry handling and idempotency are future work. The result is decision support for a human evaluator, not an automated clinical or regulatory approval. The runtime database creates `backend/data/claims.db` on first startup.

## Research and design notes

- NestJS controllers handle HTTP and delegate application logic to injectable providers, which keeps request handling separate from assessment/persistence.
- The Prisma schema models claims and assessments as a one-to-many relation so a claim can retain review history as evidence or model versions change. Its SQLite table shape is mirrored by the built-in Node SQLite runtime.
- Node's built-in `node:sqlite` avoids downloading a platform-specific native engine, which is important on Windows ARM64.
- By default, the backend sends a JSON Schema constrained chat request to Groq using the open-weight `openai/gpt-oss-20b` model. The existing OpenAI Responses API path remains available by setting `LLM_PROVIDER=openai`. The server validates ranges and required fields before persistence; model output is not trusted as free-form authority.
- Groq's free tier has provider-defined rate limits; it is useful for local evaluation but not a production availability guarantee.
- The evidence input is an evaluator-provided summary, not a document ingestion pipeline. A production design would preserve source documents, endpoint definitions, population, protocol, and provenance.

References: [NestJS controllers](https://docs.nestjs.com/controllers), [NestJS providers](https://docs.nestjs.com/providers), [Groq OpenAI compatibility](https://console.groq.com/docs/openai), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq rate limits](https://console.groq.com/docs/rate-limits).

## Roadmap with ample time

1. Add workflow states and roles for business, claim managers, scientists, and evaluators; require human sign-off and audit trails at each transition.
2. Ingest study protocols and reports with secure document storage, provenance, extraction review, and traceable citations to source passages.
3. Introduce a structured evidence ontology for claim type, endpoint, population, comparator, effect size, duration, and statistical uncertainty.
4. Evaluate model quality on expert-labeled cases; version prompts/models; monitor calibration, disagreement, drift, and failure rates.
5. Add access control, tenant isolation, retention controls, encryption, rate limits, redaction, and governance for sensitive study data.
6. Scale persistence to managed PostgreSQL, move long-running assessments to jobs, and add observability, retries, idempotency, and reviewer queues.
7. Support multilingual claims and evidence while preserving original text and source-linked translations.

