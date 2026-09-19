# Action Stories — mock API server

A standalone HTTP server that serves the 105 canonical Decision Objects over the same contract the
React frontend already speaks. It exists so the frontend can be developed, demonstrated and
deployed against a **real network boundary** instead of an in-process function call.

**It is a mock, not a backend.** No authentication, no database, no multi-tenancy, no caller
identity. A real service re-implements the same contract in its own stack; this one makes that
contract executable today.

---

## What it does

| | |
|---|---|
| **Serves** | the 105 Decision Objects in `src/features/action-stories/__corpus__/normalized/proposals/` |
| **State** | two in-memory `Map`s — proposals and an idempotency ledger. No database. |
| **On restart** | state resets to the canonical seed. This is intentional (see [State](#state)). |
| **Rules** | imported from `src/features/action-stories/contract/operatorActionExecution.js` — the *same* module the in-process test double uses |
| **Dependencies** | none beyond Node's own `node:http`. No Express, no framework. |

### Where the data comes from

The seed is read at boot from `normalized/proposals/*.json` — the directory `npm run normalize`
writes from the archived reference corpus. There is **no second copy** of the 105 objects: regenerate
the corpus and the API serves the new data with no further edit.

Every seed record is validated at boot with the same `validateDecisionObject` the frontend applies to
every response. A malformed seed **fails startup loudly** rather than at the one request that hits it.

### Why there is no framework

Four routes, one dynamic segment, JSON in and out, and CORS. Express would add a dependency, a
middleware stack and a version to keep current in exchange for roughly forty lines `app.js` already
has.

---

## Running it locally

```bash
npm install          # once
npm run mock-api
```

```
[mock-server] action-stories mock API listening on http://0.0.0.0:3001
[mock-server] serving 105 Decision Objects from the normalized corpus
```

**Port: `process.env.PORT || 3001`. Host: `0.0.0.0`.**

3001 is the local default, chosen to stay clear of Vite's 5173. Override it with `PORT=4000 npm run mock-api`.

### Pointing the frontend at it

The frontend uses the in-process test double whenever `VITE_API_BASE_URL` is unset, and real HTTP
when it is set. Nothing else changes.

```bash
# terminal 1
npm run mock-api

# terminal 2
VITE_API_BASE_URL=http://localhost:3001 npm run dev
```

The "No API configured — served by the in-memory test double" banner disappears when the app is
talking to a real server. That banner is how you tell the two apart at a glance.

### The deployed instance

This server is deployed at **https://realify-mock-api.onrender.com**, and `.env.production` points
the production build at it:

```
VITE_API_BASE_URL=https://realify-mock-api.onrender.com
```

Vite loads `.env.production` for `mode=production` only, so:

| Command | Transport |
|---|---|
| `npm run dev` | in-process double (unchanged) |
| `npm test` | in-process double — the suite stays offline |
| `npm run build` | **the deployed API over HTTPS**, and the double is dropped from the bundle |

To run a dev server against the deployed API:

```bash
VITE_API_BASE_URL=https://realify-mock-api.onrender.com npm run dev
```

**Free-tier cold start.** The instance spins down after idle; the first request can take up to ~60 s
while it wakes, and the app will sit in its loading state until then. Subsequent requests are fast.
A spin-down also resets state to the seed corpus — see [State](#state).

---

## Endpoints

### `GET /health`

Liveness, plus how many Decision Objects loaded. This is the path a platform health check should use.

```json
{ "status": "ok", "service": "action-stories-mock-api", "proposals": 105, "uptime_seconds": 9 }
```

### `GET /v1/proposals`

The queue — one **summary** row per Decision Object, not the full payload.

| Query param | Meaning |
|---|---|
| `stage` | `reason` \| `analyze` \| `decide` \| `execute` \| `live` |
| `persona` | operator persona (`merchandiser`, `planner`, …) |
| `story_code` | the parent Action Story (`S9.1`) — returns all of its stages |
| `limit` | 1–500, default 25 |
| `cursor` | the `next_cursor` from the previous page |

```json
{ "items": [ { "proposal_id": "…", "story_code": "…", "title": "…", "stage": "…", "status": "…", "on_clock": false, "deadline": null } ],
  "next_cursor": "prop_s10_1_decide" }
```

### `GET /v1/proposals/:proposal_id`

One full Decision Object, exactly as stored. **One dynamic route serves all 105 ids** — there is no
per-id route anywhere. `404` for an unknown id.

### `POST /v1/proposals/:proposal_id/actions`

Runs one operator action and returns the **updated Decision Object** — never an ack. That removes a
round trip and, more importantly, the stale-read window where the client has acted but does not yet
know what the proposal looks like.

```jsonc
{
  "action_type": "approve",          // approve | approve_selected | modify | send_back | dismiss | snooze
  "reason": "…",                     // required by modify / send_back / dismiss (min length per action)
  "selection": ["item-id"],          // required by approve_selected
  "snooze_until": "2026-10-01T09:00:00.000Z",  // required by snooze
  "expected_updated_at": "…"         // optional optimistic-concurrency check
}
```

**The idempotency key is required.** Send it as the `Idempotency-Key` header (what the frontend's
`httpClient` does) or as `idempotency_key` in the body (convenient from curl).

| Status | When |
|---|---|
| `200` | performed — or replayed from the ledger under the same key |
| `403` | the proposal's entitlement is `locked` |
| `404` | no such proposal |
| `409` | idempotency key reused for a *different* request; or `expected_updated_at` is stale |
| `422` | missing idempotency key; unknown `action_type`; the action is not eligible; malformed body |

Error bodies are `{ "error": { "status": 404, "message": "…" } }`. The frontend classifies on the
**status**, not the body — the body is for operators reading logs and curl output.

#### The order of checks is part of the contract

1. **Idempotency** — before anything else, so a replay returns the original result without re-running.
2. **Existence.**
3. **Entitlement** — a caller who may not act must not learn whether the action *would* have been eligible.
4. **Optimistic concurrency** — `expected_updated_at` vs. the stored value.
5. **Business eligibility** — re-derived server-side, never taken from the client.
6. **Legal status transition** — redundant defence behind step 5, kept deliberately.

---

## Sample requests

```bash
curl -s localhost:3001/health

curl -s "localhost:3001/v1/proposals?limit=2"

curl -s "localhost:3001/v1/proposals?story_code=S9.1"

curl -s localhost:3001/v1/proposals/prop_s9_1_decide

# approve
curl -s -X POST localhost:3001/v1/proposals/prop_s9_1_decide/actions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-key-1' \
  -d '{"action_type":"approve"}'

# replay the same key -> the original result, unchanged updated_at
curl -s -X POST localhost:3001/v1/proposals/prop_s9_1_decide/actions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-key-1' \
  -d '{"action_type":"approve"}'

# send back, with the required reason
curl -s -X POST localhost:3001/v1/proposals/prop_s9_2_decide/actions \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"send_back","reason":"Split the exit set across two quarters.","idempotency_key":"demo-key-2"}'
```

---

## State

Two `Map`s in the process. A restart re-reads the seed.

That is the right behaviour for a demo environment — every deploy starts from a known corpus — and a
real backend replaces it wholesale with its own persistence. On a Render **free** instance this also
means a spin-down after idle returns the corpus to its seed state. **That is not data loss; there is
no data to lose.** Anything an operator "approves" here is a mock mutation of synthetic data.

---

## Tests

```bash
npx vitest run mock-server/
```

35 tests in `app.test.js`. They bind a **real socket on port 0** and call it with `fetch` — a real
server over real HTTP. They never contact a deployed URL, so the suite stays runnable offline and in
CI. Each test gets its own server and store, so mutating tests cannot leak into one another.

`npm test` runs them alongside the rest of the suite.

---

## Render deployment

The server is **ready to deploy** — nothing in it assumes localhost.

| Requirement | Status |
|---|---|
| Binds `process.env.PORT` | ✅ `mock-server/index.js` |
| Binds host `0.0.0.0`, not `127.0.0.1` | ✅ — a container's router reaches the process from outside its own loopback |
| Health check path | ✅ `GET /health` |
| Handles `SIGTERM` | ✅ closes the server so in-flight requests finish on deploy/spin-down |
| CORS for a separately-hosted frontend | ✅ including the `Idempotency-Key` request header, without which every action's preflight fails |
| No build step | ✅ plain ESM, run directly by Node |
| No native modules, no system packages | ✅ zero runtime dependencies |
| No persistent disk | ✅ in-memory only |
| No secrets or env config required | ✅ `PORT` is the only variable read, and it has a default |

### Settings to use

| Setting | Value |
|---|---|
| Environment | Node |
| Build command | `npm install` |
| Start command | `npm run mock-api` |
| Health check path | `/health` |
| Node version | ≥ 18 (needs `structuredClone` and global `fetch`) |

### After deploying

Point the frontend at the service URL:

```
VITE_API_BASE_URL=https://<your-service>.onrender.com
```

### Before making it public

CORS is currently `Access-Control-Allow-Origin: *`. That is correct for a public, synthetic,
credential-free corpus. If this ever serves anything real, replace it with an origin allow-list in
`app.js` and add authentication — which this server deliberately does not have.

---

## Files

| File | Role |
|---|---|
| `index.js` | entrypoint — reads `PORT`, binds `0.0.0.0`, handles `SIGTERM` |
| `app.js` | the four routes, CORS, JSON body handling, the action endpoint |
| `store.js` | the two in-memory `Map`s |
| `seed.js` | loads and validates the 105 Decision Objects at boot |
| `app.test.js` | 35 HTTP tests against a real socket |

The business rules live outside this directory, in
`src/features/action-stories/contract/operatorActionExecution.js`, shared with the in-process test
double so the two transports cannot drift.
