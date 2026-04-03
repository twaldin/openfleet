const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createTask, getTask } = require('../core/runtime/tasks')
const { createBlocker } = require('../core/runtime/blockers')
const { createApproval } = require('../core/runtime/approvals')
const { attachApprovalToTask, attachBlockerToTask } = require('../core/resolution')
const { resolveLatestByChannel } = require('../core/runtime/resolution')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-resolution-'))
}

test('approval resolution by channel reactivates awaiting_approval task', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Approval test',
    status: 'awaiting_approval',
    channel_binding: 'thread://approval-test',
  })
  const approval = createApproval(stateDir, {
    task_id: task.id,
    summary: 'Deploy now?',
    status: 'pending',
    channel_binding: task.channel_binding,
  })
  attachApprovalToTask(stateDir, approval)

  resolveLatestByChannel(stateDir, 'approval', 'thread://approval-test', {
    status: 'approved',
    resolved_by: 'user_tim',
    resolution: 'approved',
  })

  const updatedTask = getTask(stateDir, task.id)
  assert.equal(updatedTask.status, 'active')
  assert.deepEqual(updatedTask.approval_ids, [])
})

test('blocker resolution by channel reactivates blocked task', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Blocker test',
    status: 'blocked',
    channel_binding: 'thread://blocker-test',
  })
  const blocker = createBlocker(stateDir, {
    task_id: task.id,
    summary: 'Need answer',
    status: 'open',
    channel_binding: task.channel_binding,
  })
  attachBlockerToTask(stateDir, blocker)

  resolveLatestByChannel(stateDir, 'blocker', 'thread://blocker-test', {
    status: 'answered',
    resolved_by: 'user_tim',
    answer: 'use openfleet repo',
  })

  const updatedTask = getTask(stateDir, task.id)
  assert.equal(updatedTask.status, 'active')
  assert.deepEqual(updatedTask.blocker_ids, [])
})
