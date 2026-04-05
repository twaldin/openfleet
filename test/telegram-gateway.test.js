const test = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-telegram-gateway-'))
}

function loadGatewayWithMocks({ dir, overrides = {} }) {
  const envKeys = [
    'OPENFLEET_CANONICAL_STATE_DIR',
    'OPENFLEET_TELEGRAM_POLL_TIMEOUT',
    'OPENFLEET_TELEGRAM_RETRY_DELAY_MS',
  ]
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  process.env.OPENFLEET_CANONICAL_STATE_DIR = dir
  process.env.OPENFLEET_TELEGRAM_POLL_TIMEOUT = '0'
  process.env.OPENFLEET_TELEGRAM_RETRY_DELAY_MS = '0'

  const telegram = require('../core/remote/telegram')
  const opencode = require('../lib/opencode')
  const deployment = require('../core/deployment')
  const childProcess = require('child_process')

  const originals = {
    loadTelegramConfig: telegram.loadTelegramConfig,
    getUpdates: telegram.getUpdates,
    shouldProcessTelegramUpdate: telegram.shouldProcessTelegramUpdate,
    parseTelegramUpdate: telegram.parseTelegramUpdate,
    resolveInboundTelegramMessage: telegram.resolveInboundTelegramMessage,
    formatTelegramMessage: telegram.formatTelegramMessage,
    readJson: opencode.readJson,
    writeJson: opencode.writeJson,
    loadDeploymentConfig: deployment.loadDeploymentConfig,
    execFile: childProcess.execFile,
    processOn: process.on,
    stderrWrite: process.stderr.write,
  }

  Object.assign(telegram, {
    loadTelegramConfig: overrides.loadTelegramConfig || originals.loadTelegramConfig,
    getUpdates: overrides.getUpdates || originals.getUpdates,
    shouldProcessTelegramUpdate: overrides.shouldProcessTelegramUpdate || originals.shouldProcessTelegramUpdate,
    parseTelegramUpdate: overrides.parseTelegramUpdate || originals.parseTelegramUpdate,
    resolveInboundTelegramMessage: overrides.resolveInboundTelegramMessage || originals.resolveInboundTelegramMessage,
    formatTelegramMessage: overrides.formatTelegramMessage || originals.formatTelegramMessage,
  })
  opencode.readJson = overrides.readJson || originals.readJson
  opencode.writeJson = overrides.writeJson || originals.writeJson
  deployment.loadDeploymentConfig = overrides.loadDeploymentConfig || originals.loadDeploymentConfig
  childProcess.execFile = overrides.execFile || originals.execFile
  process.on = overrides.processOn || originals.processOn
  process.stderr.write = overrides.stderrWrite || originals.stderrWrite

  const gatewayPath = require.resolve('../bin/telegram-gateway')
  delete require.cache[gatewayPath]
  const gateway = require('../bin/telegram-gateway')

  function restore() {
    Object.assign(telegram, {
      loadTelegramConfig: originals.loadTelegramConfig,
      getUpdates: originals.getUpdates,
      shouldProcessTelegramUpdate: originals.shouldProcessTelegramUpdate,
      parseTelegramUpdate: originals.parseTelegramUpdate,
      resolveInboundTelegramMessage: originals.resolveInboundTelegramMessage,
      formatTelegramMessage: originals.formatTelegramMessage,
    })
    opencode.readJson = originals.readJson
    opencode.writeJson = originals.writeJson
    deployment.loadDeploymentConfig = originals.loadDeploymentConfig
    childProcess.execFile = originals.execFile
    process.on = originals.processOn
    process.stderr.write = originals.stderrWrite
    delete require.cache[gatewayPath]

    for (const key of envKeys) {
      if (previousEnv[key] == null) {
        delete process.env[key]
      } else {
        process.env[key] = previousEnv[key]
      }
    }
  }

  return { gateway, restore }
}

test('main retries after poll failures and continues processing updates', async () => {
  const dir = tempDir()
  const stderr = []
  const writes = []
  const execCalls = []
  const signalHandlers = {}
  let pollCount = 0

  const { gateway, restore } = loadGatewayWithMocks({
    dir,
    overrides: {
      loadTelegramConfig: () => ({ token: 'bot-token' }),
      loadDeploymentConfig: () => ({ routing: { persistent_agent_channels: { coder: 'channel://code-status' } } }),
      readJson: () => ({ offset: 0 }),
      writeJson: (filePath, value) => {
        writes.push({ filePath, value })
      },
      shouldProcessTelegramUpdate: () => true,
      parseTelegramUpdate: () => ({ chat_id: '-1002', sender_name: 'tim', text: 'Ship it' }),
      resolveInboundTelegramMessage: () => ({
        chat_name: 'code-status',
        route: { agent: 'coder' },
      }),
      formatTelegramMessage: () => '[TELEGRAM #code-status] tim: Ship it',
      getUpdates: async () => {
        pollCount += 1
        if (pollCount === 1) {
          throw new Error('network down')
        }
        signalHandlers.SIGTERM()
        return [{ update_id: 8, message: { chat: { id: -1002 }, text: 'Ship it' } }]
      },
      execFile: (command, args, callback) => {
        execCalls.push({ command, args })
        callback(null)
      },
      processOn: (signal, handler) => {
        signalHandlers[signal] = handler
        return process
      },
      stderrWrite: (chunk) => {
        stderr.push(chunk)
        return true
      },
    },
  })

  try {
    await gateway.main()
  } finally {
    restore()
  }

  assert.equal(pollCount, 2)
  assert.match(stderr.join(''), /telegram-gateway: network down/)
  assert.equal(execCalls.length, 1)
  assert.equal(execCalls[0].command, 'node')
  assert.equal(execCalls[0].args[1], 'coder')
  assert.equal(execCalls[0].args[2], '[TELEGRAM #code-status] tim: Ship it')
  assert.deepEqual(writes, [{
    filePath: path.join(dir, 'telegram-cursor.json'),
    value: { offset: 9 },
  }])
})
