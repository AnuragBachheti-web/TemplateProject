import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { slotLabel } from './slotLabel'
import { humanizeSlotName } from './humanizeSlotName'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../../..')

function sourceFiles(dir = SRC, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '__corpus__') sourceFiles(full, out)
    } else if (/\.(?:js|jsx)$/.test(e.name) && !/\.test\.(?:js|jsx)$/.test(e.name)) {
      out.push(full)
    }
  }
  return out
}

describe('slotLabel — the slot decides its heading, the block does not', () => {
  it('returns the declared label where the slot has one', () => {
    expect(slotLabel('trigger')).toBe('What raised this')
  })

  it('falls back to humanizing the name for every slot that declares none', () => {
    for (const [name, spec] of Object.entries(SLOT_VOCABULARY)) {
      if (spec.label !== undefined) continue
      expect(slotLabel(name)).toBe(humanizeSlotName(name))
    }
    expect(slotLabel('not_a_slot_at_all')).toBe('Not A Slot At All')
  })

  it('a declared label is a non-empty string that actually differs from the fallback', () => {
    // A label equal to what humanizing already produces is dead configuration: it reads as a
    // deliberate override while overriding nothing, and the next reader cannot tell which.
    for (const [name, spec] of Object.entries(SLOT_VOCABULARY)) {
      if (spec.label === undefined) continue
      expect(typeof spec.label, `${name}`).toBe('string')
      expect(spec.label.trim(), `${name}`).not.toBe('')
      expect(spec.label, `${name} declares a label identical to the fallback`).not.toBe(humanizeSlotName(name))
    }
  })
})

describe('no runtime module titles a slot by humanizing its name', () => {
  // The structural half. Without this, the next block added goes back to `humanizeSlotName(slotName)`
  // — which is not wrong-looking, just silently unable to ever honour a declared label — and the
  // heading for one concept drifts across the blocks that render it, which is the per-screen accident
  // slotVocabulary.js exists to prevent.
  it('every slot heading goes through slotLabel', () => {
    const offenders = sourceFiles()
      // The two modules that DEFINE the pair: humanizeSlotName.js declares `humanizeSlotName(slotName)`
      // as its own signature, and slotLabel.js is the one legitimate caller — the fallback itself.
      .filter((f) => !['slotLabel.js', 'humanizeSlotName.js'].includes(path.basename(f)))
      .filter((f) => /humanizeSlotName\((?:this\.props\.)?slotName\)/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f))
    expect(offenders).toEqual([])
  })

  it('and slotLabel is the only reader of a slot spec\'s label', () => {
    const readers = sourceFiles()
      .filter((f) => /\.label\b/.test(fs.readFileSync(f, 'utf8')) && /SLOT_VOCABULARY/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f))
    expect(readers).toEqual(['features/action-stories/blocks/slotLabel.js'])
  })
})
