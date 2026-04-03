const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

function blockersPath(stateDir) {
  return path.join(stateDir, "blockers.json")
}

function loadBlockers(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(blockersPath(stateDir), "utf8"))
  } catch {
    return { blockers: {} }
  }
}

function saveBlockers(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(blockersPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function createBlocker(stateDir, input) {
  const data = loadBlockers(stateDir)
  const id = input.id || `blk_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const blocker = {
    id,
    task_id: input.task_id || null,
    job_id: input.job_id || null,
    workflow_id: input.workflow_id || null,
    agent_id: input.agent_id || null,
    summary: input.summary || "",
    question: input.question || "",
    blocked_on_type: input.blocked_on_type || "human",
    blocked_on_id: input.blocked_on_id || null,
    urgency: input.urgency || "normal",
    status: input.status || "open",
    channel_binding: input.channel_binding || null,
    created_at: now,
    updated_at: now,
  }
  data.blockers[id] = blocker
  saveBlockers(stateDir, data)
  return blocker
}

function updateBlocker(stateDir, id, patch) {
  const data = loadBlockers(stateDir)
  const current = data.blockers[id]
  if (!current) throw new Error(`Unknown blocker: ${id}`)
  const next = {
    ...current,
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  }
  data.blockers[id] = next
  saveBlockers(stateDir, data)
  return next
}

function getBlocker(stateDir, id) {
  return loadBlockers(stateDir).blockers[id] || null
}

function listBlockers(stateDir) {
  return Object.values(loadBlockers(stateDir).blockers).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

module.exports = {
  blockersPath,
  createBlocker,
  getBlocker,
  listBlockers,
  loadBlockers,
  saveBlockers,
  updateBlocker,
}
