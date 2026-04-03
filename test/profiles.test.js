const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { upsertProfile, selectProfile } = require('../core/runtime/profiles')
const { mapLocalProfile } = require('../core/harness/opencode')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-profiles-'))
}

test('selectProfile skips rate-limited profile and chooses available fallback', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'claude-opus-orchestrator',
    harness: 'claude-code',
    role: 'orchestrator',
    status: 'rate_limited',
    cool_down_until: '2999-01-01T00:00:00.000Z',
  })
  upsertProfile(stateDir, {
    profile_id: 'codex-gpt54-orchestrator',
    harness: 'codex',
    role: 'orchestrator',
    status: 'available',
  })

  const selected = selectProfile(stateDir, {
    role: 'orchestrator',
    allowed: ['claude-opus-orchestrator', 'codex-gpt54-orchestrator'],
  })

  assert.equal(selected.profile_id, 'codex-gpt54-orchestrator')
})

test('selectProfile honors preferred GPT coder profile', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-qwen32b-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })
  upsertProfile(stateDir, {
    profile_id: 'opencode-gpt54-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })

  const selected = selectProfile(stateDir, {
    role: 'coder',
    preferred: 'opencode-gpt54-coder',
  })

  assert.equal(selected.profile_id, 'opencode-gpt54-coder')
})

test('opencode GPT coder profile maps to managed coder-gpt session', () => {
  assert.deepEqual(
    mapLocalProfile({ profile_id: 'opencode-gpt54-coder' }, 'coder'),
    { sessionName: 'coder-gpt', agentProfile: 'coder-gpt' },
  )
  assert.deepEqual(
    mapLocalProfile({ profile_id: 'opencode-qwen32b-coder' }, 'coder'),
    { sessionName: 'coder', agentProfile: 'coder' },
  )
})
