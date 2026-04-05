const test = require("node:test")
const assert = require("node:assert/strict")

const { executeJob } = require("../bin/cron")

test("executeJob sends cron provenance when routing to the parent", () => {
  const calls = []

  executeJob({ id: "status", target: "parent", prompt: "Summarize" }, {
    binDir: "/tmp/openfleet/bin",
    runImpl(cmd, args) {
      calls.push({ cmd, args })
    },
  })

  assert.deepEqual(calls, [{
    cmd: "node",
    args: [
      "/tmp/openfleet/bin/send",
      "--to-parent",
      "--sender",
      "cron",
      "--message",
      "Summarize",
    ],
  }])
})

test("executeJob sends cron provenance when routing directly to an agent", () => {
  const calls = []

  executeJob({ id: "status", target: "coder", prompt: "Summarize" }, {
    binDir: "/tmp/openfleet/bin",
    runImpl(cmd, args) {
      calls.push({ cmd, args })
    },
  })

  assert.deepEqual(calls, [{
    cmd: "node",
    args: [
      "/tmp/openfleet/bin/send",
      "coder",
      "--sender",
      "cron",
      "--message",
      "Summarize",
    ],
  }])
})
