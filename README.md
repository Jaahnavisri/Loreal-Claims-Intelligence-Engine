# L'Oréal Claims Intelligence Engine

A full-stack prototype for assessing cosmetic product claims against study evidence. It models the handoff from scientist submission to evaluator review and retains the evidence and each assessment version for traceability.

## What is implemented

- Structured claim audience and clinical study metadata.
- LLM assessment with `SUPPORTIVE`, `NOT_SUPPORTIVE`, or `INCONCLUSIVE` status, reasoning, model-reported confidence, evidence gaps, limitations, and recommendation.
- Immutable, versioned assessments. A later study submission appends a record and does not overwrite earlier wording, evidence, or result.
- Deterministic audience-age and study-version comparisons. Missing information is explicitly reported as missing, never treated as a match.
- Human evaluator decisions (`ACCEPTED`, `REJECTED`, `MORE_EVIDENCE_REQUIRED`) with a required reason for rejection or additional evidence requests.
- Append-only activity events for claim creation, assessments, and reviewer submissions.
- React UI for submission, assessment history, comparisons, reviewer decisions, and activity timeline.

The model is advisory. A confidence score is model-reported and must not be read as clinical probability. No model result or evaluator acceptance in this prototype authorizes product launch or constitutes regulatory approval.

## Architecture

```text
React / Vite
    │ HTTP JSON
    ▼
NestJS controllers → ClaimsService → Groq (default) or OpenAI
                           │
                           ▼
                   Node built-in SQLite
```

The API uses Node's `node:sqlite` runtime rather than Prisma Client. This avoids Prisma's native database engine on Windows ARM64 Snapdragon devices. `backend/prisma/schema.prisma` documents the same logical model for future tooling; the runtime database is created at `backend/data/claims.db` and upgraded with non-destructive, versioned SQL migrations.

The service stores the claim before requesting an LLM result so that provider failures do not discard the submission. A failed model call does not create a fake assessment. To retry after a failure, send the saved `claimId`; the API adds the next assessment version to that claim.

## API

All endpoints use the `/api` prefix.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/claims/assess` | Create a claim or append a study assessment |
| `GET` | `/api/claims/:claimId/assessments` | List a claim's assessment history |
| `GET` | `/api/claims/:claimId/assessments/compare?previousId=…&currentId=…` | Compare two study metadata snapshots |
| `GET` | `/api/claims/:claimId/audit-history` | Get claim and assessment activity |
| `GET` | `/api/assessments/:assessmentId` | Get one assessment and its study snapshot |
| `GET` | `/api/assessments/:assessmentId/reviews` | List evaluator decisions |
| `POST` | `/api/assessments/:assessmentId/reviews` | Append an evaluator decision |

Example assessment request:

```json
{
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "productName": "Revitalift Clinical Serum",
  "targetAudience": { "minAge": 40, "maxAge": 65, "description": "Adults with visible facial wrinkles" },
  "evidence": "Study summary with outcome and limitations...",
  "studyMetadata": {
    "minParticipantAge": 40,
    "maxParticipantAge": 65,
    "sampleSize": 120,
    "duration": "4 weeks",
    "studyType": "Randomized, double-blind, vehicle-controlled",
    "outcomeMeasure": "Wrinkle area reduction",
    "measurementMethod": "3D imaging"
  }
}
```

The response contains `claim`, `assessment`, `audienceFindings`, and `previousStudyComparison`. To add another study to the same claim, submit the same claim text, product, and audience with the returned `claim.id` as `claimId`, plus the new evidence and metadata. Core claim details are fixed after initial submission; start a new claim to change them.

Example evaluator review:

```json
{
  "reviewerName": "Evaluator name",
  "decision": "MORE_EVIDENCE_REQUIRED",
  "comments": "Please provide the full protocol and endpoint analysis."
}
```

## Local setup

Install dependencies from each application folder. On Windows PowerShell, use `npm.cmd` if script execution policy prevents `npm.ps1` from running.

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
# Add a GROQ_API_KEY in backend/.env
npm.cmd run start:dev
```

In another terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the local Vite URL shown in the frontend terminal. Node.js 24 is expected for the built-in SQLite module. The frontend uses a WebAssembly Rollup package to avoid a blocked native ARM64 Rollup addon on managed Windows devices.

By default the backend uses Groq. Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` only if using OpenAI. Do not commit `.env` or API keys.

## Design decisions and boundaries

- The evidence comparison service compares structured fields only. It does not infer clinical equivalence or decide that a broader participant age range strengthens a claim.
- Audience age is compared against study participant age. Free-text audience descriptions are surfaced as not deterministically comparable.
- The LLM receives the supplied claim, audience, metadata, and evidence summary as data. Its response is schema constrained and validated before persistence.
- Assessments and human reviews are separate records. A review does not rewrite the AI result.
- Authentication, role permissions, document uploads, source citations, managed production database, model-quality evaluation, and secure deployment are future work. This prototype should not be used for real regulatory decisions.

## Suggested roadmap

1. Add authentication and role-based access for business, claim managers, scientists, and evaluators.
2. Support controlled evidence uploads, source provenance, extraction review, and citations to exact report passages.
3. Expand structured claim ontology: endpoint, comparator, effect size, statistical uncertainty, protocol, and population criteria.
4. Build expert-labeled evaluation sets; version prompts/models; assess calibration, disagreement, and drift.
5. Add privacy, retention, encryption, rate limits, redaction, and governance controls.
6. Move to managed relational storage and asynchronous jobs with idempotency and reviewer queues.
7. Add multilingual evidence workflows while preserving originals and reviewed translations.
