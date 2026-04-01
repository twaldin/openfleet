const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { ensureRegistry, loadRegistry, nextSessionSeq, saveRegistry } = require("./registry")

function eventsPath(stateDir) {
  return path.join(stateDir, "events.jsonl")
}

function createEvent(input) {
  if (!input?.type) {
    throw new Error("event.type is required")
  }

  const ts = input.ts || new Date().toISOString()
  const id = input.id || `evt_${crypto.randomUUID()}`

  return {
    id,
    type: input.type,
    ts,
    fleet: input.fleet || "openfleet",
    run_id: input.run_id || input.runId || null,
    session_id: input.session_id || input.sessionId || null,
    agent_id: input.agent_id || input.agentId || null,
    parent_event_id: input.parent_event_id || input.parentEventId || null,
    seq: input.seq ?? null,
    severity: input.severity || "info",
    payload: input.payload || {},
    meta: {
      schema_version: "1.0",
      ...(input.meta || {}),
    },
  }
}

function appendEvent(stateDir, event) {
  fs.mkdirSync(stateDir, { recursive: true })
  const registry = ensureRegistry(stateDir)
  const normalized = createEvent(event)

  if (normalized.session_id && normalized.seq == null) {
    normalized.seq = nextSessionSeq(registry, normalized.session_id)
  }

  fs.appendFileSync(eventsPath(stateDir), `${JSON.stringify(normalized)}\n`)

  if (normalized.session_id) {
    registry.cursors[normalized.session_id] = normalized.id
    registry.sessions[normalized.session_id] = {
      ...(registry.sessions[normalized.session_id] || {}),
      session_id: normalized.session_id,
      last_event_id: normalized.id,
      updated_at: normalized.ts,
    }
    saveRegistry(stateDir, registry)
  }

  return normalized
}

function readEvents(stateDir, { sinceId = null, sessionId = null, limit = Infinity } = {}) {
  const filePath = eventsPath(stateDir)
  if (!fs.existsSync(filePath)) return []

  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean)
  const events = lines.map((line) => JSON.parse(line))

  let filtered = events
  if (sessionId) {
    filtered = filtered.filter((event) => event.session_id === sessionId)
  }
  if (sinceId) {
    const index = filtered.findIndex((event) => event.id === sinceId)
    filtered = index === -1 ? filtered : filtered.slice(index + 1)
  }

  return filtered.slice(0, limit)
}

function createEventStore(stateDir) {
  return {
    append: (event) => appendEvent(stateDir, event),
    read: (options) => readEvents(stateDir, options),
    ensure: () => ensureRegistry(stateDir),
  }
}

module.exports = {
  appendEvent,
  createEvent,
  createEventStore,
  eventsPath,
  readEvents,
}
