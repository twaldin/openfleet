const fs = require('fs')
const os = require('os')
const path = require('path')
const { createEventStore } = require('../runtime/events')
const { resolveInboundRoute } = require('../routing')

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), '.openfleet')
}

function defaultTelegramConfigPath() {
  return process.env.OPENFLEET_TELEGRAM_CONFIG || path.join(defaultStateRoot(), 'telegram.json')
}

function loadTelegramConfig(configPath = defaultTelegramConfigPath()) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
}

function resolveTelegramChat(chat, { config = null, configPath = defaultTelegramConfigPath() } = {}) {
  const loaded = config || loadTelegramConfig(configPath) || {}
  const value = String(chat || '').trim()
  if (!value) throw new Error('telegram chat is required')
  if (/^-?\d+$/.test(value)) return value
  const alias = value.replace(/^channel:\/\//, '')
  return loaded.chats?.[alias] || value
}

function resolveInboundTelegramMessage({ chatId, routing = {}, configPath = defaultTelegramConfigPath() } = {}) {
  const config = loadTelegramConfig(configPath) || {}
  const located = findChatById(config.chats || {}, chatId)
  if (!located) {
    throw new Error(`Unknown Telegram chat id: ${chatId}`)
  }

  const channelBinding = `channel://${located.chat_name}`
  const targetAgent = Object.entries(routing.persistent_agent_channels || {}).find(([, bound]) => bound === channelBinding)?.[0] || null

  return {
    chat_name: located.chat_name,
    chat_id: String(chatId),
    route: resolveInboundRoute(routing, { targetAgent, channelBinding }),
  }
}

function findChatById(chats, chatId) {
  const normalized = String(chatId)
  for (const [chatName, currentId] of Object.entries(chats || {})) {
    if (String(currentId) === normalized) {
      return { chat_name: chatName }
    }
  }
  return null
}

function parseTelegramUpdate(update) {
  const message = update?.message
  if (!message?.chat) return null

  return {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: String(message.chat.id),
    chat_type: message.chat.type || null,
    chat_title: message.chat.title || message.chat.username || null,
    sender_id: message.from?.id == null ? null : String(message.from.id),
    sender_name: resolveSenderName(message.from),
    is_bot: Boolean(message.from?.is_bot),
    text: typeof message.text === 'string' ? message.text : '',
  }
}

function resolveSenderName(sender = {}) {
  if (sender.username) return sender.username
  const fullName = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (sender.id != null) return String(sender.id)
  return 'unknown'
}

function shouldProcessTelegramUpdate(update, { botUserId = null } = {}) {
  const parsed = parseTelegramUpdate(update)
  if (!parsed) return false
  if (parsed.is_bot) return false
  if (botUserId != null && parsed.sender_id === String(botUserId)) return false
  return parsed.text.trim().length > 0
}

function formatTelegramMessage(chatName, author, content) {
  const body = String(content || '').trim() || '(empty)'
  return `[TELEGRAM #${chatName || 'unknown'}] ${author}: ${body}`
}

async function sendMessage(token, chat, text, { replyToMessageId = null, fetchImpl = global.fetch } = {}) {
  if (!token) throw new Error('sendMessage requires a bot token')
  const chatId = resolveTelegramChat(chat)
  const message = String(text || '')
  if (!message.trim()) throw new Error('sendMessage requires message text')
  if (typeof fetchImpl !== 'function') throw new Error('sendMessage requires fetch')

  const payload = {
    chat_id: chatId,
    text: message,
  }
  if (replyToMessageId != null) payload.reply_to_message_id = replyToMessageId

  return telegramRequest(token, 'sendMessage', payload, fetchImpl)
}

async function getUpdates(token, { offset = null, timeout = 30, allowedUpdates = ['message'] } = {}, fetchImpl = global.fetch) {
  if (!token) throw new Error('getUpdates requires a bot token')
  if (typeof fetchImpl !== 'function') throw new Error('getUpdates requires fetch')

  const payload = {
    timeout,
    allowed_updates: allowedUpdates,
  }
  if (offset != null) payload.offset = offset

  const result = await telegramRequest(token, 'getUpdates', payload, fetchImpl)
  if (!Array.isArray(result)) {
    throw new Error(`Telegram API error: ${JSON.stringify(result)}`)
  }
  return result
}

async function postTelegram({ message, channel, source = 'system', stateRoot = defaultStateRoot(), configPath = defaultTelegramConfigPath(), fetchImpl = global.fetch }) {
  if (!message || !channel) {
    throw new Error('telegram post requires message and channel')
  }

  const config = loadTelegramConfig(configPath)
  if (!config?.token) {
    throw new Error(`telegram post requires token in ${configPath}`)
  }

  const chatId = resolveTelegramChat(channel, { config, configPath })
  await sendMessage(config.token, chatId, message, { fetchImpl })

  createEventStore(stateRoot).append({
    type: 'adapter.delivered',
    agent_id: source,
    severity: 'info',
    payload: {
      adapter: 'telegram',
      channel: chatId,
      message,
    },
  })

  return { ok: true, adapter: 'telegram', channel: chatId, source }
}

async function telegramRequest(token, method, payload, fetchImpl) {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Telegram API ${method} failed: ${response.status} ${text}`)
  }

  const body = await response.json()
  if (!body?.ok) {
    throw new Error(`Telegram API ${method} error: ${JSON.stringify(body)}`)
  }
  return body.result
}

module.exports = {
  defaultTelegramConfigPath,
  formatTelegramMessage,
  getUpdates,
  loadTelegramConfig,
  parseTelegramUpdate,
  postTelegram,
  resolveInboundTelegramMessage,
  resolveTelegramChat,
  sendMessage,
  shouldProcessTelegramUpdate,
}
