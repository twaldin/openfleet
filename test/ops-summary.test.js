const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildSummary } = require('../core/ops')
const { createJob } = require('../core/runtime/jobs')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-ops-summary-'))
}

test('buildSummary includes job details and scheduled work', () => {
  const stateDir = tempStateDir()
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

  assert.doesNotMatch(summary, /Tasks:/)
  assert.match(summary, /Scheduled jobs:/)
  assert.match(summary, /stock-monitor\.check -> stock-monitor \[scheduler\]/)
  assert.match(summary, /Maintenance loops:/)
  assert.match(summary, /monitor\.detect -> monitor \[maintenance-loop\]/)
})
