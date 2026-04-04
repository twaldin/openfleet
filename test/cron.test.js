const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { createTask } = require("../core/runtime/tasks")
const { evaluateCondition, executeJob, shouldFire } = require("../bin/cron")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-cron-"))
}

test("idle_open_tasks condition fires when open tasks exist and none are in progress", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Queued task", status: "open" })
  createTask(stateDir, { title: "Resolved task", status: "completed" })

  assert.equal(evaluateCondition({ type: "idle_open_tasks" }, { stateRoot: stateDir }), true)
})

test("idle_open_tasks condition treats legacy created tasks as open work", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Created task", status: "created" })
  createTask(stateDir, { title: "Blocked task", status: "blocked" })

  assert.equal(evaluateCondition({ type: "idle_open_tasks" }, { stateRoot: stateDir }), true)
})

test("idle_open_tasks condition does not fire without open tasks", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Blocked task", status: "blocked" })
  createTask(stateDir, { title: "Done task", status: "completed" })

  assert.equal(evaluateCondition({ type: "idle_open_tasks" }, { stateRoot: stateDir }), false)
})

test("idle_open_tasks condition does not fire when work is already in progress", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Open task", status: "open" })
  createTask(stateDir, { title: "Working task", status: "in_progress" })

  assert.equal(evaluateCondition({ type: "idle_open_tasks" }, { stateRoot: stateDir }), false)
})

test("idle_open_tasks condition treats legacy active tasks as in progress", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Open task", status: "open" })
  createTask(stateDir, { title: "Active task", status: "active" })

  assert.equal(evaluateCondition({ type: "idle_open_tasks" }, { stateRoot: stateDir }), false)
})

test("shouldFire combines schedule timing with condition evaluation", () => {
  const stateDir = tempStateDir()
  const now = new Date("2026-04-04T12:00:00.000Z")
  createTask(stateDir, { title: "Open task", status: "open" })

  const job = {
    id: "work-loop",
    schedule: { intervalMinutes: 2 },
    condition: { type: "idle_open_tasks" },
  }

  assert.equal(shouldFire(job, now, {}, { stateRoot: stateDir }), true)
  assert.equal(
    shouldFire(job, now, { "work-loop": "2026-04-04T11:59:00.000Z" }, { stateRoot: stateDir }),
    false,
  )
})

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
