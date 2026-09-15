// PRODUCTION BUNDLE VERIFICATION — the guard that keeps the 105 Decision Objects out of the app
// users actually download.
//
// `decisionApi.js` chooses between the in-process test double and real HTTP. The double imports
// `normalized/dataset.json` (627 KB), so for as long as that import was STATIC the corpus shipped to
// every user even when `VITE_API_BASE_URL` pointed at a real API — 805 KB of main chunk, 78% of it
// business fixtures nothing would ever read.
//
// The fix is a dynamic `import()` behind a build-time-constant branch. That is easy to get subtly
// wrong: a dynamic import whose condition the bundler CANNOT fold still emits the module as a
// separate production asset, which looks fixed in the source and is not fixed in `dist/`. So this
// file does not inspect the source, and does not trust the import syntax. It runs the real
// production build and greps the real emitted assets.
//
// It builds TWICE on purpose:
//   - the HTTP build must contain none of the corpus — the actual requirement;
//   - the default build must contain all of it — which is what proves the detection above is real
//     rather than a grep that would pass against an empty directory.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

/** Distinctive business strings from the corpus. If any appears, the corpus shipped. */
const CORPUS_PROBES = [
  'Bamboo canister 1.2L',
  'Exit-Candidate SKUs',
  'GMROI target',
  'prop_s10_6_live',
]

let outRoot
let httpAssets
let mockAssets

/**
 * Runs a real production build into `outDir` and returns every emitted file's text.
 *
 * `NODE_ENV: 'production'` is set explicitly because Vitest exports `NODE_ENV=test` into this
 * process, and a child build inheriting it emits React's DEVELOPMENT bundle — 244 KB larger, and
 * not the artifact a deployment ships. Without this the size assertion below measures the wrong
 * thing entirely.
 */
function build(outDir, env) {
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'production', ...env },
    stdio: 'pipe',
  })

  const files = []
  ;(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push({ name: path.relative(outDir, full), text: fs.readFileSync(full, 'utf8') })
    }
  })(outDir)
  return files
}

beforeAll(() => {
  outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'as-bundle-'))
  // `VITE_API_BASE_URL` set = what a Render deployment of this frontend builds with.
  httpAssets = build(path.join(outRoot, 'http'), { VITE_API_BASE_URL: 'https://example-api.onrender.com' })
  // Unset = the default local/demo build, which keeps the double.
  mockAssets = build(path.join(outRoot, 'mock'), { VITE_API_BASE_URL: '' })
}, 180_000)

afterAll(() => {
  if (outRoot) fs.rmSync(outRoot, { recursive: true, force: true })
})

const containing = (assets, needle) => assets.filter((a) => a.text.includes(needle)).map((a) => a.name)

describe('production build with VITE_API_BASE_URL (the deployed HTTP app)', () => {
  it('emits no asset containing any of the 105 proposal ids', () => {
    const leaked = dataset.map((d) => d.proposal_id).filter((id) => httpAssets.some((a) => a.text.includes(id)))
    expect(leaked, `proposal ids found in the production bundle: ${leaked.slice(0, 5).join(', ')}`).toEqual([])
  })

  it('emits no asset containing the corpus business content', () => {
    const leaked = CORPUS_PROBES.filter((probe) => httpAssets.some((a) => a.text.includes(probe)))
    expect(leaked).toEqual([])
  })

  it('does not emit the test double as a chunk at all — not even an unloaded one', () => {
    // The distinction this asserts: a dynamic import the bundler cannot prove dead still SHIPS. The
    // module must be absent from `dist/`, not merely unreferenced at runtime.
    expect(httpAssets.map((a) => a.name).filter((n) => /mockDecisionApi/.test(n))).toEqual([])
  })

  it('stays well under the pre-fix bundle size', () => {
    // A canary, not a budget. Before the fix the corpus was inlined into the main chunk and total
    // JS measured 1,197,647 bytes; after, 786,761. The threshold sits between the two with room for
    // ordinary application growth, so it fires when the 410 KB corpus comes back and stays quiet
    // otherwise. The three content assertions above are the real proof; this catches a corpus that
    // returns under a different name or shape.
    const total = httpAssets.filter((a) => a.name.endsWith('.js')).reduce((sum, a) => sum + a.text.length, 0)
    expect(total).toBeLessThan(950_000)
  })
})

describe('default production build (no VITE_API_BASE_URL)', () => {
  it('DOES ship the corpus — which is what proves the assertions above are not vacuous', () => {
    // If this ever fails, the checks above stop meaning anything: a grep that finds nothing in a
    // build that genuinely contains the data is a broken grep, not a clean bundle.
    const found = CORPUS_PROBES.filter((probe) => mockAssets.some((a) => a.text.includes(probe)))
    expect(found).toEqual(CORPUS_PROBES)
  })

  it('keeps the corpus in its own lazily-loaded chunk, out of the main entry chunk', () => {
    // Even the demo build benefits: the double is code-split, so the corpus is fetched only once a
    // route actually asks the API for something.
    for (const probe of CORPUS_PROBES) {
      const chunks = containing(mockAssets, probe)
      expect(chunks, `"${probe}" should live in one chunk`).toHaveLength(1)
      expect(chunks[0]).toMatch(/mockDecisionApi/)
    }
  })
})
