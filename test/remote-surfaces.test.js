const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildApprovalSurface, buildBlockerSurface } = require('../core/ops')
const { createTask } = require('../core/runtime/tasks')
const { createApproval } = require('../core/runtime/approvals')
const { createBlocker } = require('../core/runtime/blockers')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-remote-surfaces-'))
}

test('buildApprovalSurface renders pending approvals for a remote channel', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Deploy release',
    status: 'awaiting_approval',
    assignee: 'coder',
    channel_binding: 'thread://openfleet-discord-4',
  })
  createApproval(stateDir, {
    task_id: task.id,
    agent_id: 'coder',
    action_type: 'deploy',
    summary: 'Deploy release to production',
    risk_class: 'high_impact',
    status: 'pending',
    channel_binding: task.channel_binding,
  })

  const surface = buildApprovalSurface(stateDir, {
    agent: 'coder',
    channelBinding: task.channel_binding,
  })

  assert.match(surface, /Pending approvals for agent=coder @ thread:\/\/openfleet-discord-4/)
  assert.match(surface, /Deploy release to production/)
  assert.match(surface, /risk=high_impact/)
})

test('buildBlockerSurface renders open blockers for a remote channel', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Need clarification',
    status: 'blocked',
    assignee: 'coder',
    channel_binding: 'thread://openfleet-discord-4',
  })
  createBlocker(stateDir, {
    task_id: task.id,
    agent_id: 'coder',
    summary: 'Need deploy target',
    question: 'Should this go to staging or prod?',
    status: 'open',
    channel_binding: task.channel_binding,
  })

  const surface = buildBlockerSurface(stateDir, {
    agent: 'coder',
    channelBinding: task.channel_binding,
  })

  assert.match(surface, /Open blockers for agent=coder @ thread:\/\/openfleet-discord-4/)
  assert.match(surface, /Need deploy target/)
  assert.match(surface, /Should this go to staging or prod\?/)
})
