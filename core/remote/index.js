const { postDiscord, resolveInboundDiscordMessage } = require('./discord')
const { resolveInboundTelegramMessage } = require('./telegram')
const { buildPresenceSurface, buildSummary } = require('../ops')

function executeRemoteAction({ adapter, action, stateRoot, args = {}, deliverers = {} }) {
  if (adapter !== 'discord' && adapter !== 'telegram') {
    throw new Error(`Unsupported adapter: ${adapter}`)
  }

  const deliver = deliverers.discordPost || postDiscord
  const source = args.source || 'openfleet'

  if (action === 'post') {
    if (adapter !== 'discord') {
      throw new Error(`Unsupported ${adapter} action: post`)
    }
    return deliver({
      message: args.message,
      channel: args.channel,
      source,
      stateRoot,
    })
  }

  if (action === 'summary') {
    if (adapter !== 'discord') {
      throw new Error(`Unsupported ${adapter} action: summary`)
    }
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
    if (adapter !== 'discord') {
      throw new Error(`Unsupported ${adapter} action: presence`)
    }
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
    if (adapter === 'telegram') {
      return resolveInboundTelegramMessage({
        chatId: args.chatId || args.channelId,
        routing: args.routing || {},
        configPath: args.configPath,
      })
    }

    return resolveInboundDiscordMessage({
      channelId: args.channelId,
      routing: args.routing || {},
      configPath: args.configPath,
      guildLayoutPath: args.guildLayoutPath,
    })
  }

  throw new Error(`Usage: remote ${adapter} <post|summary|presence|route-inbound> ...`)
}

module.exports = {
  executeRemoteAction,
}
