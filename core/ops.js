const fs = require("fs")
const os = require("os")
const path = require("path")
const { ensureOpencodeServer, request } = require("../lib/opencode")
const { loadRegistry } = require("./runtime/registry")
const { loadSessionMetadata, sessionDir } = require("./runtime/session")
const { readEvents } = require("./runtime/events")

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function listAgentMetadata(stateRoot = defaultStateRoot()) {
  const registry = loadRegistry(stateRoot)
  const dir = sessionDir(stateRoot)
  const items = []
  const seen = new Set()

  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".json")) continue
      const name = entry.slice(0, -5)
      const meta = loadSessionMetadata(stateRoot, name)
      if (!meta) continue
      items.push(enrich(meta, registry))
      seen.add(name)
    }
  } catch {
    // ignore missing dir
  }

  for (const session of Object.values(registry.sessions || {})) {
    if (!session.name || seen.has(session.name)) continue
    items.push(enrich({ name: session.name }, registry))
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

function enrich(meta, registry) {
  const sessionId = meta.sessionID || meta.sessionId || meta.session_id || null
  const reg = sessionId ? registry.sessions?.[sessionId] : null
  return {
    name: meta.name,
    sessionID: sessionId,
    title: meta.title || reg?.title || null,
    directory: meta.directory || reg?.directory || null,
    workspace: meta.workspace || reg?.workspace || null,
    agentProfile: meta.agentProfile || reg?.agentProfile || null,
    created: meta.created || reg?.created_at || null,
    updated: meta.updated_at || meta.updated || reg?.updated_at || null,
    seq: reg?.seq || null,
    lastEventID: reg?.last_event_id || null,
  }
}

function inspectAgent(stateRoot, name, limit = 20) {
  const registry = loadRegistry(stateRoot)
  const meta = loadSessionMetadata(stateRoot, name)
  if (!meta) {
    throw new Error(`Unknown agent metadata: ${name}`)
  }

  const sessionId = meta.sessionID || meta.sessionId || meta.session_id
  const events = sessionId ? readEvents(stateRoot, { sessionId, limit }) : []

  return {
    metadata: enrich(meta, registry),
    events,
  }
}

async function fetchSessionMessages({ metadata, host = "127.0.0.1", port = "4096", serverStateDir, serverLogDir }) {
  const baseUrl = process.env.OPENCODE_URL || await ensureOpencodeServer({
    host,
    port,
    stateDir: serverStateDir,
    logDir: serverLogDir,
  })

  const sessionId = metadata.sessionID || metadata.sessionId || metadata.session_id
  const directory = metadata.directory || metadata.workspace
  if (!sessionId || !directory) {
    throw new Error(`Missing session metadata for ${metadata.name}`)
  }

  return request(baseUrl, "GET", `/session/${sessionId}/message`, { directory })
}

function renderMessages(messages, limit = 20) {
  return messages.slice(-limit).map((message) => {
    const info = message.info || {}
    const textParts = (message.parts || [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text.trim())
      .filter(Boolean)

    return {
      role: info.role || null,
      provider: info.providerID || null,
      model: info.modelID || null,
      finish: info.finish || null,
      text: textParts.join("\n\n") || null,
      partTypes: (message.parts || []).map((part) => part.type),
    }
  })
}

module.exports = {
  defaultStateRoot,
  fetchSessionMessages,
  inspectAgent,
  listAgentMetadata,
  renderMessages,
}
