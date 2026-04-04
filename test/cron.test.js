const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { createTask } = require("../core/runtime/tasks")
const { evaluateCondition, shouldFire } = require("../bin/cron")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-cron-"))
}

test("idle_open_tasks condition fires when open tasks exist and none are in progress", () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: "Queued task", status: "open" })
  createTask(stateDir, { title: "Resolved task", status: "completed" })

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
