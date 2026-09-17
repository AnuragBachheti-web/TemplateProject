// THE DEPTH CONTRACT for the render tree, and the reason it is a constant rather than a convention.
//
// Before Phase 3B a block was a LEAF: a row could not host a badge, a chip or a metric, so anything
// structured inside a row was flattened to text by nestedEntryText.js's flattenNestedEntry before
// any block got a chance to render it richly. Row-level composition is what this phase adds, and
// the moment composition exists so does the risk it grows without limit — a card containing a table
// containing a card is how a layout becomes unreviewable.
//
// So there are exactly four levels, and the fourth is the last:
//
//   1  PANE     the stage's whole rendered surface        StageRenderer
//   2  SECTION  a region/section from composeSections     StageSections
//   3  BLOCK    one slot's blockType component            BLOCK_REGISTRY
//   4  CHILD    a component a block composes per row      blocks/children/
//
// A CHILD IS NOT A BLOCK. It is a plain component, imported statically by its parent, and it is
// deliberately absent from BLOCK_REGISTRY and BLOCK_TYPES — so no slot can ever target one and no
// child can re-enter the slot pipeline. That absence is the enforcement; this constant is the
// statement of intent that the absence implements.
//
// A child may render a list internally (see children/SubRowList.jsx). That is DOM depth, not block
// depth: the limit counts how many times the pipeline nests a component that owns a slot's data,
// not how many <div>s end up in the tree.
//
// `data-block-depth` is emitted at every level so blockVocabulary.test.jsx's T26 measures the REAL
// tree rather than trusting this file. A cap that holds because nothing reaches it proves nothing,
// which is why T26 also asserts depth 4 is actually reached on real data.

/** Pane > Section > Block > child. The fourth level composes DOM, never another block. */
export const MAX_BLOCK_DEPTH = 4

export const DEPTH_PANE = 1
export const DEPTH_SECTION = 2
export const DEPTH_BLOCK = 3
export const DEPTH_CHILD = 4

/**
 * The attributes every level emits, so the depth of the rendered tree is observable from the DOM.
 * Kept here rather than spelled out at four call sites, because a level that forgot to announce
 * itself would make the cap unverifiable and the test would pass on a thinner tree.
 *
 * @param {number} depth - one of the DEPTH_* constants.
 * @param {string} [blockType] - present at DEPTH_BLOCK, so T24 can find a block by type.
 */
export function depthAttrs(depth, blockType) {
  return blockType === undefined
    ? { 'data-block-depth': depth }
    : { 'data-block-depth': depth, 'data-block-type': blockType }
}
