// The server's canonical seed: the 105 normalized Decision Objects, read from
// `src/features/action-stories/__corpus__/normalized/proposals/`.
//
// THOSE FILES ARE THE SOURCE OF TRUTH, not a copy of it. `npm run normalize` writes them from the
// archived reference corpus, and this server reads the same directory the repository already
// commits — so there is exactly one set of 105 Decision Objects, and regenerating them updates the
// API with no second edit anywhere.
//
// The per-proposal directory is preferred over the `dataset.json` bundle on purpose: one file per
// proposal is the natural upload unit when a real API is provisioned, and reading it here means the
// eventual migration is "point the loader at a table" rather than "split the bundle first".
//
// Seeds are VALIDATED at boot against the same contract validator the frontend applies to every
// response. A malformed seed therefore fails at startup, loudly, instead of at the one request that
// happens to hit it.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateDecisionObject } from '../src/features/action-stories/contract/decisionObject.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const SEED_DIR = path.resolve(__dirname, '../src/features/action-stories/__corpus__/normalized/proposals')

/**
 * Reads and validates every seed Decision Object.
 *
 * @param {string} [dir] - overridable for tests; defaults to the committed corpus directory.
 * @returns {object[]} the Decision Objects, ordered by proposal_id.
 * @throws {Error} when the directory is missing, empty, or holds a record the contract rejects.
 */
export function loadSeed(dir = SEED_DIR) {
  if (!fs.existsSync(dir)) {
    throw new Error(
      `[mock-server] seed directory not found: ${dir}\n` +
        'Run `npm run normalize` to regenerate the normalized Decision Objects.',
    )
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  if (files.length === 0) {
    throw new Error(`[mock-server] seed directory is empty: ${dir}`)
  }

  const decisions = []
  const problems = []

  for (const file of files) {
    const full = path.join(dir, file)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(full, 'utf8'))
    } catch (err) {
      problems.push(`${file}: not valid JSON (${err.message})`)
      continue
    }
    const invalid = validateDecisionObject(parsed)
    if (invalid.length > 0) {
      problems.push(`${file}: ${invalid.join('; ')}`)
      continue
    }
    decisions.push(parsed)
  }

  if (problems.length > 0) {
    // Fail the boot. A server that starts while serving contract-violating objects would push the
    // failure into the client, which is exactly what the contract validator exists to prevent.
    throw new Error(`[mock-server] ${problems.length} seed record(s) failed contract validation:\n  ${problems.join('\n  ')}`)
  }

  decisions.sort((a, b) => a.proposal_id.localeCompare(b.proposal_id))
  return decisions
}
