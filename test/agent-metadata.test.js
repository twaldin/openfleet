const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { listAgentMetadata } = require('../core/ops')
const { saveSessionMetadata } = require('../core/runtime/session')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-agent-metadata-'))
}

test('listAgentMetadata preserves remote host visibility from session metadata', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'monitor',
    sessionID: 'sess_remote',
    directory: '/tmp/openfleet',
    agentProfile: 'monitor',
    host: 'thinkpad-1',
    baseUrl: 'http://thinkpad-1:4096',
    transport: 'ssh+tunnel',
    updated_at: new Date().toISOString(),
  })

  const monitor = listAgentMetadata(stateDir).find((item) => item.name === 'monitor')

  assert.equal(monitor.location, 'remote')
  assert.equal(monitor.host, 'thinkpad-1')
  assert.equal(monitor.baseUrl, 'http://thinkpad-1:4096')
  assert.equal(monitor.transport, 'ssh+tunnel')
  assert.equal(monitor.visibility, 'remote@thinkpad-1')
})

test('listAgentMetadata preserves host visibility from registry when metadata file is absent', () => {
  const stateDir = tempStateDir()
  const registryPath = path.join(stateDir, 'registry.json')
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(registryPath, `${JSON.stringify({
    sessions: {
      sess_remote: {
        session_id: 'sess_remote',
        name: 'monitor',
        directory: '/tmp/openfleet',
        agentProfile: 'monitor',
        host: 'thinkpad-1',
        baseUrl: 'http://thinkpad-1:4096',
        transport: 'ssh+tunnel',
        updated_at: new Date().toISOString(),
      },
    },
    agents: {},
    cursors: {},
  }, null, 2)}\n`)

  const monitor = listAgentMetadata(stateDir).find((item) => item.name === 'monitor')

  assert.equal(monitor.location, 'remote')
  assert.equal(monitor.host, 'thinkpad-1')
  assert.equal(monitor.visibility, 'remote@thinkpad-1')
})
