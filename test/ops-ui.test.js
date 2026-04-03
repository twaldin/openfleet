const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildDashboardSurface, renderListSurface } = require('../core/ops')
const { saveSessionMetadata } = require('../core/runtime/session')
const { createJob } = require('../core/runtime/jobs')
const { createTask } = require('../core/runtime/tasks')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-ops-ui-'))
}

test('buildDashboardSurface renders a user-facing dashboard summary', () => {
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
  createTask(stateDir, { title: 'Polish ops UI', status: 'active', assignee: 'coder' })

  const surface = buildDashboardSurface(stateDir)

  assert.match(surface, /OpenFleet dashboard @/)
  assert.match(surface, /Counts: agents=1 jobs=2 workflows=0 tasks=1 blockers=0 approvals=0/)
  assert.match(surface, /Agent presence:/)
  assert.match(surface, /coder \| instance=coder-gpt@macbook \| working \(active\)/)
  assert.match(surface, /Tasks:/)
  assert.match(surface, /Polish ops UI \| owner=coder \| worker=coder \| instance=coder-gpt@macbook \| step=active/)
  assert.match(surface, /In-progress jobs:/)
  assert.match(surface, /Scheduled jobs:/)
  assert.match(surface, /stock-monitor\.check -> stock-monitor \[scheduler\]/)
})

test('renderListSurface renders agent rows with headers', () => {
  const output = renderListSurface([
    {
      name: 'coder-gpt',
      agent_id: 'coder',
      runtime_instance_id: 'coder-gpt@macbook',
      agentProfile: 'coder-gpt',
      location: 'local',
      host: 'macbook',
      sessionID: 'sess_1',
      updated: '2026-04-02T00:00:00.000Z',
    },
  ])

  assert.match(output, /AGENT\s+INSTANCE\s+PROFILE\s+LOCATION\s+HOST\s+SESSION\s+UPDATED/)
  assert.match(output, /coder\s+coder-gpt@macbook\s+coder-gpt\s+local\s+macbook\s+sess_1/)
})
