const test = require("node:test")
const assert = require("node:assert/strict")
const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { createBlocker, getBlocker } = require("../core/runtime/blockers")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-blockers-"))
}

test("createBlocker defaults blockers to orchestrator and not escalated", () => {
  const stateDir = tempStateDir()
  const blocker = createBlocker(stateDir, { summary: "Need guidance" })

  assert.equal(blocker.blocked_on_type, "orchestrator")
  assert.equal(blocker.escalated, false)
})

test("task-state blocker update can escalate a blocker to human", () => {
  const stateDir = tempStateDir()
  const blocker = createBlocker(stateDir, { summary: "Need approval" })

  execFileSync("node", [
    path.join(__dirname, "..", "bin", "task-state"),
    "blocker",
    "update",
    blocker.id,
    "--state-root",
    stateDir,
    "--type",
    "human",
    "--escalated",
    "true",
  ], { encoding: "utf8" })

  const updated = getBlocker(stateDir, blocker.id)
  assert.equal(updated.blocked_on_type, "human")
  assert.equal(updated.escalated, true)
})

test("task-state blocker update preserves type and escalation when omitted", () => {
  const stateDir = tempStateDir()
  const blocker = createBlocker(stateDir, {
    summary: "Need approval",
    blocked_on_type: "human",
    escalated: true,
    blocked_on_id: "user_tim",
  })

  execFileSync("node", [
    path.join(__dirname, "..", "bin", "task-state"),
    "blocker",
    "update",
    blocker.id,
    "--state-root",
    stateDir,
    "--status",
    "open",
  ], { encoding: "utf8" })

  const updated = getBlocker(stateDir, blocker.id)
  assert.equal(updated.status, "open")
  assert.equal(updated.blocked_on_type, "human")
  assert.equal(updated.escalated, true)
  assert.equal(updated.blocked_on_id, "user_tim")
})
