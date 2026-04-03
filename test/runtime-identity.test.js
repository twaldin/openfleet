const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { listAgentMetadata, buildPresenceSurface } = require('../core/ops')
const { saveSessionMetadata } = require('../core/runtime/session')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-runtime-identity-'))
}

test('session metadata keeps logical agent identity separate from runtime instance identity', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'coder-gpt',
    agent_id: 'coder',
    runtime_instance_id: 'coder-gpt@macbook',
    sessionID: 'sess_coder_gpt',
    directory: '/tmp/openfleet',
    agentProfile: 'coder-gpt',
    host: 'macbook',
    updated_at: new Date().toISOString(),
  })

  const agent = listAgentMetadata(stateDir).find((item) => item.name === 'coder-gpt')

  assert.equal(agent.agent_id, 'coder')
  assert.equal(agent.runtime_instance_id, 'coder-gpt@macbook')
  assert.equal(agent.sessionID, 'sess_coder_gpt')
})

test('presence surface shows logical agent and runtime instance separately', () => {
  const stateDir = tempStateDir()
  saveSessionMetadata(stateDir, {
    name: 'coder-gpt',
    agent_id: 'coder',
    runtime_instance_id: 'coder-gpt@macbook',
    sessionID: 'sess_coder_gpt',
    directory: '/tmp/openfleet',
    agentProfile: 'coder-gpt',
    host: 'macbook',
    updated_at: new Date().toISOString(),
  })

  const surface = buildPresenceSurface(stateDir)

  assert.match(surface, /coder \| instance=coder-gpt@macbook \| idle \(healthy\) \| host=macbook \| profile=coder-gpt/)
})
