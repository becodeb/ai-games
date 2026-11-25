# Generacion automatica de juegos con Claude

## Objective
When a student sends a prompt to the teachers, the server generates the game with the Anthropic API.
Teachers only review: approve it, or write feedback so the AI redoes it, as many times as needed,
WITHOUT creating new student iterations (versions). Every existing manual button stays as a fallback.

## Why
Today a teacher copies each prompt to an external AI chat and pastes the answer back by hand.

## Scope and design
- New table `ai_attempts` (many per iteration): id, iteration_id (FK cascade), seq, feedback, requested_by,
  status `queued|generating|ready|error|canceled`, code_html (full document), base_code (code the feedback applies to),
  error, model, input_tokens, output_tokens, tries, created_at, started_at, finished_at. UNIQUE(iteration_id, seq).
- An attempt is a private draft. It is NEVER part of `getProjectDetail`, `project:sync`, gallery, `/play` or the student
  listing. Only approval (existing `PUT /iterations/:id/code`) publishes.
- `server/src/lib/ai/`: `client.js` (SDK call), `prompt.js` (system + user message), `extract.js` (answer -> HTML + validation),
  `queue.js` (worker, limits, recovery), `attempts.js` (persistence). Keep them small and testable; the generator is injectable.
- Trigger: project/iteration created with `send: true`, or `POST /iterations/:id/send` moving copied -> pending. Never
  blocks or fails the student's request. Existing pending iterations at deploy time are NOT auto-generated (button only).
- API (teacher): `GET /ai/status` -> {enabled, auto, model}; `GET /iterations/:id/ai` -> {enabled, attempts[]};
  `POST /iterations/:id/ai` {feedback, code:{html,css,js}, requestedBy} -> 202 (first generation when no feedback/base;
  409 if one is already queued/generating; 429 daily limit; 503 no key); `POST /iterations/:id/ai/cancel`.
- Realtime: `ai:changed` {projectId, iterationId, status} without code, to a teacher-only room; dashboard list carries `aiStatus`.
- Manual publish (`PUT code`) while queued/generating cancels that attempt (abort the request); a late result is discarded.
- Cost guards (no login in this app): env `AI_MAX_CONCURRENCY=10`, `AI_DAILY_LIMIT=150` (rolling 24h), prompt cap 20k chars,
  feedback cap 4k, one active attempt per iteration, `AI_AUTO=true` switch. Without `ANTHROPIC_API_KEY` the feature is
  hidden and the app behaves exactly as before.
- Restart: queued/generating attempts are requeued, max 2 tries, then `error`.
- Model: env `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`; `AI_EFFORT` default `low` (user: waiting must be short); streaming, max_tokens 64000,
  `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.

## Out of scope
Login for teachers, changing student flow, deploying, changing manual buttons.

## Acceptance criteria
- Send from student -> draft appears on the teacher screen alone, editable in the existing code area, with preview.
- Approve publishes it through the same path as today. Number of versions does not change after N redo rounds.
- Feedback redo uses current code in the editor (including hand edits) + original request + previous feedback.
- Student never sees an unapproved draft. Manual flow works with and without key.

## Checks
TDD: off (Engram `sdd/ai-games/testing-capabilities`: disabled). `npm test --prefix server` (node:test, fake Anthropic HTTP
server through ANTHROPIC_BASE_URL, no real spend), `npm run build`, browser run by the parent.
Delivery strategy: single-pr/exception-ok (repo works straight on main). Route: delegated direct, one writer (2+ files).

## Tasks
- [x] T01 Server: attempts, queue, Anthropic client, endpoints, tests
- [x] T02 Client: AI review card in DashboardProject, badges in Dashboard
- [x] T03 Config and docs: compose, .env.example, Dockerfile if needed, README
- [x] T05 Fast model by default (Sonnet 5.5 low), concurrency 10
- [x] T04 Browser verification with fake Anthropic (parent)

## Evidence
- T01 `1dd4455`, T02 `e4ad6f2`, T03 `c5dda8d`. `npm test --prefix server`: 38/38. `npm run build`: ok.
- T04 (2026-11-25, parent, Chromium against the fake Anthropic server): live badges on both teacher screens, draft loaded
  alone, play 404 and no code for the student before approval, redo with hand edits keeps 1 version, switching attempts,
  approval reaches the student live, manual paste during generation wins (attempt canceled), manual buttons present, no page errors.
- Native review: not run, receipt-driven development is off globally. Assessed tier: medium.
- T05 (2026-11-25) model chosen by measurement, 2 real games each: Sonnet 5.5 low 25-41 s / USD 0.05-0.07; medium 42-48 s;
  low without thinking 47-55 s; Haiku 5.5 low 41-75 s; Haiku without thinking 18-21 s / USD 0.003 but plainer games.
  Through the real server: first generation 23 s, redo 22 s, 1 version. Tests 39/39. Total spend about USD 0.61.
- Production check: redo-size case (v5 of an existing game, 27 KB) took 68 s, 15.4k output tokens, USD 0.185.
- Deployed 2026-11-25 (commit 80605c6) to aigames.becode.com.ar with the user's OK. Same day the user asked for no daily cap:
  `AI_DAILY_LIMIT=1000000` in Coolify, to be restored to 150 afterwards (code default unchanged).
