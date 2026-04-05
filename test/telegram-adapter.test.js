const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  getUpdates,
  parseTelegramUpdate,
  resolveInboundTelegramMessage,
  sendMessage,
  shouldProcessTelegramUpdate,
} = require('../core/remote/telegram')
const { executeRemoteAction } = require('../core/remote')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-telegram-'))
}

test('resolveInboundTelegramMessage maps configured chat id to logical route', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'telegram.json')
  fs.writeFileSync(configPath, JSON.stringify({
    chats: {
      cairn: '-1001',
      'code-status': '-1002',
    },
  }))

  const route = resolveInboundTelegramMessage({
    chatId: '-1002',
    configPath,
    routing: {
      assistant_channel: 'channel://cairn',
      direct_message_policy: 'agent-channel-preferred',
      persistent_agent_channels: {
        coder: 'channel://code-status',
      },
    },
  })

  assert.deepEqual(route, {
    chat_name: 'code-status',
    chat_id: '-1002',
    route: {
      mode: 'bound',
      agent: 'coder',
      channel_binding: 'channel://code-status',
    },
  })
})

test('executeRemoteAction exposes inbound Telegram route resolution', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'telegram.json')
  fs.writeFileSync(configPath, JSON.stringify({
    chats: {
      'code-status': '-1002',
    },
  }))

  const result = executeRemoteAction({
    adapter: 'telegram',
    action: 'route-inbound',
    stateRoot: dir,
    args: {
      chatId: '-1002',
      configPath,
      routing: {
        assistant_channel: 'channel://cairn',
        persistent_agent_channels: { coder: 'channel://code-status' },
      },
    },
  })

  assert.equal(result.chat_name, 'code-status')
  assert.equal(result.route.agent, 'coder')
  assert.equal(result.route.channel_binding, 'channel://code-status')
})

test('parseTelegramUpdate extracts chat, sender, and text from a message update', () => {
  const parsed = parseTelegramUpdate({
    update_id: 42,
    message: {
      message_id: 7,
      date: 1712345678,
      chat: {
        id: -1002,
        type: 'supergroup',
        title: 'code-status',
      },
      from: {
        id: 11,
        is_bot: false,
        username: 'tim',
        first_name: 'Tim',
      },
      text: 'Ship it',
    },
  })

  assert.deepEqual(parsed, {
    update_id: 42,
    message_id: 7,
    chat_id: '-1002',
    chat_type: 'supergroup',
    chat_title: 'code-status',
    sender_id: '11',
    sender_name: 'tim',
    is_bot: false,
    text: 'Ship it',
  })
})

test('shouldProcessTelegramUpdate rejects bot, non-message, and empty-text updates', () => {
  assert.equal(shouldProcessTelegramUpdate({ edited_message: {} }), false)

  assert.equal(shouldProcessTelegramUpdate({
    message: {
      from: { is_bot: true },
      text: 'hello',
      chat: { id: 1 },
    },
  }), false)

  assert.equal(shouldProcessTelegramUpdate({
    message: {
      from: { is_bot: false },
      text: '   ',
      chat: { id: 1 },
    },
  }), false)

  assert.equal(shouldProcessTelegramUpdate({
    message: {
      from: { is_bot: false },
      text: 'hello',
      chat: { id: 1 },
    },
  }), true)
})

test('sendMessage surfaces Telegram HTTP failures', async () => {
  await assert.rejects(
    sendMessage('bot-token', '-1002', 'Ship it', {
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        text: async () => 'gateway error',
      }),
    }),
    /Telegram API sendMessage failed: 500 gateway error/
  )
})

test('getUpdates surfaces Telegram API body failures', async () => {
  await assert.rejects(
    getUpdates('bot-token', {}, async () => ({
      ok: true,
      json: async () => ({
        ok: false,
        error_code: 400,
        description: 'Bad Request: invalid offset',
      }),
    })),
    /Telegram API getUpdates error:/
  )
})

test('getUpdates surfaces token auth failures', async () => {
  await assert.rejects(
    getUpdates('bad-token', {}, async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })),
    /Telegram API getUpdates failed: 401 Unauthorized/
  )
})

test('getUpdates surfaces rate limit failures', async () => {
  await assert.rejects(
    getUpdates('bot-token', {}, async () => ({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests: retry after 5',
    })),
    /Telegram API getUpdates failed: 429 Too Many Requests: retry after 5/
  )
})

test('getUpdates surfaces network errors from fetch', async () => {
  await assert.rejects(
    getUpdates('bot-token', {}, async () => {
      throw new Error('network down')
    }),
    /network down/
  )
})
