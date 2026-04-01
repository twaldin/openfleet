const fs = require("fs")
const path = require("path")

function registryPath(stateDir) {
  return path.join(stateDir, "registry.json")
}

function defaultRegistry() {
  return {
    sessions: {},
    agents: {},
    cursors: {},
  }
}

function loadRegistry(stateDir) {
  const filePath = registryPath(stateDir)
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return defaultRegistry()
  }
}

function saveRegistry(stateDir, registry) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(registryPath(stateDir), `${JSON.stringify(registry, null, 2)}\n`)
}

function ensureRegistry(stateDir) {
  const registry = loadRegistry(stateDir)
  saveRegistry(stateDir, registry)
  return registry
}

function upsertSession(registry, session) {
  if (!session?.session_id && !session?.sessionId && !session?.id) {
    throw new Error("session record requires an id")
  }

  const sessionId = session.session_id || session.sessionId || session.id
  const current = registry.sessions[sessionId] || { seq: 0 }

  registry.sessions[sessionId] = {
    ...current,
    ...session,
    session_id: sessionId,
    updated_at: session.updated_at || new Date().toISOString(),
  }

  return registry.sessions[sessionId]
}

function nextSessionSeq(registry, sessionId) {
  const current = registry.sessions[sessionId] || { seq: 0 }
  const nextSeq = Number(current.seq || 0) + 1
  registry.sessions[sessionId] = {
    ...current,
    session_id: sessionId,
    seq: nextSeq,
    updated_at: new Date().toISOString(),
  }
  return nextSeq
}

module.exports = {
  ensureRegistry,
  loadRegistry,
  nextSessionSeq,
  registryPath,
  saveRegistry,
  upsertSession,
}
