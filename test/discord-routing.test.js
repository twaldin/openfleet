const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { resolveDiscordChannel, resolveInboundDiscordMessage } = require('../core/remote/discord')
const { executeRemoteAction } = require('../core/remote')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-discord-routing-'))
}

test('resolveDiscordChannel maps channel:// alias to configured Discord channel id', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'discord.json')
  fs.writeFileSync(configPath, JSON.stringify({
    guild_id: 'guild_1',
    channels: {
      'fleet-status': '12345',
    },
  }))

  assert.equal(resolveDiscordChannel('channel://fleet-status', { configPath }), '12345')
  assert.equal(resolveDiscordChannel('fleet-status', { configPath }), '12345')
  assert.equal(resolveDiscordChannel('12345', { configPath }), '12345')
})

test('resolveInboundDiscordMessage maps new server channel id to logical route', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'discord.json')
  const layoutPath = path.join(dir, 'discord-guild-1.json')
  fs.writeFileSync(configPath, JSON.stringify({
    guild_id: '1',
    channels: {
      cairn: 'chan_cairn',
      'code-status': 'chan_code',
      'fleet-status': 'chan_status',
    },
  }))
  fs.writeFileSync(layoutPath, JSON.stringify({
    'CONTROL PLANE': { id: 'cat_control', channels: { cairn: 'chan_cairn', 'fleet-status': 'chan_status' } },
    REPORTS: { id: 'cat_reports', channels: { 'code-status': 'chan_code' } },
  }))

  const route = resolveInboundDiscordMessage({
    channelId: 'chan_code',
    configPath,
    guildLayoutPath: layoutPath,
    routing: {
      assistant_channel: 'channel://cairn',
      direct_message_policy: 'agent-channel-preferred',
      persistent_agent_channels: {
        coder: 'channel://code-status',
      },
    },
  })

  assert.deepEqual(route, {
    guild_id: '1',
    category: 'REPORTS',
    channel_name: 'code-status',
    channel_id: 'chan_code',
    route: {
      mode: 'bound',
      agent: 'coder',
      channel_binding: 'channel://code-status',
    },
  })
})

test('executeRemoteAction exposes inbound Discord route resolution', () => {
  const dir = tempDir()
  const configPath = path.join(dir, 'discord.json')
  const layoutPath = path.join(dir, 'discord-guild-1.json')
  fs.writeFileSync(configPath, JSON.stringify({
    guild_id: '1',
    channels: { 'code-status': 'chan_code' },
  }))
  fs.writeFileSync(layoutPath, JSON.stringify({
    REPORTS: { id: 'cat_reports', channels: { 'code-status': 'chan_code' } },
  }))

  const result = executeRemoteAction({
    adapter: 'discord',
    action: 'route-inbound',
    stateRoot: dir,
    args: {
      channelId: 'chan_code',
      configPath,
      guildLayoutPath: layoutPath,
      routing: {
        assistant_channel: 'channel://cairn',
        persistent_agent_channels: { coder: 'channel://code-status' },
      },
    },
  })

  assert.equal(result.channel_name, 'code-status')
  assert.equal(result.route.channel_binding, 'channel://code-status')
  assert.equal(result.route.agent, 'coder')
})
