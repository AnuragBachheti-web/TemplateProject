#!/usr/bin/env node
// Iterates every (code, stageKey) pair in data/index.json, runs its manifest through
// validateManifest and every one of its blocks' binding through resolveBinding +
// validateBlockData, and prints a pass/fail table. No browser needed — this is the same check
// StageRenderer does at render time, run ahead of time against every stage at once.
//
// Usage: node extraction/validateAllStages.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifest } from '../src/features/action-stories/manifests/validateManifest.js';
import { resolveBinding } from '../src/features/action-stories/manifests/resolveBinding.js';
import { validateBlockData } from '../src/features/action-stories/manifests/blockTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'src/features/action-stories/data');
const MANIFESTS_DIR = path.join(REPO_ROOT, 'src/features/action-stories/manifests');

function checkStage(workflow, stageKey) {
  const manifestPath = path.join(MANIFESTS_DIR, `${workflow.code}.json`);
  const stageManifests = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifest = stageManifests.find((m) => m.stageKey === stageKey);

  const manifestProblems = [];
  const bindingProblems = [];

  if (!manifest) {
    manifestProblems.push(`no manifest entry for stage "${stageKey}"`);
    return { code: workflow.code, stageKey, manifestProblems, bindingProblems };
  }

  manifestProblems.push(...validateManifest(manifest));

  const fixturePath = path.join(DATA_DIR, 'raw', workflow.code, `${stageKey}.json`);
  if (!fs.existsSync(fixturePath)) {
    bindingProblems.push(`no fixture file at ${path.relative(REPO_ROOT, fixturePath)}`);
    return { code: workflow.code, stageKey, manifestProblems, bindingProblems };
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  for (const block of manifest.blocks) {
    const value = resolveBinding(block.binding, fixture);
    if (value === undefined) {
      bindingProblems.push(`"${block.slotName}" (${block.binding}): resolves to nothing`);
      continue;
    }
    const problems = validateBlockData(block.blockType, value);
    if (problems.length > 0) {
      bindingProblems.push(`"${block.slotName}" (${block.binding}): ${problems.join('; ')}`);
    }
  }

  return { code: workflow.code, stageKey, manifestProblems, bindingProblems };
}

function main() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'));

  const results = [];
  for (const workflow of index) {
    for (const stageKey of workflow.stages) {
      results.push(checkStage(workflow, stageKey));
    }
  }

  const codeWidth = Math.max(4, ...results.map((r) => r.code.length));
  const stageWidth = Math.max(5, ...results.map((r) => r.stageKey.length));

  console.log('CODE'.padEnd(codeWidth) + '  ' + 'STAGE'.padEnd(stageWidth) + '  STATUS');
  console.log('-'.repeat(codeWidth + stageWidth + 12));

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const ok = r.manifestProblems.length === 0 && r.bindingProblems.length === 0;
    if (ok) passed++;
    else failed++;

    console.log(`${r.code.padEnd(codeWidth)}  ${r.stageKey.padEnd(stageWidth)}  ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) {
      for (const p of r.manifestProblems) console.log(`    manifest problem: ${p}`);
      for (const p of r.bindingProblems) console.log(`    binding problem : ${p}`);
    }
  }

  console.log('-'.repeat(codeWidth + stageWidth + 12));
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) process.exitCode = 1;
}

main();
