const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { executeRemoteAction } = require('../core/remote')
const { runAction } = require('../core/actions')
const { readEvents } = require('../core/runtime/events')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-remote-adapter-'))
}

test('executeRemoteAction handles discord post through shared adapter path', () => {
  const calls = []
  const stateDir = tempStateDir()

  const result = executeRemoteAction({
    adapter: 'discord',
    action: 'post',
    stateRoot: stateDir,
    args: { channel: '123', message: 'hello', source: 'coder' },
    deliverers: {
      discordPost: (payload) => {
        calls.push(payload)
        return { ok: true, adapter: 'discord', channel: payload.channel, source: payload.source }
      },
    },
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].message, 'hello')
  assert.equal(calls[0].channel, '123')
})

test('runAction discord_post uses shared remote adapter path', () => {
  const calls = []
  const stateDir = tempStateDir()

  const result = runAction({
    type: 'discord_post',
    channel: '123',
    message: 'hello {{name}}',
    source: 'coder',
  }, {
    stateRoot: stateDir,
    name: 'world',
    remoteDeliverers: {
      discordPost: (payload) => {
        calls.push(payload)
        return { ok: true, adapter: 'discord', channel: payload.channel, source: payload.source }
      },
    },
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].message, 'hello world')
  assert.equal(calls[0].source, 'coder')
  const events = readEvents(stateDir)
  assert.equal(events.at(-1).type, 'action.executed')
  assert.equal(events.at(-1).payload.action, 'discord_post')
})
