const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildSummary } = require('../core/ops')
const { createTask } = require('../core/runtime/tasks')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-remote-surfaces-'))
}

test('buildSummary renders blocked task details for a scoped agent', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'Deploy release',
    status: 'blocked',
    assignee: 'coder',
    blocked_on: 'waiting for prod window',
  })

  const surface = buildSummary(stateDir, {
    agent: 'coder',
  })

  assert.match(surface, /Scope: agent=coder, channel=any/)
  assert.match(surface, /Deploy release/)
  assert.match(surface, /blocked_on=waiting for prod window/)
  assert.doesNotMatch(surface, /approvals/i)
})

test('buildSummary omits unrelated tasks from an agent scope', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'Need clarification',
    status: 'blocked',
    assignee: 'coder',
    blocked_on: 'Need deploy target',
  })
  createTask(stateDir, {
    title: 'Monitor follow-up',
    status: 'open',
    assignee: 'monitor',
  })

  const surface = buildSummary(stateDir, {
    agent: 'coder',
  })

  assert.match(surface, /Need clarification/)
  assert.doesNotMatch(surface, /Monitor follow-up/)
})
