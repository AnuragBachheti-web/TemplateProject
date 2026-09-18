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
// PHASE 5D ADDED THE LAYOUT GATE. Three of this phase's assertions cannot be made anywhere else:
// scrolling, text clipping and the packed-row height contract are all LAYOUT, and jsdom has no
// layout engine — every clientHeight there is 0. Phase 5C's T62 is the cautionary tale: it asserted
// that each region's className contained `overflow-y-auto`, which was true while scrolling was
// completely broken, because `overflow-y: auto` on an element with an unconstrained height grows
// instead of scrolling. A property is not a behaviour. So T73/T75/T76/T78/T93 measure, in real Chrome,
// at both supported widths, and they FAIL the run — ruling R65: a browser check that reports
// without failing is the vacuous pass in a new costume.
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

/** Chrome's own flags, shared by the text dump and the layout session. */
const CHROME_FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync',
  '--disable-background-networking',
]

/**
 * Kills a Chrome we spawned, and its children.
 *
 * G2, FIXED HERE (ruling R65). `renderInChrome` spawned Chrome WITHOUT `detached` and then killed
 * only the direct child. Chrome forks renderer, GPU and network helpers; SIGKILL to the parent
 * leaves them running, so a full smoke run leaked six process trees and a temp profile each. The
 * same class of leak as the vite server above — and this harness is about to carry three more
 * assertions, so it does not get to be the thing that misleads next time. Spawned in its own
 * process GROUP, killed as a group, and the profile removed with retries because Chrome holds its
 * lock files for a moment after the signal.
 */
function killChrome(child, profile) {
  try { process.kill(-child.pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch { /* gone */ } }
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) } catch { /* chrome still letting go */ }
}

/** Loads one URL in headless Chrome and returns its rendered text. */
function renderInChrome(url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-chrome-'))
  return new Promise((resolve, reject) => {
    const args = [...CHROME_FLAGS, `--user-data-dir=${profile}`, '--virtual-time-budget=8000', '--dump-dom', url]
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'ignore'], detached: true })
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
      killChrome(child, profile)
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
      killChrome(child, profile) // the leak and the litter are this script's on the failure path too
      reject(e)
    })
    child.on('exit', finish)
  })
}


// ---- THE LAYOUT GATE (Phase 5D: T73, T75, T76, T78 · Phase 5E: T93) -----------------------------
//
// A real browser, driven over the DevTools Protocol, at both supported widths. No dependency is
// added: Chrome is already spawned above, and Node has a global WebSocket.

const LAYOUT_WIDTHS = [1440, 1280]
/** Tall enough to be a real laptop, short enough that a long pane genuinely overflows. */
const LAYOUT_HEIGHT = 720

