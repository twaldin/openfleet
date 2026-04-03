const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildSummary } = require('../core/ops')
const { createTask } = require('../core/runtime/tasks')
const { createJob } = require('../core/runtime/jobs')
const { createBlocker } = require('../core/runtime/blockers')
const { createApproval } = require('../core/runtime/approvals')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-ops-summary-'))
}

test('buildSummary includes open tasks, blockers, and approvals', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Fix remote summary',
    status: 'active',
    assignee: 'coder',
    channel_binding: 'thread://openfleet-discord-5',
  })
  createBlocker(stateDir, {
    task_id: task.id,
    agent_id: 'coder',
    summary: 'Need channel routing answer',
    status: 'open',
    channel_binding: task.channel_binding,
  })
  createApproval(stateDir, {
    task_id: task.id,
    agent_id: 'coder',
    summary: 'Approve summary rollout',
    status: 'pending',
    channel_binding: task.channel_binding,
  })
  createJob(stateDir, {
    type: 'stock-monitor.check',
    status: 'queued',
    agent: 'stock-monitor',
    trigger: 'scheduler',
  })
  createJob(stateDir, {
    type: 'monitor.detect',
    status: 'running',
    agent: 'monitor',
    trigger: 'maintenance-loop',
  })

  const summary = buildSummary(stateDir)

  assert.match(summary, /Open tasks:/)
  assert.match(summary, /Fix remote summary/)
  assert.match(summary, /Open blockers:/)
  assert.match(summary, /Need channel routing answer/)
  assert.match(summary, /Pending approvals:/)
  assert.match(summary, /Approve summary rollout/)
  assert.match(summary, /Scheduled jobs:/)
  assert.match(summary, /stock-monitor\.check -> stock-monitor \[scheduler\]/)
  assert.match(summary, /Maintenance loops:/)
  assert.match(summary, /monitor\.detect -> monitor \[maintenance-loop\]/)
})

test('buildSummary can scope task state to an agent channel', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'Coder task',
    status: 'active',
    assignee: 'coder',
    channel_binding: 'thread://coder',
  })
  createTask(stateDir, {
    title: 'Monitor task',
    status: 'active',
    assignee: 'monitor',
    channel_binding: 'thread://monitor',
  })
  createBlocker(stateDir, {
    agent_id: 'coder',
    summary: 'Coder blocker',
    status: 'open',
    channel_binding: 'thread://coder',
  })
  createApproval(stateDir, {
    agent_id: 'monitor',
    summary: 'Monitor approval',
    status: 'pending',
    channel_binding: 'thread://monitor',
  })

  const summary = buildSummary(stateDir, {
    agent: 'coder',
    channelBinding: 'thread://coder',
  })

  assert.match(summary, /Scope: agent=coder, channel=thread:\/\/coder/)
  assert.match(summary, /Coder task/)
  assert.match(summary, /Coder blocker/)
  assert.doesNotMatch(summary, /Monitor task/)
  assert.doesNotMatch(summary, /Monitor approval/)
})
