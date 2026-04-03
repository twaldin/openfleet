const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { resolveProject } = require('./projects')

function workflowsPath(stateDir) {
  return path.join(stateDir, "workflows.json")
}

function loadWorkflows(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(workflowsPath(stateDir), "utf8"))
  } catch {
    return { workflows: {} }
  }
}

function saveWorkflows(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(workflowsPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function createWorkflow(stateDir, input) {
  const data = loadWorkflows(stateDir)
  const id = input.id || `wf_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const project = resolveProject(stateDir, input)
  const context = {
    ...(input.context || {}),
    project_id: input.context?.project_id || input.project_id || input.projectId || project?.id || null,
    repo: input.context?.repo || input.repo || project?.repo || null,
    channel_binding: input.context?.channel_binding || input.channel_binding || input.channelBinding || project?.channel_binding || null,
    project_host: input.context?.project_host || project?.host || null,
    default_runtime_profiles: input.context?.default_runtime_profiles || project?.default_runtime_profiles || null,
  }
  const workflow = {
    id,
    type: input.type || "workflow",
    status: input.status || "created",
    project_id: input.project_id || input.projectId || project?.id || null,
    current_step: input.current_step || input.currentStep || null,
    steps: input.steps || [],
    context,
    previous_status: input.previous_status || input.previousStatus || null,
    pause_reason: input.pause_reason || input.pauseReason || null,
    paused_by: input.paused_by || input.pausedBy || null,
    paused_at: input.paused_at || input.pausedAt || null,
    resumed_by: input.resumed_by || input.resumedBy || null,
    resumed_at: input.resumed_at || input.resumedAt || null,
    created_at: now,
    updated_at: now,
  }
  data.workflows[id] = workflow
  saveWorkflows(stateDir, data)
  return workflow
}

function updateWorkflow(stateDir, id, patch) {
  const data = loadWorkflows(stateDir)
  const current = data.workflows[id]
  if (!current) throw new Error(`Unknown workflow: ${id}`)
  const next = {
    ...current,
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  }
  data.workflows[id] = next
  saveWorkflows(stateDir, data)
  return next
}

function getWorkflow(stateDir, id) {
  return loadWorkflows(stateDir).workflows[id] || null
}

function listWorkflows(stateDir) {
  return Object.values(loadWorkflows(stateDir).workflows).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

function advanceWorkflow(stateDir, id) {
  const workflow = getWorkflow(stateDir, id)
  if (!workflow) throw new Error(`Unknown workflow: ${id}`)
  if (workflow.status === 'paused') {
    throw new Error(`Cannot advance paused workflow: ${id}`)
  }
  const steps = workflow.steps || []
  const current = workflow.current_step
  let next = null
  if (!current && steps.length) {
    next = steps[0]
  } else {
    const index = steps.indexOf(current)
    if (index >= 0 && index + 1 < steps.length) {
      next = steps[index + 1]
    }
  }
  return updateWorkflow(stateDir, id, {
    current_step: next,
    status: next ? "active" : "completed",
  })
}

function pauseWorkflow(stateDir, id, patch = {}) {
  const workflow = getWorkflow(stateDir, id)
  if (!workflow) throw new Error(`Unknown workflow: ${id}`)
  return updateWorkflow(stateDir, id, {
    status: 'paused',
    previous_status: workflow.status,
    pause_reason: patch.reason || patch.pause_reason || patch.pauseReason || null,
    paused_by: patch.paused_by || patch.pausedBy || null,
    paused_at: patch.paused_at || patch.pausedAt || new Date().toISOString(),
    resumed_by: null,
    resumed_at: null,
  })
}

function resumeWorkflow(stateDir, id, patch = {}) {
  const workflow = getWorkflow(stateDir, id)
  if (!workflow) throw new Error(`Unknown workflow: ${id}`)
  return updateWorkflow(stateDir, id, {
    status: workflow.previous_status || 'active',
    previous_status: null,
    pause_reason: null,
    paused_by: null,
    paused_at: null,
    resumed_by: patch.resumed_by || patch.resumedBy || null,
    resumed_at: patch.resumed_at || patch.resumedAt || new Date().toISOString(),
  })
}

module.exports = {
  advanceWorkflow,
  createWorkflow,
  getWorkflow,
  listWorkflows,
  loadWorkflows,
  pauseWorkflow,
  resumeWorkflow,
  saveWorkflows,
  updateWorkflow,
  workflowsPath,
}
