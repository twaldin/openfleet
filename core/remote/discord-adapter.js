// Discord remote adapter — wraps existing postDiscord into the adapter interface
const { postDiscord, resolveDiscordChannel, loadDiscordConfig } = require("./discord")
const { loadAgents } = require("../runtime/agents")

let _config = null
let _stateRoot = null

function init(providerConfig, stateRoot) {
  _config = providerConfig
  _stateRoot = stateRoot
}

function resolveChannel(channel, agentId) {
  if (channel === "auto" && agentId) {
    const agents = loadAgents(_stateRoot)
    const agent = agents[agentId]
    if (agent?.channel) {
      return agent.channel
    }
    console.warn(`[discord-adapter] Agent "${agentId}" has no channel configured, falling back to default routing`)
  }
  // channel is a logical name like "alerts" or "fleet-status" — prefix with channel://
  if (channel && !channel.startsWith("channel://") && !/^\d+$/.test(channel)) {
    return `channel://${channel}`
  }
  return channel
}

function post(channel, message, metadata) {
  const agentId = metadata?.agent_id || metadata?.source || "system"
  const resolved = resolveChannel(channel, agentId)

  return postDiscord({
    message,
    channel: resolved,
    source: agentId,
    stateRoot: _stateRoot,
  })
}

function formatEvent(event) {
  const agent = event.agent_id || "system"
  const type = event.type || "unknown"

  switch (type) {
    case "agent.post":
      return event.payload?.message || "(empty message)"

    case "agent.error":
      return `**Error** from \`${agent}\`:\n${event.payload?.error || "(no details)"}`

    case "agent.blocked":
      return `**Blocked** — \`${agent}\`: ${event.payload?.reason || "(no reason)"}`

    case "agent.task_completed":
      return `**Task completed** — \`${agent}\`: ${event.payload?.summary || "(done)"}`

    case "session.spawned":
      return `Agent \`${agent}\` spawned (${event.payload?.harness || "?"}/${event.payload?.model || "?"})`

    case "session.died":
      return `Agent \`${agent}\` died${event.payload?.reason ? `: ${event.payload.reason}` : ""}`

    case "agent.respawned":
      return `Agent \`${agent}\` respawned`

    case "agent.compacted":
      return `Agent \`${agent}\` compacted context`

    default:
      return `[${type}] ${agent}: ${JSON.stringify(event.payload || {})}`
  }
}

function destroy() {
  _config = null
  _stateRoot = null
}

module.exports = {
  name: "discord",
  init,
  post,
  formatEvent,
  destroy,
}