/** Opens ONE Chrome and yields { goto, evaluate, setViewport } — 100+ navigations, one browser. */
async function layoutSession(fn) {
  const port = 9300 + Math.floor(Math.random() * 400)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-layout-'))
  const child = spawn(CHROME, [...CHROME_FLAGS, `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore', detached: true })
  let ws
  try {
    let target
    for (let i = 0; i < 120; i += 1) {
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
        target = list.find((t) => t.type === 'page')
        if (target) break
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 125))
    }
    if (!target) throw new Error('Chrome never exposed a debugging target for the layout gate')

    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')) })
    let id = 0
    const pending = new Map()
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id)
        pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
    await send('Page.enable')
    await send('Runtime.enable')

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed')
      return r.result.value
    }
    const setViewport = (width, height) =>
      send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    const goto = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 120; i += 1) {
        const ready = await evaluate('!!document.querySelector(\'[data-scroll-region="main"] [data-block-slot]\')').catch(() => false)
        if (ready) break
        await new Promise((r) => setTimeout(r, 100))
      }
      await new Promise((r) => setTimeout(r, 150)) // let fonts and final layout settle
    }
    return await fn({ goto, evaluate, setViewport, send })
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    killChrome(child, profile)
  }
}

/**
 * T73 — each region SCROLLS, and its last block is reachable.
 * T75 — no rendered text is horizontally clipped.
 * T76 — any remaining truncation carries a reachable affordance.
 * T78 — a packed row's two cards are equal height (the ruled vertical contract).
 * T93 — a table's columns are attributes its records SHARE, measured in the rendered DOM.
 */
const LAYOUT_PROBE = `
(() => {
  const report = { scroll: [], clipped: [], unreachable: [], packed: [], hollow: [], widest: null };

  // --- T73: a region either fits, or it scrolls. It must never overflow its own track silently.
  const grid = document.querySelector('[data-scroll-region="main"]')?.parentElement;
  for (const region of document.querySelectorAll('[data-scroll-region]')) {
    const name = region.getAttribute('data-scroll-region');
    const trackBottom = grid.getBoundingClientRect().bottom;
    const overflowsTrack = region.getBoundingClientRect().bottom > trackBottom + 1;
    const scrollable = region.scrollHeight > region.clientHeight + 1;
    // The real question: is the LAST block reachable by scrolling this region?
    region.scrollTop = region.scrollHeight;
    const last = region.querySelector(':scope > *:last-child');
    const lastBottom = last ? last.getBoundingClientRect().bottom : 0;
    const reachable = !last || lastBottom <= region.getBoundingClientRect().bottom + 2;
    region.scrollTop = 0;
    report.scroll.push({ region: name, clientH: region.clientHeight, scrollH: region.scrollHeight,
                         scrollable, overflowsTrack, reachable });
  }

  // --- T75/T76: horizontally cut text, and whether the operator can still reach it.
  for (const el of document.querySelectorAll('[data-scroll-region] *')) {
    if (el.children.length > 0) continue;
    const text = (el.textContent || '').trim();
    if (text === '') continue;
    // VISUALLY HIDDEN BY DESIGN is not clipping. Tailwind's sr-only is width:1px with
    // clip:rect(0,0,0,0) and white-space:nowrap, which makes every screen-reader label
    // ("Select row 3", "No value") look exactly like cut text to a scrollWidth check — 1440 false
    // positives on the first run. Tested by BEHAVIOUR rather than by class name: a 1px-wide box, or
    // one clipped to nothing, is hidden on purpose. A class-name check was the first attempt and
    // silently never fired, because a backslash-b inside a template literal is the backspace
    // escape rather than a word boundary, so the regex was matching a control character.
    const cs = getComputedStyle(el);
    if (el.clientWidth <= 1 || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const slot = el.closest('[data-block-slot]');
    const entry = { slot: slot ? slot.getAttribute('data-block-slot') : '(none)',
                    cut: el.scrollWidth - el.clientWidth, text: text.slice(0, 60),
                    cls: (el.className || '').toString().slice(0, 60) };
    report.clipped.push(entry);
    if (!el.getAttribute('title') && !el.closest('[title]')) report.unreachable.push(entry);
  }

  // --- T93: no column is mostly empty (Phase 5E, R74).
  // THE DEFECT'S SIGNATURE, not its symptom. S10.1/decide's slate unioned four records into fifteen
  // columns; eight of them read "—" on nearly every row, the Body column got 106px, and a
  // 213-character paragraph wrapped over FORTY-FOUR lines. Measured here, in Chrome, at both widths.
  //
  // Why this and not "no cell wraps past N lines": that threshold would have to be set above
  // S9.17/decide, whose sixteen columns are each filled on every row and whose worst cell still
  // wraps 25 lines. Its records genuinely carry that much, and narrowing it is Phase 6's question
  // (the reference renders those as stacked cards). A line-count gate would either fail on work this
  // phase is not allowed to do, or be tuned until it only fired on one screen — which is the
  // layout-lever failure R75 names. What IS always wrong, at any width and any column count, is
  // spending a column on a field the records mostly lack.
  for (const table of document.querySelectorAll('[data-scroll-region] table')) {
    const slot = table.closest('[data-block-slot]');
    const name = slot ? slot.getAttribute('data-block-slot') : '(none)';
    const heads = [...table.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim());
    // The detail line is a colSpan row carrying the demoted fields; it is not a record.
    const rows = [...table.querySelectorAll('tbody tr')].filter((tr) => !tr.querySelector('td[colspan]'));
    if (rows.length === 0) continue;
    const host = table.parentElement;
    const w = Math.round(table.getBoundingClientRect().width);
    if (!report.widest || w > report.widest.w) {
      report.widest = { slot: name, w, hostW: host.clientWidth, cols: heads.length };
    }
    for (let c = 0; c < heads.length; c += 1) {
      const head = heads[c];
      if (head === '' || head === 'Select') continue;
      // THE MISSING-VALUE AFFORDANCE, not the em dash glyph. Three columns in this corpus carry
      // "—" as their literal DATA (prop_s9_9_execute's plan.st on all 9 rows, prop_s9_4_decide's
      // coverStr on 3 of 5, prop_s9_12_execute's ledger.hash on 3 of 4). A glyph check called those
      // empty, and the only way to act on it would be a rule that reads a cell's text and decides
      // it means nothing — a content classifier in the layout layer, which is the defect class this
      // project has removed four times already (R72). So the probe asks what the CELL decided:
      // TableBlock pairs its dash with an sr-only "No value", and a real value never carries one.
      // That the corpus writes "no value" as a dash is a corpus finding, recorded, not repaired
      // here.
      const blank = rows.filter((tr) => {
        const cell = tr.children[c];
        if (!cell) return false;
        return [...cell.querySelectorAll('span')].some((el) => (el.textContent || '').trim() === 'No value');
      }).length;
      if (blank / rows.length > 0.5) {
        report.hollow.push({ slot: name, head, blank, rows: rows.length });
      }
    }
  }

  // --- T78: the packed row's two cards are the same height.
  for (const row of document.querySelectorAll('[data-pack-row]')) {
    const cards = [...row.querySelectorAll(':scope > [data-block-slot]')].map((cell) => {
      const card = cell.firstElementChild;
      return { slot: cell.getAttribute('data-block-slot'),
               cellH: Math.round(cell.getBoundingClientRect().height),
               cardH: card ? Math.round(card.getBoundingClientRect().height) : 0 };
    });
    report.packed.push(cards);
  }
  return report;
})()
`

/** Runs the layout gate over every corpus object at both widths. Returns the failures. */
async function runLayoutGate(base) {
  const dataset = JSON.parse(fs.readFileSync(
    path.resolve('src/features/action-stories/__corpus__/normalized/dataset.json'), 'utf8'))
  const failures = []
  let checked = 0

  await layoutSession(async ({ goto, evaluate, setViewport }) => {
    for (const width of LAYOUT_WIDTHS) {
      await setViewport(width, LAYOUT_HEIGHT)
      for (const d of dataset) {
        const where = `${d.proposal_id} @${width}`
        await goto(`${base}/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
        let r
        try {
          r = await evaluate(LAYOUT_PROBE)
        } catch (e) {
          failures.push(`${where}: layout probe threw — ${e.message}`)
          continue
        }
        checked += 1

        // T73
        for (const s of r.scroll) {
          if (s.overflowsTrack) {
            failures.push(`T73 ${where}: the ${s.region} region overflows its track instead of scrolling ` +
              `(client ${s.clientH}, scroll ${s.scrollH}) — content below the fold is unreachable`)
          }
          if (!s.reachable) {
            failures.push(`T73 ${where}: the ${s.region} region's last block is not reachable by scrolling it`)
          }
        }
        // T75
        for (const c of r.clipped) {
          failures.push(`T75 ${where}: "${c.slot}" clips ${c.cut}px of text — ${JSON.stringify(c.text)}`)
        }
        // T76 (a clipped value with no title is unreachable; reported separately so the cause is clear)
        for (const c of r.unreachable) {
          failures.push(`T76 ${where}: "${c.slot}" truncates with no affordance — ${JSON.stringify(c.text)}`)
        }
        // T93
        for (const h of r.hollow) {
          failures.push(`T93 ${where}: "${h.slot}" spends a column on "${h.head}", which is empty on ` +
            `${h.blank} of ${h.rows} rows — a union artefact, not a shared attribute`)
        }
        // T78
        for (const row of r.packed) {
          if (row.length !== 2) continue
          const [a, b] = row
          if (Math.abs(a.cardH - b.cardH) > 2) {
            failures.push(`T78 ${where}: packed row cards differ in height — ` +
              `${a.slot} ${a.cardH}px vs ${b.slot} ${b.cardH}px (${Math.abs(a.cardH - b.cardH)}px of dead space)`)
          }
        }
      }
      console.log(`  layout gate: ${width}px checked`)
    }
  })
  return { failures, checked }
}


