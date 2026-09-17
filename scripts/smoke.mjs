// BOOT SMOKE TEST — the one thing the 1400-test suite structurally cannot see.
//
// WHY THIS EXISTS. The app rendered "We got an unexpected response. Please try again." in a browser
// while every test was green, and the cause was a dev server that had been running since before the
// code it was serving existed. No in-process test can catch that: Vitest builds its OWN module graph
// from disk through its own Vite pipeline (vite.config.js's `test` block), so it is by construction
// blind to a stale server, a stale `node_modules/.vite` optimizer cache, or an `.env` file that
// changes which transport the bundle talks to.
//
// So this checks the SERVED ARTIFACT instead: it boots a real server, loads real URLs in real
// Chrome, and asserts the operator never sees error copy. It is the only check here that would have
// gone red on the reported failure.
//
//   npm run smoke          -> against `vite` (dev, in-memory transport — what `npm run dev` gives you)
//   npm run smoke -- build -> against `vite preview` on a production build, which reads
//                             .env.production and therefore exercises the HTTP transport path
//
// It starts its own server and refuses to run against one it did not start — see stopServer's own
// comment for the two defects that made that necessary.
//
// Deliberately NOT part of `npm test`: it needs a free port and a Chrome binary, and a unit suite
// that fails because a port was busy teaches people to ignore red.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const MODE = process.argv[2] === 'build' ? 'build' : 'dev'
const PORT = 5199

/** The URLs that must render. The first is the exact one from the Phase 2.1 report. */
const URLS = [
  '/action-stories/S10.2/reason/prop_s10_2_reason',
  '/action-stories/S10.2/decide/prop_s10_2_decide',
  '/action-stories/S9.1/decide/prop_s9_1_decide',
  '/action-stories/S10.6/live/prop_s10_6_live',
  '/action-stories/S10.2/reason', // the legacy two-segment shape, which must still redirect (C4)
  '/action-stories',
]

const ERROR_COPY = [
  'We got an unexpected response',
  'Something went wrong',
  "couldn't find that Action Story",
  "can't be displayed yet",
]

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function fail(message) {
  console.error(`\n  SMOKE FAILED: ${message}\n`)
  process.exitCode = 1
}

// ---- THE SERVER, AND NOT LEAKING IT -------------------------------------------------------------
//
// This script used to leak its own server, and then mis-report because of it. A `smoke -- build` run
// left `vite preview` bound to 5199; a later `npm run smoke` found the port answering, never noticed
// the dev server it started had failed to bind, and tested the PRODUCTION build against the deployed
// API while reporting itself as the dev run. It reproduced, in its own process handling, the exact
// stale-server failure it was written to catch.
//
// Two separate defects, and fixing only the first would leave the tool still able to lie:
//
//   1. IT LEAKED.        `spawn('npx', ['vite', ...])` starts an `npm exec` wrapper which forks the
//                        real vite. SIGTERM to the wrapper does not reach the child, so the server
//                        outlived the script. Fixed by spawning the local vite binary directly (no
//                        wrapper to lose the signal behind), starting it in its own process GROUP,
//                        and killing the group — then waiting for it to actually be gone rather
//                        than assuming.
//   2. IT TRUSTED THE PORT. `waitForServer` only asks "is something answering on 5199", which a
//                        stranger's server answers just as well as ours. A leftover preview, or a
//                        `npm run dev` someone left open, silently became the system under test.
//                        Fixed by requiring the port to be FREE before starting: if anything holds
//                        it, that is a hard failure naming the port, never a silent substitution.

/** True when nothing holds PORT. Asked by binding it, which is the only answer that is not a guess. */
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, '127.0.0.1')
  })
}

/** The local binary, so there is no `npx`/`npm exec` wrapper between us and the process we must kill. */
const LOCAL_BIN = path.resolve('node_modules/.bin/vite')

