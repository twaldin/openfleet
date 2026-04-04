const { postDiscord, resolveInboundDiscordMessage } = require('./discord')
const { buildPresenceSurface, buildSummary } = require('../ops')

function executeRemoteAction({ adapter, action, stateRoot, args = {}, deliverers = {} }) {
  if (adapter !== 'discord') {
    throw new Error(`Unsupported adapter: ${adapter}`)
  }

  const deliver = deliverers.discordPost || postDiscord
  const source = args.source || 'openfleet'

  if (action === 'post') {
    return deliver({
      message: args.message,
      channel: args.channel,
      source,
      stateRoot,
    })
  }

  if (action === 'summary') {
    return deliver({
      message: buildSummary(stateRoot, {
        agent: args.agent || null,
        channelBinding: args.channelBinding || null,
      }),
      channel: args.channel,
      source,
      stateRoot,
    })
  }

  if (action === 'presence') {
    return deliver({
      message: buildPresenceSurface(stateRoot, {
        agent: args.agent || null,
      }),
      channel: args.channel,
      source,
      stateRoot,
    })
  }

  if (action === 'route-inbound') {
    return resolveInboundDiscordMessage({
      channelId: args.channelId,
      routing: args.routing || {},
      configPath: args.configPath,
      guildLayoutPath: args.guildLayoutPath,
    })
  }

  throw new Error('Usage: remote discord <post|summary|presence|route-inbound> ...')
}

module.exports = {
  executeRemoteAction,
}
