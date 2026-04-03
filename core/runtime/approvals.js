const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

function approvalsPath(stateDir) {
  return path.join(stateDir, "approvals.json")
}

function loadApprovals(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(approvalsPath(stateDir), "utf8"))
  } catch {
    return { approvals: {} }
  }
}

function saveApprovals(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(approvalsPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function createApproval(stateDir, input) {
  const data = loadApprovals(stateDir)
  const id = input.id || `apr_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const approval = {
    id,
    task_id: input.task_id || null,
    job_id: input.job_id || null,
    workflow_id: input.workflow_id || null,
    agent_id: input.agent_id || null,
    action_type: input.action_type || "approval",
    summary: input.summary || "",
    risk_class: input.risk_class || "high_impact",
    status: input.status || "pending",
    channel_binding: input.channel_binding || null,
    requested_at: now,
    resolved_at: null,
    resolved_by: null,
    resolution: null,
    updated_at: now,
  }
  data.approvals[id] = approval
  saveApprovals(stateDir, data)
  return approval
}

function updateApproval(stateDir, id, patch) {
  const data = loadApprovals(stateDir)
  const current = data.approvals[id]
  if (!current) throw new Error(`Unknown approval: ${id}`)
  const next = {
    ...current,
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  }
  data.approvals[id] = next
  saveApprovals(stateDir, data)
  return next
}

function getApproval(stateDir, id) {
  return loadApprovals(stateDir).approvals[id] || null
}

function listApprovals(stateDir) {
  return Object.values(loadApprovals(stateDir).approvals).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

module.exports = {
  approvalsPath,
  createApproval,
  getApproval,
  listApprovals,
  loadApprovals,
  saveApprovals,
  updateApproval,
}
