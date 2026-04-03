const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const {
  getAgent,
  listAgents,
  loadAgents,
  removeAgent,
  saveAgents,
  upsertAgent,
} = require("../core/runtime/agents")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-agents-"))
}

test("loadAgents returns an empty map when agents.json is absent", () => {
  const stateDir = tempStateDir()

  assert.deepEqual(loadAgents(stateDir), {})
})

test("saveAgents and getAgent persist named agents", () => {
  const stateDir = tempStateDir()
  saveAgents(stateDir, {
    trader: {
      name: "trader",
      role: "persistent",
      harness: "opencode",
      model: "gpt-5.4",
      channel: "channel://trader",
      directory: "~/cairn/agents/trader",
      playbook: "",
      state_file: "state.md",
    },
  })

  assert.deepEqual(getAgent(stateDir, "trader"), {
    name: "trader",
    role: "persistent",
    harness: "opencode",
    model: "gpt-5.4",
    channel: "channel://trader",
    directory: "~/cairn/agents/trader",
    playbook: "",
    state_file: "state.md",
  })
})

test("upsertAgent creates and updates an agent record", () => {
  const stateDir = tempStateDir()

  upsertAgent(stateDir, {
    name: "monitor",
    role: "persistent",
    harness: "opencode",
    model: "gpt-5.4-mini",
    channel: "channel://monitor",
    directory: "~/cairn/agents/monitor",
    playbook: "MONITOR PLAYBOOK",
    state_file: "state.md",
  })

  const updated = upsertAgent(stateDir, {
    name: "monitor",
    model: "big-pickle",
    schedule: { interval: 120 },
  })

  assert.equal(updated.name, "monitor")
  assert.equal(updated.role, "persistent")
  assert.equal(updated.model, "big-pickle")
  assert.deepEqual(updated.schedule, { interval: 120 })
  assert.equal(getAgent(stateDir, "monitor").harness, "opencode")
})

test("removeAgent deletes records and listAgents returns sorted values", () => {
  const stateDir = tempStateDir()

  upsertAgent(stateDir, { name: "trader", role: "persistent" })
  upsertAgent(stateDir, { name: "coder-gpt", role: "ephemeral" })

  assert.deepEqual(listAgents(stateDir).map((agent) => agent.name), ["coder-gpt", "trader"])
  assert.equal(removeAgent(stateDir, "trader"), true)
  assert.equal(removeAgent(stateDir, "missing"), false)
  assert.equal(getAgent(stateDir, "trader"), null)
})
