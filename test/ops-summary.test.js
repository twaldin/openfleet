const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildSummary } = require('../core/ops')
const { createTask } = require('../core/runtime/tasks')
const { createJob } = require('../core/runtime/jobs')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-ops-summary-'))
}

test('buildSummary includes flat task details and scheduled work', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'Fix remote summary',
    status: 'blocked',
    assignee: 'coder',
    blocked_on: 'Need channel routing answer',
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

  assert.match(summary, /Tasks:/)
  assert.match(summary, /Fix remote summary/)
  assert.match(summary, /blocked_on=Need channel routing answer/)
  assert.doesNotMatch(summary, /Open blockers:/)
  assert.doesNotMatch(summary, /Pending approvals:/)
  assert.match(summary, /Scheduled jobs:/)
  assert.match(summary, /stock-monitor\.check -> stock-monitor \[scheduler\]/)
  assert.match(summary, /Maintenance loops:/)
  assert.match(summary, /monitor\.detect -> monitor \[maintenance-loop\]/)
})

test('buildSummary can scope task state to an agent', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'Coder task',
    status: 'open',
    assignee: 'coder',
  })
  createTask(stateDir, {
    title: 'Monitor task',
    status: 'open',
    assignee: 'monitor',
  })

  const summary = buildSummary(stateDir, {
    agent: 'coder',
  })

  assert.match(summary, /Scope: agent=coder, channel=any/)
  assert.match(summary, /Coder task/)
  assert.doesNotMatch(summary, /Monitor task/)
})