// ---- THE VARIANT SCREENSHOT PASS (Phase 5B: T92) ------------------------------------------------
//
// WHY AN ARTEFACT AND NOT ANOTHER MEASUREMENT. Phase 5D found BOTH of its visual regressions by
// opening a screenshot after its measurement gate was already green: a `<th>` clamp that collapsed
// a table header into one stacked column, and an overflow-wrap rule that broke "Label" into
// "Labe/l". Every height and width was in tolerance for both; the tables were simply the wrong
// shape, and no probe asked about shape. A phase that is entirely visual cannot be gated by
// measurement alone (I8), so this captures one PNG per variant per supported width and fails the
// run if any is missing. The image is for a human; the failure is for the build.

const SHOT_DIR = path.resolve('artifacts/variant-screenshots')

/** One object per variant, chosen because it carries that variant's distinguishing feature. */
const VARIANT_SHOTS = [
  { variant: 'metricGrid', slot: 'recommendation_metrics', path: '/action-stories/S9.1/decide/prop_s9_1_decide' },
  { variant: 'meteredRow', slot: 'coverage', path: '/action-stories/S9.18/decide/prop_s9_18_decide' },
  { variant: 'zoneRow', slot: 'matrix', path: '/action-stories/S9.18/analyze/prop_s9_18_analyze' },
  { variant: 'groupCard', slot: 'item_groups', path: '/action-stories/S9.7/decide/prop_s9_7_decide' },
  { variant: 'routeCard', slot: 'next_actions', path: '/action-stories/S10.3/decide/prop_s10_3_decide' },
  { variant: 'scenarioCard', slot: 'alternatives', path: '/action-stories/S9.14/decide/prop_s9_14_decide' },
]

