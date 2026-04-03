const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createJob } = require('../core/runtime/jobs')
const { createWorkflow, pauseWorkflow } = require('../core/runtime/workflows')
const { createBlocker } = require('../core/runtime/blockers')
const { createApproval } = require('../core/runtime/approvals')
const { decideContinuation } = require('../core/continuation')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-continuation-'))
}

test('continuation says continue when runnable jobs exist', () => {
  const stateDir = tempStateDir()
  createJob(stateDir, { type: 'coder.fix', status: 'queued', agent: 'coder' })
  const result = decideContinuation(stateDir, { source: 'cairn' })
  assert.equal(result.decision, 'continue')
  assert.equal(result.reason, 'runnable_jobs_exist')
})

test('continuation says wait when blocked or approvals pending', () => {
  const stateDir = tempStateDir()
  createWorkflow(stateDir, { type: 'remediation', status: 'blocked', steps: [] })
  createBlocker(stateDir, { summary: 'Need answer', status: 'open', channel_binding: 'thread://x' })
  createApproval(stateDir, { summary: 'Need approval', status: 'pending', channel_binding: 'thread://x' })
  const result = decideContinuation(stateDir, { source: 'cairn' })
  assert.equal(result.decision, 'wait')
  assert.equal(result.reason, 'blocked_or_awaiting_approval')
})

test('continuation says wait when workflows are paused', () => {
  const stateDir = tempStateDir()
  const workflow = createWorkflow(stateDir, { type: 'remediation', status: 'active', steps: ['coder.fix'] })
  pauseWorkflow(stateDir, workflow.id, { reason: 'manual pause' })

  const result = decideContinuation(stateDir, { source: 'cairn' })

  assert.equal(result.decision, 'wait')
  assert.equal(result.reason, 'paused_workflows')
  assert.equal(result.counts.paused_workflows, 1)
})
