const fs = require("fs")
const { execFileSync } = require("child_process")
const path = require("path")
const os = require("os")
const { createEventStore } = require("../runtime/events")
const { resolveInboundRoute } = require('../routing')

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function defaultReplyScript() {
  return process.env.OPENFLEET_REPLY_DISCORD_SCRIPT || path.join(os.homedir(), "claudecord", "scripts", "reply_discord")
}

function defaultDiscordConfigPath() {
  return process.env.OPENFLEET_DISCORD_CONFIG || path.join(defaultStateRoot(), 'discord.json')
}

function defaultGuildLayoutPath(config = null) {
  const guildId = config?.guild_id
  return process.env.OPENFLEET_DISCORD_GUILD_LAYOUT || (guildId ? path.join(defaultStateRoot(), `discord-guild-${guildId}.json`) : null)
}

function postDiscord({ message, channel, source = "system", stateRoot = defaultStateRoot(), replyScript = defaultReplyScript(), configPath = defaultDiscordConfigPath() }) {
  if (!message || !channel) {
    throw new Error("discord post requires message and channel")
  }

  const config = loadDiscordConfig(configPath)
  const channelId = resolveDiscordChannel(channel, { config, configPath })
  if (config?.token) {
    postDirectDiscord(config.token, channelId, message)
  } else {
    execFileSync(replyScript, [message, "--channel", channelId], { stdio: "pipe", encoding: "utf8" })
  }

  createEventStore(stateRoot).append({
    type: "adapter.delivered",
    agent_id: source,
    severity: "info",
    payload: {
      adapter: "discord",
      channel: channelId,
      message,
    },
  })

  return { ok: true, adapter: "discord", channel: channelId, source }
}

function loadDiscordConfig(configPath) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
}

function loadGuildLayout(guildLayoutPath) {
  if (!guildLayoutPath) return null
  try {
    return JSON.parse(fs.readFileSync(guildLayoutPath, 'utf8'))
  } catch {
    return null
  }
}

function resolveDiscordChannel(channel, { config = null, configPath = defaultDiscordConfigPath() } = {}) {
  const loaded = config || loadDiscordConfig(configPath) || {}
  const value = String(channel || '').trim()
  if (!value) throw new Error('discord channel is required')
  if (/^\d+$/.test(value)) return value
  const alias = value.replace(/^channel:\/\//, '')
  return loaded.channels?.[alias] || value
}

function resolveInboundDiscordMessage({ channelId, routing = {}, configPath = defaultDiscordConfigPath(), guildLayoutPath = null }) {
  const config = loadDiscordConfig(configPath) || {}
  const layout = loadGuildLayout(guildLayoutPath || defaultGuildLayoutPath(config)) || {}
  const located = findChannelById(layout, channelId) || findChannelById({ ROOT: { channels: config.channels || {} } }, channelId)
  if (!located) {
    throw new Error(`Unknown Discord channel id: ${channelId}`)
  }

  const channelBinding = `channel://${located.channel_name}`
  const targetAgent = Object.entries(routing.persistent_agent_channels || {}).find(([, bound]) => bound === channelBinding)?.[0] || null
  return {
    guild_id: config.guild_id || null,
    category: located.category,
    channel_name: located.channel_name,
    channel_id: channelId,
    route: resolveInboundRoute(routing, { targetAgent, channelBinding }),
  }
}

function findChannelById(layout, channelId) {
  for (const [category, value] of Object.entries(layout || {})) {
    for (const [channelName, currentId] of Object.entries(value.channels || {})) {
      if (currentId === channelId) {
        return { category, channel_name: channelName }
      }
    }
  }
  return null
}

function postDirectDiscord(token, channel, message) {
  const payload = JSON.stringify({ content: message })
  execFileSync('curl', [
    '-sS',
    '-X', 'POST',
    '-H', `Authorization: Bot ${token}`,
    '-H', 'User-Agent: openfleet-local',
    '-H', 'Content-Type: application/json',
    '-d', payload,
    `https://discord.com/api/v10/channels/${channel}/messages`,
  ], { stdio: 'pipe', encoding: 'utf8' })
}

module.exports = {
  postDiscord,
  resolveDiscordChannel,
  resolveInboundDiscordMessage,
}