async function captureVariantScreenshots(base) {
  fs.rmSync(SHOT_DIR, { recursive: true, force: true })
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const failures = []
  const written = []

  await layoutSession(async ({ goto, setViewport, send, evaluate }) => {
    for (const width of LAYOUT_WIDTHS) {
      await setViewport(width, LAYOUT_HEIGHT)
      for (const shot of VARIANT_SHOTS) {
        await goto(base + shot.path)
        // SCROLL THE VARIANT INTO FRAME FIRST. The first version of this pass captured the fold,
        // and for `routeCard` and `scenarioCard` the block sits below it — so the artefact existed,
        // T92 passed, and the picture did not contain the thing it was evidence for. A screenshot
        // that does not show its variant proves exactly as much as no screenshot.
        const inFrame = await evaluate(`
          (() => {
            const el = document.querySelector('[data-block-slot="${shot.slot}"]');
            if (!el) return false;
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            return r.top < innerHeight && r.bottom > 0 && r.height > 0;
          })()
        `).catch(() => false)
        if (!inFrame) {
          failures.push(`T92 ${shot.variant} @${width}: "${shot.slot}" could not be brought into frame`)
        }
        await new Promise((r) => setTimeout(r, 120))
        const file = path.join(SHOT_DIR, `${shot.variant}-${width}.png`)
        try {
          const { data } = await send('Page.captureScreenshot', { format: 'png' })
          fs.writeFileSync(file, Buffer.from(data, 'base64'))
          written.push(file)
        } catch (e) {
          failures.push(`T92 ${shot.variant} @${width}: screenshot failed — ${e.message}`)
        }
      }
    }
  })

  // A missing or empty file is a FAILURE, never a warning (R65's rule, applied to the artefact):
  // a screenshot pass that reports without failing is how the review quietly stops happening.
  for (const width of LAYOUT_WIDTHS) {
    for (const shot of VARIANT_SHOTS) {
      const file = path.join(SHOT_DIR, `${shot.variant}-${width}.png`)
      if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
        failures.push(`T92 ${shot.variant} @${width}: no screenshot at ${path.relative(process.cwd(), file)}`)
      }
    }
  }
  return { failures, written: written.length }
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

    // THE LAYOUT GATE. Runs after the error-copy pass, over every object, at both widths. Its
    // failures are FAILURES (R65) — the run goes red, it does not warn.
    const { failures, checked } = await runLayoutGate(base)
    if (failures.length > 0) {
      const shown = failures.slice(0, 25)
      fail(`layout gate: ${failures.length} failure(s) across ${checked} page loads\n` +
        shown.map((f) => `    ${f}`).join('\n') +
        (failures.length > shown.length ? `\n    … and ${failures.length - shown.length} more` : ''))
    } else {
      console.log(`  ok  layout gate — ${checked} page loads, no clipped text, both regions scroll`)
    }

    const shots = await captureVariantScreenshots(base)
    if (shots.failures.length > 0) {
      fail(`variant screenshots: ${shots.failures.length} missing\n` + shots.failures.map((f) => `    ${f}`).join('\n'))
    } else {
      console.log(`  ok  variant screenshots — ${shots.written} captured in ${path.relative(process.cwd(), SHOT_DIR)}`)
    }

    if (!process.exitCode) console.log(`\n  SMOKE PASSED (${MODE}) — ${URLS.length} URLs, no error copy, layout gate clean, ${shots.written} screenshots.\n`)
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await stopServer(server, PORT)
  }
}

main().catch((e) => fail(e.message))
