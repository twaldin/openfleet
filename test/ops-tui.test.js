const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { box, renderOpsTui } = require('../core/ops-tui')
const { saveSessionMetadata } = require('../core/runtime/session')
const { createJob } = require('../core/runtime/jobs')
const { createTask } = require('../core/runtime/tasks')
const { createBlocker } = require('../core/runtime/blockers')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-ops-tui-'))
}

test('renderOpsTui builds a multi-panel human-facing dashboard', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'coder-gpt',
    agent_id: 'coder',
    runtime_instance_id: 'coder-gpt@macbook',
    sessionID: 'sess_1',
    directory: '/tmp/openfleet',
    agentProfile: 'coder-gpt',
    host: 'macbook',
    updated_at: new Date().toISOString(),
  })
  createJob(stateDir, { type: 'coder.fix', status: 'dispatched', agent: 'coder' })
  createJob(stateDir, { type: 'stock-monitor.check', status: 'queued', agent: 'stock-monitor', trigger: 'scheduler' })
  createTask(stateDir, { title: 'Build ops TUI', status: 'active', assignee: 'coder' })
  createBlocker(stateDir, { agent_id: 'coder', summary: 'Need approval', status: 'open' })

  const screen = renderOpsTui(stateDir, { width: 96 })

  assert.match(screen, /OpenFleet Ops/)
  assert.match(screen, /Agents/)
  assert.match(screen, /Tasks/)
  assert.match(screen, /Jobs \/ Workflows/)
  assert.match(screen, /Blockers \/ Approvals/)
  assert.match(screen, /scheduled: 1 \| loops: 1/)
  assert.match(screen, /coder \| coder-gpt@macbook \| working \| coder-gpt/)
  assert.match(screen, /Build ops TUI/)
  assert.match(screen, /Build ops TUI \| owner=coder \| worker=coder/)
  assert.match(screen, /blocker: coder \| Need approval/)
})

test('box renders title bar on a single clean line', () => {
  const lines = box('Jobs / Workflows', ['item'], 24)

  assert.equal(lines[0], '┌─ Jobs / Workflows ───┐')
  assert.equal(lines[1], '│ item                 │')
  assert.equal(lines[2], '└──────────────────────┘')
  assert.equal(lines.length, 3)
})
