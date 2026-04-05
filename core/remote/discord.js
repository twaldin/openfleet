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

function fetchMessages(token, channelId, { after = null, limit = 50 } = {}) {
  if (!token) throw new Error('fetchMessages requires a bot token')
  if (!channelId) throw new Error('fetchMessages requires a channelId')

  const params = [`limit=${Math.min(limit, 100)}`]
  if (after) params.push(`after=${after}`)
  const query = params.length ? `?${params.join('&')}` : ''

  const raw = execFileSync('curl', [
    '-sS',
    '-H', `Authorization: Bot ${token}`,
    '-H', 'User-Agent: openfleet-local',
    `https://discord.com/api/v10/channels/${channelId}/messages${query}`,
  ], { stdio: 'pipe', encoding: 'utf8' })

  const messages = JSON.parse(raw)
  if (!Array.isArray(messages)) {
    throw new Error(`Discord API error: ${JSON.stringify(messages)}`)
  }

  // Discord returns newest-first; reverse to chronological order
  return messages.reverse()
}

function postDirectDiscord(token, channel, message) {
  // Discord limit is 2000 chars — auto-split on line boundaries
  const chunks = splitMessage(message, 1900)
  for (const chunk of chunks) {
    const payload = JSON.stringify({ content: chunk })
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
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text]
  const chunks = []
  let remaining = text
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen)
    if (splitAt <= 0) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).replace(/^\n/, '')
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

module.exports = {
  fetchMessages,
  loadDiscordConfig,
  postDiscord,
  resolveDiscordChannel,
  resolveInboundDiscordMessage,
}
