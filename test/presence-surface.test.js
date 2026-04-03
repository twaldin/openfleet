const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { buildPresenceSurface } = require('../core/ops')
const { saveSessionMetadata } = require('../core/runtime/session')
const { createJob } = require('../core/runtime/jobs')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-presence-surface-'))
}

test('buildPresenceSurface renders live agent worker presence', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'coder',
    sessionID: 'sess_coder',
    directory: '/tmp/openfleet',
    agentProfile: 'coder-gpt',
    host: 'macbook',
    updated_at: new Date().toISOString(),
  })
  saveSessionMetadata(stateDir, {
    name: 'monitor',
    sessionID: 'sess_monitor',
    directory: '/tmp/openfleet',
    agentProfile: 'monitor',
    host: 'thinkpad-1',
    updated_at: new Date().toISOString(),
  })
  createJob(stateDir, {
    type: 'coder.fix',
    status: 'dispatched',
    agent: 'coder',
  })

  const surface = buildPresenceSurface(stateDir)

  assert.match(surface, /Agent presence @/)
  assert.match(surface, /coder \| instance=coder \| working \(active\) \| host=macbook \| profile=coder-gpt/)
  assert.match(surface, /monitor \| instance=monitor \| idle \(healthy\) \| host=thinkpad-1 \| profile=monitor/)
})

test('buildPresenceSurface can scope presence to one agent channel', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'coder',
    sessionID: 'sess_coder',
    directory: '/tmp/openfleet',
    agentProfile: 'coder-gpt',
    host: 'macbook',
    updated_at: new Date().toISOString(),
  })
  saveSessionMetadata(stateDir, {
    name: 'monitor',
    sessionID: 'sess_monitor',
    directory: '/tmp/openfleet',
    agentProfile: 'monitor',
    host: 'thinkpad-1',
    updated_at: new Date().toISOString(),
  })

  const surface = buildPresenceSurface(stateDir, { agent: 'coder' })

  assert.match(surface, /Agent presence @ .* for agent=coder/)
  assert.match(surface, /coder \| instance=coder \| idle \(healthy\)/)
  assert.doesNotMatch(surface, /monitor \|/)
})
