#!/usr/bin/env node
// Turns the .dc.html mockup exports in source-mockups/ into clean JSON fixtures under
// src/features/action-stories/data/. See extraction/README.md for the file-format background.
//
// Usage: node extraction/extract.js [sourceDir] [dataOutDir]
//   sourceDir   defaults to <repo>/source-mockups
//   dataOutDir  defaults to <repo>/src/features/action-stories/data
// (both overridable so the pipeline can be smoke-tested against a scratch fixture dir without
// touching real output.)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAGE_ORDER,
  classifyFilename,
  extractDcScriptTag,
  parseDataProps,
  flattenPropsDefaults,
  extractBreadcrumbName,
  extractInstanceHeadline,
  extractControlElements,
} from './parseMockup.js'
import { runScreenScript, attachRawRecords, computeControlPayload } from './dcLogicSandbox.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const SOURCE_DIR = path.resolve(process.argv[2] || path.join(REPO_ROOT, 'source-mockups'))
const DATA_OUT_DIR = path.resolve(process.argv[3] || path.join(REPO_ROOT, 'src/features/action-stories/data'))
const RAW_OUT_DIR = path.join(DATA_OUT_DIR, 'raw')

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .sort((a, b) => a.localeCompare(b))
}

function extractOne(filename) {
  const fullPath = path.join(SOURCE_DIR, filename)
  const html = fs.readFileSync(fullPath, 'utf8')

  const scriptTag = extractDcScriptTag(html)
  if (!scriptTag) {
    throw new Error('no <script type="text/x-dc" data-dc-script> block found')
  }

  const propsSchema = parseDataProps(scriptTag.openTag)
  const propsDefaults = flattenPropsDefaults(propsSchema)

  return { html, scriptTag, propsDefaults }
}