/** Kills the server's whole process GROUP and waits for the port to come back, or reports it leaked. */
async function stopServer(server, port) {
  if (!server || server.exitCode !== null) return
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill('SIGTERM')
  }
  for (let i = 0; i < 40; i += 1) {
    if (await portIsFree(port)) return
    if (i === 10) {
      try { process.kill(-server.pid, 'SIGKILL') } catch { server.kill('SIGKILL') }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  console.error(`  WARNING: port ${port} is still held after shutdown — a server was leaked.`)
}

/** Waits for the server to answer, rather than sleeping a guessed interval. */
async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/** Loads one URL in headless Chrome and returns its rendered text. */
function renderInChrome(url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-chrome-'))
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions', '--disable-sync',
      '--disable-background-networking', `--user-data-dir=${profile}`,
      '--virtual-time-budget=8000', '--dump-dom', url,
    ]
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    const discardProfile = () => fs.rmSync(profile, { recursive: true, force: true })
    let html = ''
    let settled = false

    // Chrome does NOT reliably exit after --dump-dom on macOS, so waiting on 'exit' hangs. Resolve
    // on OUTPUT QUIET instead: once the DOM has been written and nothing more arrives for 750ms, the
    // dump is complete and the browser is no longer interesting.
    let quiet
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(quiet)
      clearTimeout(killer)
      child.kill('SIGKILL')
      fs.rmSync(profile, { recursive: true, force: true })
      const text = html
        .replace(/<script[\s\S]*?<\/script>/g, ' ')
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
      resolve(text)
    }

    child.stdout.on('data', (d) => {
      html += d
      clearTimeout(quiet)
      quiet = setTimeout(finish, 750)
    })
    const killer = setTimeout(finish, 30_000)
    child.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(quiet)
      clearTimeout(killer)
      discardProfile() // the temp profile is this script's litter too, on the failure path as well
      reject(e)
    })
    child.on('exit', finish)
  })
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error(`  Chrome not found at ${CHROME}. Set CHROME_PATH to run the smoke test.`)
    process.exitCode = 1
    return
  }

  // BEFORE ANYTHING: the port must be ours. A server already on it is a hard stop, because the one
  // thing worse than this check failing is it passing against somebody else's build.
  if (!(await portIsFree(PORT))) {
    fail(
      `port ${PORT} is already in use. Something else is serving it — a leftover preview, or a ` +
      `\`npm run dev\`. This test will not run against a server it did not start, because that is ` +
      `how it reported a dev pass for a production build once already.\n` +
      `  Find it with:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
    )
    return
  }

  if (MODE === 'build') {
    console.log('  building…')
    await new Promise((resolve, reject) => {
      const b = spawn(LOCAL_BIN, ['build'], { stdio: 'inherit' })
      b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build exited ${code}`))))
    })
  }

  const cmd = MODE === 'build'
    ? ['preview', '--port', String(PORT), '--strictPort']
    : ['--port', String(PORT), '--strictPort']
  console.log(`  starting: vite ${cmd.join(' ')}`)
  // `detached` puts vite in its own process group so the whole tree dies with one signal, which is
  // what SIGTERM-to-the-npx-wrapper failed to do.
  const server = spawn(LOCAL_BIN, cmd, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let serverLog = ''
  server.stdout.on('data', (d) => { serverLog += d })
  server.stderr.on('data', (d) => { serverLog += d })

  // Ctrl-C is the commonest way this leaked in practice: the finally below never runs on a signal.
  const onSignal = () => { stopServer(server, PORT).finally(() => process.exit(130)) }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  try {
    const base = `http://localhost:${PORT}`
    if (!(await waitForServer(base))) {
      fail(`server never came up on ${PORT}\n--- server output ---\n${serverLog}`)
      return
    }

    for (const url of URLS) {
      const text = await renderInChrome(base + url)
      const hit = ERROR_COPY.find((c) => text.includes(c))
      if (hit) {
        fail(`${url} rendered operator error copy: "${hit}"\n  page text: ${text.slice(0, 400)}`)
        continue
      }
      // An empty page is not a pass. Every one of these URLs renders substantial content.
      if (text.length < 200) {
        fail(`${url} rendered almost nothing (${text.length} chars): ${text.slice(0, 200)}`)
        continue
      }
      console.log(`  ok  ${url}  (${text.length} chars)`)
    }

    if (!process.exitCode) console.log(`\n  SMOKE PASSED (${MODE}) — ${URLS.length} URLs, no error copy.\n`)
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await stopServer(server, PORT)
  }
}

main().catch((e) => fail(e.message))
