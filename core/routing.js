function normalizeRouting(routing = {}) {
  return {
    assistant_channel: routing.assistant_channel || null,
    default_human_channel: routing.default_human_channel || routing.assistant_channel || null,
    direct_message_policy: routing.direct_message_policy || 'assistant-default',
    persistent_agent_channels: routing.persistent_agent_channels || {},
    server_architecture: normalizeServerArchitecture(routing.server_architecture || {}),
  }
}

function normalizeServerArchitecture(architecture = {}) {
  return {
    server_name: architecture.server_name || 'OpenFleet',
    categories: Array.isArray(architecture.categories) ? architecture.categories : [],
    status_channel: architecture.status_channel || null,
    tasks_channel: architecture.tasks_channel || null,
    blocker_channel: architecture.blocker_channel || null,
    approval_channel: architecture.approval_channel || null,
  }
}

function resolveChannelBinding(routing, { agent = null, channelBinding = null } = {}) {
  const normalized = normalizeRouting(routing)
  if (channelBinding) return channelBinding
  if (agent && normalized.persistent_agent_channels[agent]) {
    return normalized.persistent_agent_channels[agent]
  }
  return normalized.default_human_channel
}

function resolveInboundRoute(routing, { targetAgent = null, channelBinding = null, isDirectMessage = false } = {}) {
  const normalized = normalizeRouting(routing)

  if (channelBinding) {
    return {
      mode: 'bound',
      agent: targetAgent,
      channel_binding: channelBinding,
    }
  }

  if (isDirectMessage && targetAgent && normalized.direct_message_policy === 'agent-channel-preferred') {
    return {
      mode: 'direct-agent',
      agent: targetAgent,
      channel_binding: resolveChannelBinding(normalized, { agent: targetAgent }),
    }
  }

  return {
    mode: isDirectMessage ? 'assistant-fallback' : 'default',
    agent: targetAgent,
    channel_binding: resolveChannelBinding(normalized, {}),
  }
}

module.exports = {
  normalizeRouting,
  normalizeServerArchitecture,
  resolveChannelBinding,
  resolveInboundRoute,
}
