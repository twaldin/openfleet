const test = require("node:test")
const assert = require("node:assert/strict")

const { applyMessageProvenance, isParentTarget } = require("../bin/send")

test("isParentTarget recognizes reserved orchestrator aliases", () => {
  assert.equal(isParentTarget("parent", null), true)
  assert.equal(isParentTarget("orchestrator", null), true)
})

test("isParentTarget recognizes the active orchestrator tmux window name", () => {
  assert.equal(isParentTarget("cairn", { tmux_window: "cairn" }), true)
  assert.equal(isParentTarget("coder", { tmux_window: "cairn" }), false)
})

test("applyMessageProvenance prefixes messages with an explicit sender", () => {
  assert.equal(applyMessageProvenance("Ship it", { sender: "cron" }), "[CRON] Ship it")
})

test("applyMessageProvenance detects OPENFLEET_AGENT_NAME when sender is omitted", () => {
  assert.equal(
    applyMessageProvenance("Need help", { env: { OPENFLEET_AGENT_NAME: "coder" } }),
    "[CODER] Need help",
  )
})

test("applyMessageProvenance falls back to the current tmux window name", () => {
  const calls = []

  assert.equal(
    applyMessageProvenance("Investigate this", {
      env: { TMUX: "/tmp/tmux-1000/default,123,0", TMUX_PANE: "%7" },
      execFileSyncImpl(file, args) {
        calls.push({ file, args })
        return "cairn\n"
      },
    }),
    "[CAIRN] Investigate this",
  )

  assert.deepEqual(calls, [{
    file: "tmux",
    args: ["display-message", "-p", "-t", "%7", "#{window_name}"],
  }])
})

test("applyMessageProvenance falls back to UNKNOWN when it cannot resolve a sender", () => {
  assert.equal(applyMessageProvenance("Hello", { env: {} }), "[UNKNOWN] Hello")
})

test("applyMessageProvenance preserves an existing source prefix", () => {
  const discordMessage = "[DISCORD #fleet-status] tim: Ship it"
  assert.equal(applyMessageProvenance(discordMessage, { env: { OPENFLEET_AGENT_NAME: "gateway" } }), discordMessage)
})
