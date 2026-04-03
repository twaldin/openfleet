const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { fetchMessages, loadDiscordConfig } = require('../core/remote/discord')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-discord-poll-'))
}

test('fetchMessages throws without token', () => {
  assert.throws(() => fetchMessages(null, 'chan_1'), /requires a bot token/)
})

test('fetchMessages throws without channelId', () => {
  assert.throws(() => fetchMessages('tok_123', null), /requires a channelId/)
})

test('loadDiscordConfig returns null for missing file', () => {
  const result = loadDiscordConfig('/tmp/nonexistent-discord-config.json')
  assert.equal(result, null)
})

test('loadDiscordConfig parses valid config', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'discord.json')
  fs.writeFileSync(configPath, JSON.stringify({
    token: 'test-token',
    guild_id: 'guild_1',
    channels: { cairn: 'chan_1', alerts: 'chan_2' },
  }))

  const config = loadDiscordConfig(configPath)
  assert.equal(config.token, 'test-token')
  assert.equal(config.guild_id, 'guild_1')
  assert.equal(config.channels.cairn, 'chan_1')
})

test('poll routes messages to correct agents based on deployment routing', () => {
  // Set up temp directory with all required config files
  const dir = tempDir()
  const configPath = path.join(dir, 'discord.json')
  const layoutPath = path.join(dir, 'discord-guild-1.json')
  const cursorsPath = path.join(dir, 'discord-cursors.json')

  fs.writeFileSync(configPath, JSON.stringify({
    token: 'test-token',
    guild_id: '1',
    channels: {
      cairn: 'chan_cairn',
      'code-status': 'chan_code',
      investing: 'chan_investing',
    },
  }))

  fs.writeFileSync(layoutPath, JSON.stringify({
    'CONTROL PLANE': { id: 'cat_ctrl', channels: { cairn: 'chan_cairn' } },
    REPORTS: { id: 'cat_reports', channels: { 'code-status': 'chan_code', investing: 'chan_investing' } },
  }))

  // Verify routing resolution works for each channel
  const { resolveInboundDiscordMessage } = require('../core/remote/discord')
  const routing = {
    assistant_channel: 'channel://cairn',
    direct_message_policy: 'agent-channel-preferred',
    persistent_agent_channels: {
      coder: 'channel://code-status',
      'stock-monitor': 'channel://investing',
    },
  }

  // code-status -> coder
  const codeRoute = resolveInboundDiscordMessage({
    channelId: 'chan_code',
    routing,
    configPath,
    guildLayoutPath: layoutPath,
  })
  assert.equal(codeRoute.route.agent, 'coder')
  assert.equal(codeRoute.route.channel_binding, 'channel://code-status')

  // investing -> stock-monitor
  const investRoute = resolveInboundDiscordMessage({
    channelId: 'chan_investing',
    routing,
    configPath,
    guildLayoutPath: layoutPath,
  })
  assert.equal(investRoute.route.agent, 'stock-monitor')
  assert.equal(investRoute.route.channel_binding, 'channel://investing')

  // cairn -> no specific agent (assistant_channel, goes to parent)
  const cairnRoute = resolveInboundDiscordMessage({
    channelId: 'chan_cairn',
    routing,
    configPath,
    guildLayoutPath: layoutPath,
  })
  assert.equal(cairnRoute.route.agent, null)
  assert.equal(cairnRoute.channel_name, 'cairn')
})

test('cursor persistence saves and loads correctly', () => {
  const dir = tempDir()
  const cursorsPath = path.join(dir, 'discord-cursors.json')

  // Initially empty
  const { readJson, writeJson } = require('../lib/opencode')
  assert.equal(readJson(cursorsPath), null)

  // Write cursors
  const cursors = { chan_1: 'msg_100', chan_2: 'msg_200' }
  writeJson(cursorsPath, cursors)

  // Read back
  const loaded = readJson(cursorsPath)
  assert.deepEqual(loaded, { chan_1: 'msg_100', chan_2: 'msg_200' })
})
