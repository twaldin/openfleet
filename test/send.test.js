const test = require("node:test")
const assert = require("node:assert/strict")

const { isParentTarget } = require("../bin/send")

test("isParentTarget recognizes reserved orchestrator aliases", () => {
  assert.equal(isParentTarget("parent", null), true)
  assert.equal(isParentTarget("orchestrator", null), true)
})

test("isParentTarget recognizes the active orchestrator tmux window name", () => {
  assert.equal(isParentTarget("cairn", { tmux_window: "cairn" }), true)
  assert.equal(isParentTarget("coder", { tmux_window: "cairn" }), false)
})