function main() {
  fs.mkdirSync(RAW_OUT_DIR, { recursive: true })

  const files = listSourceFiles(SOURCE_DIR)

  const extracted = []
  const skipped = []
  const failed = []
  const warnings = []
  /** @type {Map<string, { code: string, name: string, stages: Set<string>, nameVariants: Set<string> }>} */
  const workflows = new Map()

  for (const filename of files) {
    const classification = classifyFilename(filename)
    if (classification.skip) {
      skipped.push({ filename, reason: classification.reason })
      continue
    }

    const { code, stageKey, warnings: classifyWarnings } = classification
    for (const w of classifyWarnings || []) {
      warnings.push(`${filename}: ${w}`)
    }

    try {
      const { html, scriptTag, propsDefaults } = extractOne(filename)

      const name = extractBreadcrumbName(html, code)
      if (!name) {
        throw new Error(`breadcrumb ">NAME · ${code}<" not found in markup`)
      }
      // Distinct from `name` (the workflow/category identity above): the Action Story INSTANCE
      // headline, when this screen's banner has one — see extractInstanceHeadline's own doc
      // comment. Not every mockup export is guaranteed to carry this exact banner shape, so absence
      // (`null`) is a normal, non-fatal outcome, unlike a missing breadcrumb name.
      const headline = extractInstanceHeadline(html)

      // P0 fix (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §2/§3): recover a real interactive control's
      // own declared bounds from the TEMPLATE markup (never present in the <script data-dc-script>
      // block runScreenScript's sandbox executes), then multi-sample the screen's own real logic at
      // several positions across that range so its actual dependency set can be measured, not guessed.
      const controls = extractControlElements(html)
      const { state, data: rawRenderData, rawCandidates, controlSamples } = runScreenScript(
        scriptTag.body,
        propsDefaults,
        controls,
      )

      // Preserve raw structured records (never destroy them by only keeping renderVals()'s own
      // formatted-string projection — see attachRawRecords' own doc comment) before anything else
      // touches `data`.
      let data = attachRawRecords(rawRenderData, rawCandidates)

      // Turn each confirmed control's bare current-value field into its real, complete slider shape
      // — {min, max, step, value, dependencies, steps} — so classifyBlocks.js's existing, unmodified
      // isSliderShaped() (a plain generic {min,max,value} shape check) recognizes it with zero
      // classifier changes, exactly like every other real slider would.
      if (controlSamples.length > 0) {
        const patched = { ...data }
        for (const sample of controlSamples) {
          const baseValue = data[sample.stateKey]
          if (typeof baseValue !== 'number') continue // markup/state mismatch — never fabricate a shape
          patched[sample.stateKey] = computeControlPayload(data, { ...sample, default: baseValue }, sample.samples)
        }
        data = patched
      }

      const fixture = { code, stageKey, name, ...(headline ? { headline } : {}), props: propsDefaults, state, data }

      const outDir = path.join(RAW_OUT_DIR, code)
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, `${stageKey}.json`), JSON.stringify(fixture, null, 2) + '\n')

      extracted.push({ filename, code, stageKey, name, headline })

      if (!workflows.has(code)) {
        workflows.set(code, { code, name, stages: new Set(), nameVariants: new Set(), headlineVariants: new Set() })
      }
      const wf = workflows.get(code)
      wf.stages.add(stageKey)
      wf.nameVariants.add(name)
      if (headline) wf.headlineVariants.add(headline)
    } catch (err) {
      failed.push({ filename, reason: err.message })
    }
  }

  const index = [...workflows.values()]
    .map((wf) => ({
      code: wf.code,
      name: wf.name,
      // Workflow/category identity (`name`) and Action Story instance identity (`headline`) are
      // kept as two separate fields end to end, never overloaded onto one — see
      // FORENSIC_AUDIT_S9.1.md §6/§17 for why conflating them was the original bug. `headline` is
      // first-seen-wins across a workflow's stages (like `name`) since every mockup checked keeps
      // it constant across its own reason/analyze/decide/execute run; omitted entirely when no
      // stage of this workflow had a matching banner (an older/differently-shaped export), so a
      // missing headline degrades to "no subtitle" downstream, never a fabricated one.
      ...(wf.headlineVariants.size > 0 ? { headline: [...wf.headlineVariants][0] } : {}),
      stages: STAGE_ORDER.filter((s) => wf.stages.has(s)),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  fs.writeFileSync(path.join(DATA_OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n')

  for (const wf of workflows.values()) {
    if (wf.nameVariants.size > 1) {
      warnings.push(`${wf.code}: breadcrumb name differs across its stages: ${[...wf.nameVariants].join(' / ')}`)
    }
    if (wf.headlineVariants.size > 1) {
      warnings.push(`${wf.code}: instance headline differs across its stages: ${[...wf.headlineVariants].join(' / ')}`)
    }
  }

  printReport({ files, extracted, skipped, failed, warnings, workflowCount: workflows.size })

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

function printReport({ files, extracted, skipped, failed, warnings, workflowCount }) {
  const line = '─'.repeat(60)
  console.log(line)
  console.log('Action Stories extraction report')
  console.log(line)
  console.log(`source dir:     ${SOURCE_DIR}`)
  console.log(`output dir:     ${DATA_OUT_DIR}`)
  console.log(`files seen:     ${files.length}`)
  console.log(`extracted:      ${extracted.length} stage file(s) across ${workflowCount} workflow(s)`)
  console.log(`skipped:        ${skipped.length} (expected: shells/duplicates/non-story files)`)
  console.log(`failed:         ${failed.length}`)

  if (skipped.length > 0) {
    console.log('')
    console.log('Skipped:')
    for (const s of skipped) {
      console.log(`  - ${s.filename}: ${s.reason}`)
    }
  }

  if (failed.length > 0) {
    console.log('')
    console.log('FAILED (did not produce a fixture):')
    for (const f of failed) {
      console.log(`  - ${f.filename}: ${f.reason}`)
    }
  }

  if (warnings.length > 0) {
    console.log('')
    console.log('Warnings (extracted anyway):')
    for (const w of warnings) {
      console.log(`  - ${w}`)
    }
  }

  console.log(line)
}

main()
