// The server's state: two in-memory Maps, and nothing else.
//
// NO DATABASE, by design. This is a mock API whose whole job is to serve a fixed, known corpus over
// real HTTP so the frontend can be developed and demonstrated against a real network boundary.
// State is per-process and deliberately ephemeral: a restart re-reads the canonical seed, which is
// the behaviour a demo environment wants (every deploy starts from a known corpus) and which a real
// backend would replace wholesale with its own persistence.
//
// On Render this means a free-tier instance that spins down and back up returns to the seed corpus.
// That is correct for a mock, and it is called out in this directory's README so nobody mistakes it
// for data loss.

import { loadSeed } from './seed.js'

/**
 * @typedef {object} MockStore
 * @property {Map<string, object>} proposals        - proposal_id -> Decision Object
 * @property {Map<string, object>} idempotencyLedger - idempotency key -> the response it produced
 */

/**
 * Builds a fresh store from the canonical seed. Each Decision Object is deep-copied on the way in,
 * so a mutation can never write back through to the parsed seed and leak between resets.
 *
 * @param {object[]} [seed] - overridable for tests.
 * @returns {MockStore}
 */
export function createStore(seed = loadSeed()) {
  return {
    proposals: new Map(seed.map((d) => [d.proposal_id, structuredClone(d)])),
    idempotencyLedger: new Map(),
  }
}
