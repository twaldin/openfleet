const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createTask } = require('../core/runtime/tasks')
const { decideContinuation } = require('../core/continuation')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-continuation-'))
}

test('continuation says continue when open tasks exist', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: 'Fix bug', status: 'open', assignee: 'coder' })
  const result = decideContinuation(stateDir, { source: 'cairn' })
  assert.equal(result.decision, 'continue')
  assert.equal(result.reason, 'open_tasks_exist')
  assert.equal(result.counts.open_tasks, 1)
})

test('continuation says wait when tasks are blocked', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: 'Need answer', status: 'blocked', blocked_on: 'waiting for repo' })
  const result = decideContinuation(stateDir, { source: 'cairn' })
  assert.equal(result.decision, 'wait')
  assert.equal(result.reason, 'blocked_tasks_exist')
  assert.equal(result.counts.blocked_tasks, 1)
})

test('continuation says wait when tasks are already in progress', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: 'Implement fix', status: 'in_progress', assignee: 'coder' })

  const result = decideContinuation(stateDir, { source: 'cairn' })

  assert.equal(result.decision, 'wait')
  assert.equal(result.reason, 'work_in_progress')
  assert.equal(result.counts.in_progress_tasks, 1)
})

test('continuation says stop when all tasks are complete', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, { title: 'Done', status: 'completed' })

  const result = decideContinuation(stateDir, { source: 'cairn' })

  assert.equal(result.decision, 'stop')
  assert.equal(result.reason, 'all_work_complete')
})
